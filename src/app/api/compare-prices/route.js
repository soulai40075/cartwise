export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request) {
  try {
    const { itemName } = await request.json();

    if (!itemName) {
      return Response.json({ error: 'No item name provided' }, { status: 400 });
    }

    // Submit to matcher Space
    const submitRes = await fetch(
      'https://soulai40075-groceryproductmatcher.hf.space/gradio_api/call/compare_prices',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [itemName] }),
      }
    );

    const submitData = await submitRes.json();
    const eventId = submitData.event_id;

    if (!eventId) {
      return Response.json({ error: 'No event ID', detail: submitData }, { status: 500 });
    }

    // Stream result
    const resultRes = await fetch(
      `https://soulai40075-groceryproductmatcher.hf.space/gradio_api/call/compare_prices/${eventId}`
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
            if (Array.isArray(resultData) && resultData.length >= 1) {
              return Response.json({ summary: resultData[0] });
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