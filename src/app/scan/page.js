'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ScanPage() {
  const [user, setUser] = useState(null);
  const [authReadyState, setReadyState] = useState(false);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparisons, setComparisons] = useState({});
  const [comparingItem, setComparingItem] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setReadyState(true); return; }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReadyState(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const handleAuth = async () => {
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
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  };

  const handleCompare = async (itemName) => {
    setComparingItem(itemName);
    try {
      const res = await fetch('/api/compare-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemName }),
      });
      const data = await res.json();
      setComparisons(prev => ({ ...prev, [itemName]: data.summary || data.error }));
    } catch (err) {
      setComparisons(prev => ({ ...prev, [itemName]: 'Error fetching prices' }));
    } finally {
      setComparingItem(null);
    }
  };

  const handleSubmit = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('image', image);
      if (user?.id) formData.append('userId', user.id);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) formData.append('accessToken', session.access_token);

      const res = await fetch('/api/scan-receipt', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!authReadyState) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Loading...</h2>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-xl mx-auto py-16 px-4 sm:py-20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Scan Receipt</h2>
            <p className="text-lg text-gray-600">
              Upload your grocery receipts to find savings
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>

              {authError && (
                <div className="bg-red-50 border border-red-200 text-red-500 px-4 py-3 rounded-md">
                  {authError}
                </div>
              )}

              <button onClick={handleAuth} disabled={authLoading}
                className="w-flex items-center justify-between px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                {authLoading ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Sign Up'}
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L14 5.414V13a1 1 0 01-2 0V5.414L8.293 7.707a1 1 0 010-1.414l6-6z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M4 9h2v7H4V9zm4 0h2v7H8V9zm4 0h2v7h-2V9z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Scan Receipt
              </h1>
            </div>

            <div className="mt-4 flex md:mt-0 md:ml-6">
              <Link href="/" className="flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <span className="mr-2">Dashboard</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L14 5.414V13a1 1 0 01-2 0V5.414L8.293 7.707a1 1 0 010-1.414l6-6z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M4 9h2v7H4V9zm4 0h2v7H8V9zm4 0h2v7h-2V9z" clipRule="evenodd" />
                </svg>
              </Link>

              <button onClick={handleSignOut}
                className="ml-3 flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <span className="mr-2">Sign Out ({user.email.split('@')[0]})</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H4zm2 14-5-5v3.41a6 6 0 014.24 8.25l1.41-1.41A8 8 0 1015 9V4a1 1 0 00-2 0v5a1 1 0 01-2 0V4a1 1 0 012 0 2 0V4h6.59a8 8 0 00-11.41 3.41l-1.41 1.41A6 6 0 015 12.41v3.59z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Upload Section */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Upload Receipt</h2>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-500 hover:bg-green-50 transition-colors duration-300">
                  {preview ? (
                    <img src={preview} alt="Receipt preview" className="max-w-full h-auto rounded-lg mb-4" />
                  ) : (
                    <>
                      <div className="flex items-center justify-center mb-4">
                        <div className="h-12 w-12 flex items-center justify-center bg-green-100 rounded-lg">
                          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4 4-4M7 18h4.5a2.25 2.25 0 000-4.5H7zm0 0h13.636a3 3 0 002.954-.089l.888 4.155a1.125 1.125 0 002.155.976l2.496-.548a1.125 1.125 0 00.976-2.155l-.416-2.427A11.956 11.956 0 0012 18c-5.522 0-10-4.478-10-10s4.478-10 10-10a11.956 11.956 0 006.036 2.927l-.416 2.427a1.125 1.125 0 00-.976 2.155l-2.496.548a1.125 1.125 0 00-2.155-.976l-.888-4.155A3 3 0 006.364 12H7z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        Drag & drop an image here, or click to select
                      </p>
                    </>
                  )}
                  <label className="block cursor-pointer text-sm text-gray-500">
                    <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleImageChange} />
                    Select a receipt image
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Scan Button */}
          <div className="mb-6">
            <button onClick={handleSubmit} disabled={!image || loading}
              className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">
              {loading ? 'Scanning... (may take 30s)' : 'Scan Receipt'}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Scan Results</h2>

                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                    {result.store_name || 'Unknown Store'}
                    <svg className="ml-2 h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L14 5.414V13a1 1 0 01-2 0V5.414L8.293 7.707a1 1 0 010-1.414l6-6z" clipRule="evenodd" />
                      <path fillRule="evenodd" d="M4 9h2v7H4V9zm4 0h2v7H8V9zm4 0h2v7h-2V9z" clipRule="evenodd" />
                    </svg>
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {result.store_address || ''}
                    {result.date ? `· ${result.date}` : ''}
                    {result.time ? `· ${result.time}` : ''}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Item
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                          <span className="sr-only">Edit</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(result.items || []).map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-full">
                                {item.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">{item.name}</div>
                                {item.brand && (
                                  <p className="text-xs text-gray-500">{item.brand}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.unit_price != null ? (
                              `$${item.unit_price.toFixed(2)}${item.price_type && item.price_type !== 'each' ? '/' + item.price_type.replace('per_', '') : ''}`
                            ) : (
                              <span className="text-gray-500">N/A</span>
                            )}
                          </td>
                          <td className="relative px-6 py-4">
                            <button onClick={() => handleCompare(item.name)}
                              disabled={comparingItem === item.name}
                              className="flex items-center px-3 py-1 text-sm font-medium transition-colors duration-200"
                              >
                              {comparingItem === item.name ? (
                                <span className="animate-pulse">Searching...</span>
                              ) : (
                                <>
                                  Find cheaper
                                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </>
                                )}
                              </button>
                            </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Comparison Results */}
                {Object.keys(comparisons).length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Price Comparisons</h3>
                    <div className="space-y-3">
                      {Object.entries(comparisons).map(([itemName, comparison]) => (
                        <div key={itemName} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">{itemName}</p>
                              <p className="text-sm text-gray-500">{comparison}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}