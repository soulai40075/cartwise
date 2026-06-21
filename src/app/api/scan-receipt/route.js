export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');
    const userId = formData.get('userId');
    console.log('userId received:', userId);

    if (!image) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    // Step 1 — upload to HuggingFace
    const uploadForm = new FormData();
    const blob = new Blob([await image.arrayBuffer()], { type: image.type });
    uploadForm.append('files', blob, image.name || 'receipt.jpg');

    const uploadRes = await fetch(
      'https://soulai40075-receipt-ocr-pipeline.hf.space/gradio_api/upload',
      { method: 'POST', body: uploadForm }
    );

    const uploadData = await uploadRes.json();
    const filePath = uploadData[0];

    if (!filePath) {
      return Response.json({ error: 'Upload failed', detail: uploadData }, { status: 500 });
    }

    // Step 2 — submit job
    const submitRes = await fetch(
      'https://soulai40075-receipt-ocr-pipeline.hf.space/gradio_api/call/process_receipt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [{ path: filePath, meta: { _type: 'gradio.FileData' } }]
        }),
      }
    );

    const submitData = await submitRes.json();
    const eventId = submitData.event_id;

    if (!eventId) {
      return Response.json({ error: 'No event ID', detail: submitData }, { status: 500 });
    }

    // Step 3 — stream result
    const resultRes = await fetch(
      `https://soulai40075-receipt-ocr-pipeline.hf.space/gradio_api/call/process_receipt/${eventId}`
    );

    const reader = resultRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const raw = line.replace('data: ', '').trim();
          try {
            const resultData = JSON.parse(raw);
            if (Array.isArray(resultData) && resultData.length >= 2) {
              const parsed = JSON.parse(resultData[1]);

              // Step 4 — save to Supabase with user_id
              if (userId && parsed.items?.length) {
                const { createClient } = await import('@supabase/supabase-js');
                const supabase = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL,
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                );

                const rows = parsed.items.map(item => ({
                  user_id: userId,
                  store_name: parsed.store_name,
                  store_address: parsed.store_address,
                  date: parsed.date,
                  time: parsed.time,
                  item_name: item.name,
                  unit_price: item.unit_price,
                  price_type: item.price_type,
                  quantity: item.quantity
                }));

                await supabase.from('receipts').insert(rows);
              }

              return Response.json(parsed);
            }
          } catch {
            continue;
          }
        }
      }
    }

    return Response.json({ error: 'No result received' }, { status: 500 });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}