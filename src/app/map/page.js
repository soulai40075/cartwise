'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MapPage() {
  const [user, setUser] = useState(null);
  const [authReadyState, setReadyState] = useState(false);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);
  const [map, setMap] = useState(null);
  // Auth state variables
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setReadyState(true); return; }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReadyState(true);
      fetchStores(data.user?.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchStores(session.user.id);
      } else {
        setStores([]);
      }
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

  const fetchStores = async (userId) => {
    if (!userId) {
      setStores([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) return;

      // Get user's preferred stores or nearby stores
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('favorite_stores, max_radius_miles')
        .eq('id', userId)
        .single();

      // Get all active stores (in a real app, this would be filtered by location)
      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (storesError) throw storesError;

      // Enhance stores with price data if available
      const enhancedStores = await Promise.all(
        storesData.map(async (store) => {
          // Get recent prices for this store
          const { data: pricesData } = await supabase
            .from('receipts')
            .select('items')
            .eq('store_name', store.name)
            .order('created_at', { ascending: false })
            .limit(5);

          // Calculate average savings or price index
          let priceIndex = 100; // Baseline
          if (pricesData && pricesData.length > 0) {
            // Simplified calculation - in reality would compare to average prices
            priceIndex = 100 - Math.floor(Math.random() * 15); // Random for demo
          }

          return {
            ...store,
            priceIndex,
            recentScans: pricesData?.length || 0
          };
        })
      );

      setStores(enhancedStores);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching stores:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize map (placeholder - would integrate with actual map library)
  useEffect(() => {
    if (stores.length > 0) {
      // In a real implementation, this would initialize Google Maps/Mapbox
      // For now, we'll just set a placeholder
      setMap(true);
    }
  }, [stores]);

  if (!authReadyState) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Price Map</h2>
            <p className="text-lg text-gray-600">
              Visualize prices across stores in your area
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
                className="w-full flex items-center justify-between px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
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
                <svg className="h-5 w-5 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Price Map
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

              <button onClick={() => {
                const supabase = createClient();
                if (supabase) {
                  supabase.auth.signOut();
                  window.location.reload();
                }
              }}
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
          {/* Filters */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Explore Store Prices</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store Chain</label>
                  <select className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    <option value="">All Chains</option>
                    <option value="walmart">Walmart</option>
                    <option value="target">Target</option>
                    <option value="kroger">Kroger</option>
                    <option value="safeway">Safeway</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                  <select className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    <option value="name">Store Name</option>
                    <option value="priceIndex">Price (Low to High)</option>
                    <option value="distance">Distance</option>
                    <option value="rating">Rating</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Radius</label>
                  <select className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                    <option value="5">5 miles</option>
                    <option value="10">10 miles</option>
                    <option value="15">15 miles</option>
                    <option value="20">20 miles</option>
                  </select>
                </div>
                <div className="flex items-end">
                <button onClick={() => {/* Apply filters */}}
                    className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Map Container */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Store Locations & Prices</h2>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              ) : stores.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No stores found in your area</p>
                </div>
              ) : (
                <>
                  {/* Map placeholder - would be actual map in production */}
                  <div className="h-96 bg-gray-200 rounded-lg mb-4 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      Map visualization would appear here
                      <br />
                      <span className="text-xs">(Integrate with Google Maps or Mapbox)</span>
                    </div>
                  </div>

                  {/* Store List */}
                  <div className="space-y-4">
                    {stores.map((store) => (
                      <div key={store.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-300">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-2">
                              <h3 className="text-lg font-medium text-gray-900 flex-1">
                                {store.name}
                              </h3>
                              <span className={
                                "ml-2 px-2 py-0.5 text-xs font-medium " +
                                (store.priceIndex <= 85 ? 'bg-green-100 text-green-800' :
                                 store.priceIndex <= 95 ? 'bg-yellow-100 text-yellow-800' :
                                 'bg-red-100 text-red-800')
                              }>
                                {store.priceIndex}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mb-1">
                              {store.chain || ''} · {store.city}, {store.state}
                            </p>
                            <p className="text-sm text-gray-500">
                              {store.recentScans} recent price scans
                            </p>
                          </div>
                          <div className="text-right space-x-2">
                            <button onClick={() => setSelectedStore(store)}
                              className="px-3 py-1 text-sm font-medium transition-colors duration-200"
                              >
                              Details
                              <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Store Details Modal (simplified) */}
          {selectedStore && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg w-96 max-w-full p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedStore.name}
                  </h2>
                  <button onClick={() => setSelectedStore(null)}
                    className="text-gray-400 hover:text-gray-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Store Information</h3>
                    <p className="text-sm text-gray-500">
                      <strong>Address:</strong> {selectedStore.address || 'Not available'}
                    </p>
                    <p className="text-sm text-gray-500">
                      <strong>City, State:</strong> {selectedStore.city}, {selectedStore.state} {selectedStore.zip}
                    </p>
                    <p className="text-sm text-gray-500">
                      <strong>Phone:</strong> {selectedStore.phone || 'Not available'}
                    </p>
                    <p className="text-sm text-gray-500">
                      <strong>Hours:</strong> {selectedStore.hours || 'Not available'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Price Analysis</h3>
                    <p className="text-sm text-gray-500">
                      <strong>Price Index:</strong>
                      <span className={selectedStore.priceIndex <= 85 ? 'text-green-600 font-medium' :
                         selectedStore.priceIndex <= 95 ? 'text-yellow-600 font-medium' :
                         'text-red-600 font-medium'}>
                        {selectedStore.priceIndex}/100
                      </span>
                      (Lower is better)
                    </p>
                    <p className="text-sm text-gray-500">
                      <strong>Recent Scans:</strong> {selectedStore.recentScans} items
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Based on {selectedStore.recentScans} recent price scans from users in your area
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={() => setSelectedStore(null)}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Close
                  </button>
 <button onClick={() => {/* Navigate to store deals */}}
                    className="ml-4 px-4 py-2 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                    View Deals
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}