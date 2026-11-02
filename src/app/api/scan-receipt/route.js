export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');
    const userId = formData.get('userId');
    const accessToken = formData.get('accessToken');
    console.log('userId received:', userId);

    if (!image) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    // Convert image to buffer
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check if HF_TOKEN is configured
    if (!process.env.HF_TOKEN) {
      throw new Error('Hugging Face API token not configured. Please set HF_TOKEN environment variable.');
    }

    // Call Hugging Face Inference API for OCR
    const hfResponse = await fetch(
      'https://api-inference.huggingface.co/models/microsoft/trocr-base-printed',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/octet-stream',
          'User-Agent': 'cartwise/1.0'
        },
        body: buffer
      }
    );

    if (!hfResponse.ok) {
      const errorText = await hfResponse.text();
      throw new Error(`HF Inference error: ${hfResponse.status}: ${errorText}`);
    }

    const result = await hfResponse.json();
    // Assuming the model returns { generated_text: "..." } or similar
    let generatedText = '';
    if (result && typeof result === 'object') {
      if (result.generated_text) {
        generatedText = result.generated_text;
      } else if (Array.isArray(result) && result[0] && result[0].generated_text) {
        generatedText = result[0].generated_text;
      } else {
        generatedText = JSON.stringify(result);
      }
    } else {
      generatedText = String(result);
    }

    // Basic parsing: try to extract useful information from OCR text
    const lines = generatedText.split('\n').filter(line => line.trim() !== '');

    // Heuristic: look for potential store name (often in first few lines, often has certain characteristics)
    let detectedStoreName = 'Detected from OCR';
    if (lines.length > 0) {
      // Look for lines that might be store names (typically shorter, might contain common store indicators)
      const storeCandidates = lines.slice(0, Math.min(5, lines.length)).filter(line =>
        line.length > 2 && line.length < 50 &&
        !line.match(/^\d+[\d\s\-:\/]+$/) && // Not just numbers/dates
        !line.toLowerCase().match(/^(item|description|price|amount|total|sub|tax|change|cash|card)/i) // Not typical receipt items
      );

      if (storeCandidates.length > 0) {
        // Take the first reasonable candidate
        detectedStoreName = storeCandidates[0];
      }
    }

    // Try to extract date (simple pattern matching)
    let detectedDate = '';
    const dateMatch = generatedText.match(/\d{1,2}[\/\-\.\]\d{1,2}[\/\-\.\]\d{2,4}|\d{2,4}[\/\-\.\]\d{1,2}[\/\-\.\]\d{1,2}/);
    if (dateMatch) {
      detectedDate = dateMatch[0];
    }

    // Try to extract total amount
    let detectedTotal = null;
    const totalMatches = generatedText.match(/(?:total|amount|sum|balance)[\s\:$]*(\d+[,\.\d]*)/i);
    if (totalMatches) {
      try {
        detectedTotal = parseFloat(totalMatches[1].replace(',', '.'));
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Create items array with basic structure
    const items = [];
    if (detectedTotal !== null) {
      items.push({
        name: 'Total',
        unit_price: detectedTotal,
        price_type: 'each',
        quantity: 1,
        description: 'Detected total amount'
      });
    }

    // Always include the raw text item
    items.push({
      name: 'OCR Text Detected',
      unit_price: null,
      price_type: null,
      quantity: 1,
      description: generatedText.substring(0, 200) + (generatedText.length > 200 ? '...' : '')
    });

    const parsed = {
      store_name: detectedStoreName,
      store_address: '', // Would need more advanced parsing
      date: detectedDate,
      time: '', // Would need more advanced parsing
      items: items,
      rawText: generatedText
    };

    // Optionally save to Supabase (optional)
    if (userId && accessToken) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            global: { headers: { Authorization: `Bearer ${accessToken}` } }
          }
        );

        const rows = [{
          user_id: userId,
          store_name: parsed.store_name,
          store_address: parsed.store_address,
          date: parsed.date,
          time: parsed.time,
          item_name: parsed.items[0].name,
          unit_price: parsed.items[0].unit_price,
          price_type: parsed.items[0].price_type,
          quantity: parsed.items[0].quantity
        }];

        await supabase.from('receipts').insert(rows);
      } catch (saveErr) {
        console.error('Failed to save receipt to Supabase:', saveErr);
        // Non-fatal
      }
    }

    return Response.json(parsed);
  } catch (err) {
    console.error('OCR error:', err);
    // Provide more specific error messages based on error type
    let errorMessage = err.message;
    let statusCode = 500;

    if (err.message.includes('fetch failed')) {
      errorMessage = 'Failed to connect to Hugging Face API. This could be due to network issues, missing API token, or service unavailability.';
      statusCode = 503;
    } else if (err.message.includes('HF Inference error')) {
      // Keep the detailed HF error message
      statusCode = 502;
    } else if (err.message.includes('not configured')) {
      errorMessage = 'Hugging Face API token not configured. Please set HF_TOKEN environment variable.';
      statusCode = 500;
    }

    return Response.json({ error: errorMessage }, { status: statusCode });
  }
}