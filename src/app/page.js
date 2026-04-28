'use client';
import { useState } from 'react';

const HF_SPACE = 'https://soulai40075-receipt-ocr-pipeline.hf.space';

export default function Home() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
    setStatus('');
  }

  async function handleSubmit() {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStatus('Sending receipt to AI...');

    try {
      const formData = new FormData();
      formData.append('image', image);

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      const eventId = data.event_id;
      setStatus('AI is reading your receipt...');

      // Poll HuggingFace directly from browser
      let attempts = 0;
      while (attempts < 60) {
        await new Promise(r => setTimeout(r, 3000));
        attempts++;

        const pollRes = await fetch(
          `${HF_SPACE}/gradio_api/call/process_receipt/${eventId}`
        );

        const text = await pollRes.text();
        const lines = text.split('\n').filter(l => l.startsWith('data:'));

        if (!lines.length) {
          setStatus(`Still processing... (${attempts * 3}s)`);
          continue;
        }

        const raw = lines[lines.length - 1].replace('data: ', '').trim();

        try {
          const resultData = JSON.parse(raw);
          const jsonStr = resultData[1];
          const parsed = JSON.parse(jsonStr);
          setResult(parsed);
          setStatus('');
          setLoading(false);
          return;
        } catch {
          continue;
        }
      }

      throw new Error('Timed out waiting for result');

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setStatus('');
    }
  }

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>🛒 CartWise</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Upload a receipt to find cheaper prices nearby</p>

      <div style={{
        border: '2px dashed #ccc', borderRadius: 12, padding: '2rem',
        textAlign: 'center', marginBottom: '1rem', background: '#fafafa'
      }}>
        {preview
          ? <img src={preview} alt="Receipt" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} />
          : <p style={{ color: '#aaa' }}>No image selected</p>
        }
      </div>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageChange}
        style={{ marginBottom: '1rem', display: 'block' }}
      />

      <button
        onClick={handleSubmit}
        disabled={!image || loading}
        style={{
          width: '100%', padding: '0.75rem', borderRadius: 8, border: 'none',
          background: loading ? '#ccc' : '#16a34a', color: 'white',
          fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '0.5rem'
        }}
      >
        {loading ? 'Scanning...' : 'Scan Receipt'}
      </button>

      {status && (
        <p style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {status}
        </p>
      )}

      {error && (
        <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: 8, color: '#dc2626', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: 12, border: '1px solid #bbf7d0' }}>
          <h2 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{result.store_name || 'Unknown Store'}</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            {result.store_address || ''} {result.date ? `· ${result.date}` : ''} {result.time ? `· ${result.time}` : ''}
          </p>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #bbf7d0' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0', color: '#166534' }}>Item</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0', color: '#166534' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {(result.items || []).map((item, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #dcfce7' }}>
                  <td style={{ padding: '0.5rem 0' }}>{item.name}</td>
                  <td style={{ textAlign: 'right', padding: '0.5rem 0' }}>
                    {item.unit_price != null
                      ? `$${item.unit_price.toFixed(2)}${item.price_type && item.price_type !== 'each' ? '/' + item.price_type.replace('per_', '') : ''}`
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}