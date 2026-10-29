'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MealPlannerPage() {
  const [user, setUser] = useState(null);
  const [authReadyState, setReadyState] = useState(false);
  const [pantryItems, setPantryItems] = useState([]);
  const [mealPlan, setMealPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
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
      fetchPantryItems(data.user?.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchPantryItems(session.user.id);
      } else {
        setPantryItems([]);
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

  const fetchPantryItems = async (userId) => {
    if (!userId) {
      setPantryItems([]);
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();
      if (!supabase) return;

      const { data: itemsData, error: itemsError } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', userId)
        .eq('still_have', true)
        .order('purchased_at', { ascending: false });

      if (itemsError) throw itemsError;
      setPantryItems(itemsData || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching pantry items:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateMealPlan = async () => {
    if (pantryItems.length === 0) {
      setError('Add items to your pantry first to generate meal plans');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      // In a real app, this would call an AI service or use a local algorithm
      // For now, we'll create a simple meal plan based on pantry items
      const mealPlan = generateSimpleMealPlan(pantryItems);
      setMealPlan(mealPlan);

      // Save to database (in a real app)
      const supabase = createClient();
      if (supabase && user?.id) {
        await supabase.from('meal_plans').insert({
          user_id: user.id,
          date: date,
          meals: mealPlan,
          created_at: new Date()
        });
      }
    } catch (err) {
      setError(err.message);
      console.error('Error generating meal plan:', err);
    } finally {
      setGenerating(false);
    }
  };

  const generateSimpleMealPlan = (items) => {
    // Group items by type for simple meal suggestions
    const proteins = items.filter(item =>
      ['chicken', 'beef', 'pork', 'fish', 'egg', 'tofu', 'beans'].some(p =>
        item.item_name.toLowerCase().includes(p))
    );

    const vegetables = items.filter(item =>
      ['broccoli', 'spinach', 'carrot', 'pepper', 'onion', 'tomato', 'lettuce'].some(v =>
        item.item_name.toLowerCase().includes(v))
    );

    const grains = items.filter(item =>
      ['rice', 'pasta', 'bread', 'quinoa', 'oats'].some(g =>
        item.item_name.toLowerCase().includes(g))
    );

    const dairy = items.filter(item =>
      ['milk', 'cheese', 'yogurt', 'butter'].some(d =>
        item.item_name.toLowerCase().includes(d))
    );

    // Create simple meal combinations
    const meals = [
      {
        name: 'Breakfast',
        items: [
          ...(eggs.length > 0 ? [{name: 'Eggs', quantity: 2}] : []),
          ...(bread.length > 0 ? [{name: 'Bread', quantity: '2 slices'}] : []),
          ...(fruit.length > 0 ? [{name: 'Fruit', quantity: '1 serving'}] : [])
        ],
        estimatedCost: calculateCost([...eggs, ...bread, ...fruit])
      },
      {
        name: 'Lunch',
        items: [
          ...(proteins.length > 0 ? [{name: proteins[0].item_name, quantity: '4oz'}] : []),
          ...(vegetables.length > 0 ? [{name: vegetables[0].item_name, quantity: '1 cup'}] : []),
          ...(grains.length > 0 ? [{name: grains[0].item_name, quantity: '1/2 cup'}] : [])
        ],
        estimatedCost: calculateCost([...proteins.slice(0,1), ...vegetables.slice(0,1), ...grains.slice(0,1)])
      },
      {
        name: 'Dinner',
        items: [
          ...(proteins.length > 1 ? [{name: proteins[1].item_name, quantity: '4oz'}] : []),
          ...(vegetables.length > 1 ? [{name: vegetables[1].item_name, quantity: '1 cup'}] : []),
          ...(grains.length > 1 ? [{name: grains[1].item_name, quantity: '1/2 cup'}] : []),
          ...(dairy.length > 0 ? [{name: dairy[0].item_name, quantity: '1/2 cup'}] : [])
        ],
        estimatedCost: calculateCost([...proteins.slice(1,2), ...vegetables.slice(1,2), ...grains.slice(1,2), ...dairy.slice(0,1)])
      }
    ].filter(meal => meal.items.length > 0);

    return {
      date,
      meals,
      estimatedTotalCost: meals.reduce((sum, meal) => sum + meal.estimatedCost, 0),
      generatedAt: new Date()
    };
  };

  const calculateCost = (items) => {
    // Simplified cost calculation
    return items.reduce((sum, item) => sum + (item.estimated_price_cents || 100) / 100, 0);
  };

  if (!authReadyState) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-pink-600 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
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
            <div className="w-20 h-20 bg-gradient-to-r from-indigo-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Meal Planner</h2>
            <p className="text-lg text-gray-600">
              Get meal ideas based on your pantry and deals
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
                <svg className="h-5 w-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                </svg>
                Meal Planner
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
        <div className="max-w-3xl mx-auto">
          {/* Pantry Overview */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Your Pantry</h2>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              ) : pantryItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Your pantry is empty. Scan receipts to add items!</p>
                  <Link href="/scan" className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                    Scan Receipt
                    <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    You have {pantryItems.length} items in your pantry
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {pantryItems.slice(0, 8).map((item, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-lg text-center">
                        <div className="flex items-center justify-center h-10 w-10 mb-2 mx-auto bg-white rounded-full shadow">
                          {item.item_name.charAt(0).toUpperCase()}
                        </div>
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {item.item_name}
                        </p>
                        {item.brand && (
                          <p className="text-xs text-gray-500 truncate">{item.brand}</p>
                        )}
                      </div>
                    ))}
                    {pantryItems.length > 8 && (
                      <div className="col-span-4 text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">
                          +{pantryItems.length - 8} more
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Date Selector & Generate Button */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-3 sm:mb-0">
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm sm:w-48"
                />
              </div>
              <div>
                <button onClick={generateMealPlan} disabled={generating || pantryItems.length === 0}
                  className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-50">
                  {generating ? (
                    <>
                      Generating...
                      <svg className="ml-2 h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l4 4" />
                      </svg>
                    </>
                  ) : (
                    <>
                      Generate Meal Plan
                      <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Meal Plan Results */}
          {mealPlan && (
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Meal Plan for {new Date(mealPlan.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </h2>
              </div>
          )}

          {/* Estimated Cost */}
          <div className="mb-6 p-4 bg-indigo-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Estimated Cost</span>
              <span className="text-xl font-bold text-indigo-600">
                ${mealPlan.estimatedTotalCost.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Meals */}
          <div className="space-y-6">
            {mealPlan.meals.map((meal, index) => (
              <div key={index} className="border border-gray-200 rounded-lg">
                <div className="px-4 py-5">
                  <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
                    {meal.name}
                    <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
                      Meal {index + 1}
                    </span>
                  </h3>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {meal.items.map((item, itemIndex) => (
                      <div key={itemIndex} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-start">
                          <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center bg-gray-200 rounded-full">
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.quantity}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Instructions placeholder */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 font-medium">Simple Preparation:</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Combine ingredients and cook according to your preference.
                      For specific recipes, consider using a recipe app or website.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-6 flex flex-col sm:flex-row sm:justify-between">
                    <button onClick={() => {
                      // In a real app, this would save the meal plan
                      alert('Meal plan saved to your history!');
                    }}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                      Save Plan
                    </button>
                    <button onClick={() => {
                      // In a real app, this would generate a shopping list
                      alert('Shopping list generated based on missing ingredients!');
                    }}
                      className="mt-3 sm:mt-0 sm:ml-4 px-4 py-2 bg-indigo-600 text-white font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600">
                      Create Shopping List
                      <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}