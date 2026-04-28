export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');

    if (!image) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = image.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Step 1 — submit to Gradio
    const submitRes = await fetch(
      'https://soulai40075-receipt-ocr-pipeline.hf.space/gradio_api/call/process_receipt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [dataUrl] }),
      }
    );

    const submitData = await submitRes.json();
    const eventId = submitData.event_id;

    if (!eventId) {
      return Response.json({ error: 'No event ID returned', detail: submitData }, { status: 500 });
    }

    // Step 2 — poll for result
    let parsed = {};
    let attempts = 0;

    while (attempts < 60) {
      await new Promise(r => setTimeout(r, 3000));
      attempts++;

      const resultRes = await fetch(
        `https://soulai40075-receipt-ocr-pipeline.hf.space/gradio_api/call/process_receipt/${eventId}`
      );

      const text = await resultRes.text();
      const lines = text.split('\n').filter(l => l.startsWith('data:'));

      if (!lines.length) continue;

      const raw = lines[lines.length - 1].replace('data: ', '').trim();

      try {
        const resultData = JSON.parse(raw);
        const jsonStr = resultData[1];
        try { parsed = JSON.parse(jsonStr); } catch { parsed = {}; }
        return Response.json(parsed);
      } catch {
        continue;
      }
    }

    return Response.json({ error: 'Timed out waiting for result' }, { status: 504 });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}