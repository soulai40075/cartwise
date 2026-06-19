'use client';
import { useState, useEffect } from 'react';
import { createClient } from './supabase';

export default function Home() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setAuthReady(true); return; }
    
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  async function handleAuth() {
    const supabase = createClient();
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email to confirm your account!');
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setResult(null);
  }

  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }

  async function handleSubmit() {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('image', image);
      if (user?.id) formData.append('userId', user.id);
      const res = await fetch('/api/scan-receipt', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!authReady) {
    return (
      <main style={{ maxWidth: 400, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <p style={{ color: '#666', marginTop: '4rem' }}>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ maxWidth: 400, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>🛒 CartWise</h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>Find cheaper grocery prices near you</p>

        <div style={{ background: '#f9fafb', borderRadius: 12, padding: '1.5rem', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', marginBottom: '1.5rem', gap: 8 }}>
            <button onClick={() => setAuthMode('login')} style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', background: authMode === 'login' ? '#16a34a' : '#e5e7eb', color: authMode === 'login' ? 'white' : '#374151', cursor: 'pointer', fontWeight: 'bold' }}>Login</button>
            <button onClick={() => setAuthMode('signup')} style={{ flex: 1, padding: '0.5rem', borderRadius: 8, border: 'none', background: authMode === 'signup' ? '#16a34a' : '#e5e7eb', color: authMode === 'signup' ? 'white' : '#374151', cursor: 'pointer', fontWeight: 'bold' }}>Sign Up</button>
          </div>

          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: '0.75rem', boxSizing: 'border-box', fontSize: '1rem' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: '1px solid #d1d5db', marginBottom: '1rem', boxSizing: 'border-box', fontSize: '1rem' }} />

          {authError && <div style={{ color: '#dc2626', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{authError}</div>}

          <button onClick={handleAuth} disabled={authLoading}
            style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: 'none', background: '#16a34a', color: 'white', fontSize: '1rem', cursor: authLoading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {authLoading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>🛒 CartWise</h1>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.8rem', color: '#666', margin: 0 }}>{user.email}</p>
          <button onClick={handleSignOut} style={{ fontSize: '0.8rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Sign out</button>
        </div>
      </div>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Upload a receipt to find cheaper prices nearby</p>

      <div style={{ border: '2px dashed #ccc', borderRadius: 12, padding: '2rem', textAlign: 'center', marginBottom: '1rem', background: '#fafafa' }}>
        {preview
          ? <img src={preview} alt="Receipt" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} />
          : <p style={{ color: '#aaa' }}>No image selected</p>}
      </div>

      <input type="file" accept="image/*" capture="environment" onChange={handleImageChange}
        style={{ marginBottom: '1rem', display: 'block' }} />

      <button onClick={handleSubmit} disabled={!image || loading}
        style={{ width: '100%', padding: '0.75rem', borderRadius: 8, border: 'none', background: loading ? '#ccc' : '#16a34a', color: 'white', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: '1.5rem' }}>
        {loading ? 'Scanning... (may take 30s)' : 'Scan Receipt'}
      </button>

      {error && (
        <div style={{ background: '#fee2e2', padding: '1rem', borderRadius: 8, color: '#dc2626', marginBottom: '1rem' }}>{error}</div>
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