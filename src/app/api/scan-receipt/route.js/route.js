export async function POST(request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image');

    if (!image) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    const hfForm = new FormData();
    hfForm.append('image', image);

    const res = await fetch(
      'https://soulai40075-receipt-ocr-pipeline.hf.space/gradio_api/call/process_receipt',
      {
        method: 'POST',
        body: hfForm,
      }
    );

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}