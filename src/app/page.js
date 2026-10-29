'use client';

import { useState, useEffect } from 'react';
import { createClient } from './supabase';
import Link from 'next/link';

export default function Home() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [stats, setStats] = useState({
    totalSaved: 0,
    timeSaved: 0,
    tripsSaved: 0,
    mealsPlanned: 0
  });

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) { setAuthReady(true); return; }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthReady(true);
      fetchUserStats(data.user?.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserStats(session.user.id);
      } else {
        setStats({
          totalSaved: 0,
          timeSaved: 0,
          tripsSaved: 0,
          mealsPlanned: 0
        });
      }
    });

    return () => listener?.subscription?.unsubscribe();
  }, []);

  const fetchUserStats = async (userId) => {
    if (!userId) return;

    try {
      const supabase = createClient();
      if (!supabase) return;

      // Get total savings from receipts
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('total_savings')
        .eq('user_id', userId);

      // Get pantry items count
      const { data: pantryItems, error: pantryError } = await supabase
        .from('pantry_items')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .eq('still_have', true);

      // Get meal plans count
      const { data: mealPlans, error: mealError } = await supabase
        .from('meal_plans')
        .select('id', { count: 'exact' })
        .eq('user_id', userId);

      // Calculate totals
      const totalSaved = receipts?.reduce((sum, receipt) => sum + (receipt.total_savings || 0), 0) || 0;
      const timeSaved = totalSaved * 0.5; // Estimate: 30 seconds saved per dollar
      const tripsSaved = Math.floor(totalSaved / 10); // Estimate: 1 trip saved per $10
      const mealsPlanned = mealPlans?.length || 0;

      setStats({
        totalSaved,
        timeSaved: Math.round(timeSaved),
        tripsSaved,
        mealsPlanned
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (!authReady) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">CartWise</h1>
          <p className="text-lg text-gray-500">Smart Grocery Shopping Assistant</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-xl mx-auto py-16 px-4 sm:py-20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">CartWise</h1>
            <p className="text-lg text-gray-600">Smart Grocery Shopping Assistant</p>

            <div className="space-y-4">
              <Link href="/login" className="w-full">
                <button className="w-full flex items-center justify-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition-all transform hover:scale-105">
                  Sign In
                </button>
              </Link>
              <Link href="/signup" className="w-full">
                <button className="w-full flex items-center justify-center px-6 py-3 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-lg border border-green-200 hover:border-green-300 transition-all transform hover:scale-105">
                  Sign Up
                </button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-gray-900">
                Welcome back, {user.email.split('@')[0]}!
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Your smart grocery assistant
              </p>
            </div>

            <div className="mt-4 flex md:mt-0 md:ml-6">
                <button onClick={() => {
                  const supabase = createClient();
                  if (supabase) {
                    supabase.auth.signOut();
                    window.location.reload();
                  }
                }}
                className="flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <span className="mr-2">Dashboard</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.061.06L12 11.04l-2.17 2.296a.75.75 0 01-1.06-.02L9 9.417V15a.75.75 0 01-1.5 0V9.417z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="px-4 sm:px-6 lg:px-8">
        <h2 className="sr-only">Dashboard Statistics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-5 pb-12">
          {/* Total Saved */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 flex items-center justify-center bg-green-100 rounded-md">
                    <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 2a.5.5 0 01-.35-.146L8 12l-2-2a.5.5 0 11.707-.707L9 10.293l2.646-2.647a.5.5 0 01.707.708L11 12l2 2a.5.5 0 01-.707.708L11 12.707z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Saved</dt>
                    <dd className="mt-1 text-2xl font-extrabold text-gray-900">${stats.totalSaved.toFixed(2)}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Time Saved */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 flex items-center justify-center bg-blue-100 rounded-md">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Time Saved</dt>
                    <dd className="mt-1 text-2xl font-extrabold text-gray-900">{stats.timeSaved} min</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Trips Saved */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 flex items-center justify-center bg-purple-100 rounded-md">
                    <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Trips Saved</dt>
                    <dd className="mt-1 text-2xl font-extrabold text-gray-900">{stats.tripsSaved}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Meals Planned */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 flex items-center justify-center bg-indigo-100 rounded-md">
                    <svg className="h-5 w-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Meals Planned</dt>
                    <dd className="mt-1 text-2xl font-extrabold text-gray-900">{stats.mealsPlanned}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="sr-only">Features</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-5">
          {/* Receipt Scanner */}
          <Link href="/scan" className="group">
            <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-xl transition-shadow duration-300 transform hover:-scale-105">
              <div className="px-6 py-8">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 flex items-center justify-center bg-green-100 rounded-lg">
                    <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-medium text-gray-900">Scan Receipt</h3>
                </div>
                <p className="text-sm text-gray-500">
                  Upload receipts to extract items and find savings
                </p>
                <div className="mt-6 flex items-center px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg">
                  Scan & Save
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Price Comparer */}
          <Link href="/compare" className="group">
            <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-xl transition-shadow duration-300 transform hover:-scale-105">
              <div className="px-6 py-8">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 flex items-center justify-center bg-blue-100 rounded-lg">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-medium text-gray-900">Compare Prices</h3>
                </div>
                <p className="text-sm text-gray-500">
                  Find the best prices for individual items
                </p>
                <div className="mt-6 flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">
                  Compare & Save
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Price Map */}
          <Link href="/map" className="group">
            <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-xl transition-shadow duration-300 transform hover:-scale-105">
              <div className="px-6 py-8">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 flex items-center justify-center bg-purple-100 rounded-lg">
                    <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-medium text-gray-900">Price Map</h3>
                </div>
                <p className="text-sm text-gray-500">
                  Visualize prices across stores in your area
                </p>
                <div className="mt-6 flex items-center px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg">
                  View Map
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Meal Planner */}
          <Link href="/meal-planner" className="group">
            <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-xl transition-shadow duration-300 transform hover:-scale-105">
              <div className="px-6 py-8">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 flex items-center justify-center bg-indigo-100 rounded-lg">
                    <svg className="h-6 w-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-medium text-gray-900">Meal Planner</h3>
                </div>
                <p className="text-sm text-gray-500">
                  Get meal ideas based on your pantry and deals
                </p>
                <div className="mt-6 flex items-center px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg">
                  Plan Meals
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Trip Calculator */}
          <Link href="/trip-calculator" className="group">
            <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-xl transition-shadow duration-300 transform hover:-scale-105">
              <div className="px-6 py-8">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 flex items-center justify-center bg-amber-100 rounded-lg">
                    <svg className="h-6 w-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l3 3 4-4M5 7.416A11.941 11.941 0 0112 4c2.07 0 4.05.5 5.8 1.416M5 19.416A11.941 11.941 0 0012 20c2.07 0 4.05-.5 5.8-1.416" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-medium text-gray-900">Trip Calculator</h3>
                </div>
                <p className="text-sm text-gray-500">
                  Calculate optimal shopping routes to save time & gas
                </p>
                <div className="mt-6 flex items-center px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 rounded-lg">
                  Calculate Route
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* Settings */}
          <Link href="/settings" className="group">
            <div className="bg-white overflow-hidden shadow rounded-lg hover:shadow-xl transition-shadow duration-300 transform hover:-scale-105">
              <div className="px-6 py-8">
                <div className="flex items-center mb-4">
                  <div className="h-12 w-12 flex items-center justify-center bg-gray-100 rounded-lg">
                    <svg className="h-6 w-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-1.756.426-2.924.426-3.35 0a1.724 1.724 0 00-2.573-1.066c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 00-1.066-2.573c-.426-1.756-.426-2.924 0-3.35a1.724 1.724 0 001.066-2.573z" />
                    </svg>
                  </div>
                  <h3 className="ml-4 text-lg font-medium text-gray-900">Settings</h3>
                </div>
                <p className="text-sm text-gray-500">
                  Customize your preferences and profile
                </p>
                <div className="mt-6 flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg">
                  Manage Settings
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="sr-only">Recent Activity</h2>
        <div className="mt-10">
          <h3 className="sr-only">Recent Activity</h3>
          <div className="space-y-6">
            {/* Placeholder for recent activity cards */}
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 flex items-center justify-center bg-green-100 rounded-md">
                      <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.758 0 3.42 3.42 0 001.946.806 3.42 3.42 0 014.758 0 3.42 3.42 0 001.946.806 3.42 3.42 0 014.758 0V5a1 1 0 00-1-1H2a1 1 0 00-1 1v14a1 1 0 001 1h3.5a1 1 0 001 1v2a1 1 0 001 1h4a1 1 0 001 1v-1.5a1 1 0 00-1-1H3a1 1 0 00-1-1V6a1 1 0 001-1h3.5a1 1 0 001-1V4.697z" />
                      </svg>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-medium text-gray-900">
                      New savings opportunity found!
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      You could save $2.50 on milk at Store B vs Store A
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}