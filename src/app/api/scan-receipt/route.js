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

    const submitRes = await fetch(
      'https://soulai40075-receipt-ocr-pipeline.hf.space/gradio_api/call/process_receipt',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [dataUrl] }),
      }
    );

    const submitData = await submitRes.json();

    if (!submitData.event_id) {
      return Response.json({ error: 'No event ID returned', detail: submitData }, { status: 500 });
    }

    return Response.json({ event_id: submitData.event_id });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}