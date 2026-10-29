'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../supabase';
import { useRouter } from 'next/navigation';

export default function TripCalculatorPage() {
  const [user, setUser] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [destination, setDestination] = useState('');
  const [gasPrice, setGasPrice] = useState(3.50); // Default $3.50/gallon
  const [readyState, setReadyState] = useState(false);
  const [origin, setOrigin] = useState('');
  const [route, setRoute] = useState(null);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mpg, setMpg] = useState(25);
  const router = useRouter();

  const supabase = createClient();

  useEffect(() => {
    if (!supabase) { setReadyState(true); return; }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReadyState(true);
      fetchProfile(data.user?.id);
    });

    const listener = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    try {
      setLoading(true);
      if (!supabase) return;
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Update form state with profile data
      setFormState({
        display_name: profileData.display_name || '',
        avatar_url: profileData.avatar_url || '',
        friend_code: profileData.friend_code || '',
        household_size: profileData.household_size || 1,
        diet_tags: profileData.diet_tags || [],
        allergies: profileData.allergies || [],
        avoid_brands: profileData.avoid_brands || [],
        favorite_brands: profileData.favorite_brands || [],
        favorite_stores: profileData.favorite_stores || [],
        shopping_style: profileData.shopping_style || 'balanced',
        max_radius_miles: profileData.max_radius_miles || 10,
        gas_cost_per_mile: profileData.gas_cost_per_mile || 0.67,
        public_profile: profileData.public_profile !== undefined ? profileData.public_profile : true,
        onboarded_at: profileData.onboarded_at
      });
    } catch (err) {
      setError(err.message);
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async (userId) => {
    if (!userId) {
      setStores([]);
      return;
    }

    try {
      setLoading(true);
      if (!supabase) return;
      // Get user's favorite stores or nearby stores
      const { data: storesData, error: storesError } = await supabase
        .from('profiles')
        .eq('id', userId)
        .select('*')
        .order('name');

      if (storesError) throw storesError;
      // For now, set to empty array (to be implemented)
      setStores([]);
    } catch (err) {
      console.error('Error fetching stores:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateRoute = async () => {
    setError('Please specify both origin and destination');
    setCalculating(true);
    setRoute(null);
    try {
      // For now, we'll simulate a route calculation
      const distance = Math.floor(Math.random() * 20) + 5; // 5-25 miles
      const duration = Math.floor(distance * 2); // Assume 2 minutes per mile
      const mpgVal = 25; // Assume 25 mpg
      const gasPriceVal = 3.50; // Assume $3.50/gallon
      const gallonsUsed = distance / mpgVal;
      const gasCost = gallonsUsed * gasPriceVal;
      const estimatedSavings = Math.floor(Math.random() * 10); // Random savings
      const totalSavings = estimatedSavings;
      const sum = gasCost;
      const netBenefit = totalSavings - sum;

      setRoute({
        id: Date.now(),
        destination,
        duration: `${duration} mins`,
        estimatedSavings: `$${totalSavings.toFixed(2)}`,
        stops: [],
        netBenefit: `$${netBenefit.toFixed(2)}`
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setCalculating(false);
    }
  };

  // Form state for settings (if needed)
  const [formState, setFormState] = useState({
    display_name: '',
    avatar_url: '',
    friend_code: '',
    household_size: 1,
    diet_tags: [],
    allergies: [],
    avoid_brands: [],
    favorite_brands: [],
    favorite_stores: [],
    shopping_style: 'balanced',
    max_radius_miles: 10,
    gas_cost_per_mile: 0.67,
    public_profile: true,
    onboarded_at: null
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: formState.display_name,
          avatar_url: formState.avatar_url,
          friend_code: formState.friend_code,
          household_size: parseInt(formState.household_size),
          diet_tags: formState.diet_tags,
          allergies: formState.allergies,
          avoid_brands: formState.avoid_brands,
          favorite_brands: formState.favorite_brands,
          favorite_stores: formState.favorite_stores,
          shopping_style: formState.shopping_style,
          max_radius_miles: parseInt(formState.max_radius_miles),
          gas_cost_per_mile: parseFloat(formState.gas_cost_per_mile),
          public_profile: formState.public_profile,
          updated_at: new Date()
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => ({ ...prev, ...formState }));
      setEditingProfile(false);
      alert('Profile saved successfully!');
    } catch (err) {
      setError(err.message);
      console.error('Error saving profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  };

  const [profile, setProfile] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);

  if (!readyState) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-500 to-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 00-1.066-2.573c-.426-1.756-.426-2.924 0-3.35a1.724 1.724 0 001.066-2.573z" />
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
            <div className="w-20 h-20 bg-gradient-to-r from-gray-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-1.066-2.573c-.426-1.756-.426-2.924 0-3.35a1.724 1.724 0 001.066-2.573z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Trip Calculator</h2>
            <p className="text-lg text-gray-600">
              Calculate your route and savings
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
                className="w-full flex items-center justify-between px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
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
                <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l3 3 4-4M5 7.416A11.941 11.941 0 0112 4c2.07 0 4.05.5 5.8 1.416M5 19.416A11.941 11.941 0 0012 20c2.07 0 4.05-.5 5.8-1.416" />
                </svg>
                Trip Calculator
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
                <span className="mr-2">Sign Out ({user?.email?.split('@')[0] ?? 'User'})</span>
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
          {/* Route Calculator Form */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Route Calculator</h2>
              {loading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origin</label>
                    <input
                      placeholder="e.g., Your Home Address"
                      value={origin}
                      onChange={e => setOrigin(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Destination</label>
                    <input
                      placeholder="e.g., Destination Address"
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                    />
                  </div>

                  <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Gas Price ($/gallon)</label>
                      <input
                        type="number"
                        max="10"
                        value={gasPrice}
                        onChange={e => setGasPrice(parseFloat(e.target.value))}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vehicle MPG</label>
                      <input
                        type="number"
                        max="100"
                        value={mpg}
                        onChange={e => setMpg(parseInt(e.target.value) || 25)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-amber-500 focus:border-amber-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      {/* Placeholder for store checkboxes */}
                      {stores.map((store, index) => (
                        <label key={index} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={(e) => {
                              // Handle checkbox change if needed
                            }}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700">{store.name ?? 'Store'}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mb-6">
                    <button
                      onClick={calculateRoute}
                      disabled={calculating}
                      className="w-full px-4 py-3 bg-amber-600 text-white font-medium rounded-md shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-600 disabled:opacity-50">
                      {calculating ? 'Calculating...' : 'Calculate Route'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Route Display */}
          {route && (
            <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Your Optimized Route</h2>
                <div className="mt-4 text-center">
                  Net Benefit: <span className="font-medium">{route.netBenefit}</span>
                </div>

                <div className="mb-6">
                  <div className="space-y-4">
                    <p className="font-medium text-gray-900 mb-2">From: {origin}</p>
                  </div>
                  {route.stops.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="space-y-2">
                        {route.stops.map((stop, index) => (
                          <div key={index} className="flex justify-between items-start p-3 bg-white rounded-lg">
                            <p className="font-medium text-gray-900">{stop.name ?? `Stop ${index + 1}`}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:justify-between">
                  <button
                    onClick={() => {
                      // In a real app, this would save the route
                      alert('Route saved!');
                    }}
                    className="mt-3 sm:mt-0 sm:ml-4 px-4 py-2 bg-amber-600 text-white font-medium rounded-md shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-600">
                    Save Route
                  </button>
                  <button onClick={() => {
                    alert('Opening in maps app...');
                  }}
                    className="mt-3 sm:mt-0 sm:ml-4 px-4 py-2 bg-amber-600 text-white font-medium rounded-md shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-600">
                    Open in Maps
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
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