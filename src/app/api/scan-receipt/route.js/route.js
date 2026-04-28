export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');

    if (!image) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    // Convert image to base64
    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = image.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Step 1 — send to Gradio
    const submitRes = await fetch(
      'https://soulai40075-receipt-ocr-pipeline.hf.space/gradio_api/call/process_receipt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [{ path: dataUrl }] }),
      }
    );

    const submitData = await submitRes.json();
    const eventId = submitData.event_id;

    if (!eventId) {
      return Response.json({ error: 'No event ID from HuggingFace' }, { status: 500 });
    }

    // Step 2 — poll for result
    const resultRes = await fetch(
      `https://soulai40075-receipt-ocr-pipeline.hf.space/gradio_api/call/process_receipt/${eventId}`
    );

    const text = await resultRes.text();
    const lines = text.split('\n').filter(l => l.startsWith('data:'));
    if (!lines.length) {
      return Response.json({ error: 'No result from HuggingFace' }, { status: 500 });
    }

    const resultData = JSON.parse(lines[lines.length - 1].replace('data: ', ''));
    const summary = resultData[0];
    const jsonStr = resultData[1];

    let parsed = {};
    try { parsed = JSON.parse(jsonStr); } catch {}

    return Response.json(parsed);

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}