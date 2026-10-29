'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [user, setUser] = useState(null);
  const [authReadyState, setReadyState] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingsData, setSavingsData] = useState([]);
  const [pantryStats, setPantryStats] = useState({});
  const [badges, setBadges] = useState([]);
  const [editingProfile, setEditingProfile] = useState(false);
  // Auth state variables
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  // Form state
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

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setReadyState(true); return; }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReadyState(true);
      fetchProfile(data.user?.id);
      fetchAnalytics(data.user?.id);
      fetchBadges(data.user?.id);
    });

    const listener = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchAnalytics(session.user.id);
        fetchBadges(session.user.id);
      } else {
        setProfile(null);
        setSavingsData([]);
        setPantryStats({});
        setBadges([]);
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

  const fetchProfile = async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
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

  const fetchAnalytics = async (userId) => {
    if (!userId) return;

    try {
      const supabase = createClient();
      if (!supabase) return;

      // Fetch savings data (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: savingsData, error: savingsError } = await supabase
        .from('savings_events')
        .select('amount_cents, baseline, event_type, context, created_at')
        .eq('user_id', userId)
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });

      if (!savingsError) {
        // Format data for charts
        const formattedData = savingsData.map(event => ({
          date: new Date(event.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          amount: event.amount_cents / 100,
          type: event.event_type || 'other'
        }));
        setSavingsData(formattedData);
      }

      // Fetch pantry stats
      const { data: pantryItems, error: pantryError } = await supabase
        .from('pantry_items')
        .select('item_name, estimated_price_cents, still_have, expires_at')
        .eq('user_id', userId);

      if (!pantryError) {
        const totalItems = pantryItems.length;
        const availableItems = pantryItems.filter(item => item.still_have).length;
        const totalValue = pantryItems.reduce((sum, item) => sum + (item.estimated_price_cents || 0), 0) / 100;
        const expiringSoon = pantryItems.filter(item =>
          item.expires_at &&
          new Date(item.expires_at) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // Next 3 days
        ).length;

        setPantryStats({
          totalItems,
          availableItems,
          totalValue: totalValue.toFixed(2),
          expiringSoon
        });
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const fetchBadges = async (userId) => {
    if (!userId) return;

    try {
      const supabase = createClient();
      if (!supabase) return;

      const { data: userBadges, error: badgesError } = await supabase
        .from('user_badges')
        .select(`
          badge_id,
          badges (
            key,
            name,
            description,
            icon,
            tier
          )
        `)
        .eq('user_id', userId)
        .order('awarded_at', { ascending: false });

      if (!badgesError) {
        setBadges(userBadges.map(ub => ({
          ...ub.badges,
          awardedAt: ub.awarded_at
        })));
      }
    } catch (err) {
      console.error('Error fetching badges:', err);
    }
  };

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

  if (!authReadyState) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-500 to-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-1.756.426-2.924.426-3.35 0a1.724 1.724 0 00-2.573-1.066c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 001.066-2.573z" />
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-1.756.426-2.924.426-3.35 0a1.724 1.724 0 00-2.573 1.066c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 00-1.066-2.573c-.426-1.756-.426-2.924 0-3.35a1.724 1.724 0 001.066-2.573z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
            <p className="text-lg text-gray-600">
              Customize your preferences and profile
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
                <svg className="h-5 w-5 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-1.756.426-2.924.426-3.35 0a1.724 1.724 0 00-2.573-1.066c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 00-1.066-2.573c-.426-1.756-.426-2.924 0-3.35a1.724 1.724 0 001.066-2.573z" />
                </svg>
                Settings
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
          {/* Profile Section */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Profile</h2>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              ) : (
                <div>
                  {!editingProfile && (
                    <div className="mb-6">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 flex items-center justify-center bg-gray-200 rounded-full">
                            {profile.display_name ? profile.display_name.charAt(0).toUpperCase() : '?'}
                          </div>
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">
                            {profile.display_name || user.email.split('@')[0]}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {profile.email || user.email}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="flex items-center">
                          <span className="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-blue-100 rounded-full text-blue-600">
                            ðŸ‘¨â€ðŸ‘©â€ðŸ‘§â€ðŸ‘¦
                          </span>
                          <span className="ml-3">
                            <p className="text-sm font-medium text-gray-700">Household Size</p>
                            <p className="text-sm font-medium text-gray-900">{profile.household_size}</p>
                          </span>
                        </div>

                        <div className="flex items-center">
                          <span className="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-green-100 rounded-full text-green-600">
                            ðŸ›’
                          </span>
                          <span className="ml-3">
                            <p className="text-sm font-medium text-gray-700">Shopping Style</p>
                            <p className="text-sm font-medium text-gray-900">
                              {profile.shopping_style.charAt(0).toUpperCase() + profile.shopping_style.slice(1)}
                            </p>
                          </span>
                        </div>

                        <div className="flex items-center">
                          <span className="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-purple-100 rounded-full text-purple-600">
                            ðŸ“
                          </span>
                          <span className="ml-3">
                            <p className="text-sm font-medium text-gray-700">Search Radius</p>
                            <p className="text-sm font-medium text-gray-900">{profile.max_radius_miles} miles</p>
                          </span>
                        </div>
                      </div>

                      <div className="mt-6">
                        <button onClick={() => setEditingProfile(true)}
                          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                          Edit Profile
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
                  {editingProfile && (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveProfile();
                    }} className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Display Name</label>
                        <input
                          type="text"
                          name="display_name"
                          value={formState.display_name}
                          onChange={handleInputChange}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Avatar URL (optional)</label>
                        <input
                          type="text"
                          name="avatar_url"
                          value={formState.avatar_url}
                          onChange={handleInputChange}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Friend Code</label>
                        <input
                          type="text"
                          name="friend_code"
                          value={formState.friend_code}
                          onChange={handleInputChange}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Household Size</label>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          name="household_size"
                          value={formState.household_size}
                          onChange={handleInputChange}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Diet Preferences</label>
                        <div className="flex flex-wrap gap-2">
                          {['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'halal', 'kosher'].map((diet) => (
                            <label key={diet} className="flex items-center">
                              <input
                                type="checkbox"
                                value={diet}
                                checked={formState.diet_tags.includes(diet)}
                                onChange={(e) => {
                                  const tags = formState.diet_tags;
                                  if (e.target.checked) {
                                    setFormState(prev => ({
                                      ...prev,
                                      diet_tags: [...prev.diet_tags, diet]
                                    }));
                                  } else {
                                    setFormState(prev => ({
                                      ...prev,
                                      diet_tags: prev.diet_tags.filter(tag => tag !== diet)
                                    }));
                                  }
                                }}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm">{diet}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Brands to Avoid</label>
                        <input
                          type="text"
                          name="avoid_brands"
                          placeholder="Comma-separated (e.g., Nestle, Monsanto)"
                          value={formState.avoid_brands.join(', ')}
                          onChange={(e) => {
                            const brands = e.target.value
                              .split(',')
                              .map(b => b.trim())
                              .filter(b => b.length > 0);
                            setFormState(prev => ({
                              ...prev,
                              avoid_brands: brands
                            }));
                          }}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Favorite Brands</label>
                        <input
                          type="text"
                          name="favorite_brands"
                          placeholder="Comma-separated (e.g., Organic Valley, Tillamook)"
                          value={formState.favorite_brands.join(', ')}
                          onChange={(e) => {
                            const brands = e.target.value
                              .split(',')
                              .map(b => b.trim())
                              .filter(b => b.length > 0);
                            setFormState(prev => ({
                              ...prev,
                              favorite_brands: brands
                            }));
                          }}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Favorite Stores</label>
                        <input
                          type="text"
                          name="favorite_stores"
                          placeholder="Comma-separated (e.g., Whole Foods, Trader Joe's)"
                          value={formState.favorite_stores.join(', ')}
                          onChange={(e) => {
                            const stores = e.target.value
                              .split(',')
                              .map(s => s.trim())
                              .filter(s => s.length > 0);
                            setFormState(prev => ({
                              ...prev,
                              favorite_stores: stores
                            }));
                          }}
                          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>

                      <div className="mb-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Shopping Style</label>
                          <select
                            name="shopping_style"
                            value={formState.shopping_style}
                            onChange={handleInputChange}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          >
                            <option value="balanced">Balanced</option>
                            <option value="savings-focused">Savings Focused</option>
                            <option value="time-focused">Time Focused</option>
                            <option value="quality-focused">Quality Focused</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Max Search Radius (miles)</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            name="max_radius_miles"
                            value={formState.max_radius_miles}
                            onChange={handleInputChange}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Gas Cost per Mile ($)</label>
                          <input
                            type="number"
                            min="0.1"
                            max="2.0"
                            step="0.01"
                            name="gas_cost_per_mile"
                            value={formState.gas_cost_per_mile}
                            onChange={handleInputChange}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Public Profile</label>
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              name="public_profile"
                              checked={formState.public_profile}
                              onChange={handleInputChange}
                              className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm">Allow others to see your profile</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex justify-end space-x-3">
                        <button type="button"
                          onClick={() => setEditingProfile(false)}
                          className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                          Cancel
                        </button>
                        <button type="submit"
                          className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                          Save Changes
                        </button>
                      </div>
                    </form>
                  )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
