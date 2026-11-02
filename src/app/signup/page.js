'use client';

import { useState } from 'react';
import { createClient } from '../supabase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [favoriteStore, setFavoriteStore] = useState('');
  const [values, setValues] = useState([]);
  const [location, setLocation] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Password validation regex: at least 8 chars, one uppercase, one lowercase, one number, one special char
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Basic validation
    if (!email || !password || !name) {
      setError('Please fill in all required fields');
      return;
    }
    if (!passwordRegex.test(password)) {
      setError('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            favorite_store: favoriteStore,
            values: values,
            location: location,
          }
        }
      });

      if (authError) throw authError;

      // Show success message and redirect to login after a short delay
      setError('Account created! Please check your email to confirm your account.');
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      // Handle duplicate email error from Supabase
      if (err.message.includes('duplicate')) {
        setError('An account with this email already exists. Please try logging in.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <svg className="h-5 w-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CartWise
              </h1>
            </div>

            <div className="mt-4 flex md:mt-0 md:ml-6">
              <Link href="/" className="flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <span className="mr-2">Home</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L14 5.414V13a1 1 0 01-2 0V5.414L8.293 7.707a1 1 0 010-1.414l6-6z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M4 9h2v7H4V9zm4 0h2v7H8V9zm4 0h2v7h-2V9z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-foreground mb-4">Sign Up</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-400 dark:text-gray-500 mb-1">
                    Full Name
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
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
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Must be at least 8 characters with uppercase, lowercase, number, and special character (@$!%*?&)
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="favoriteStore" className="block text-sm font-medium text-gray-700 mb-1">
                    Favorite Store
                  </label>
                  <select
                    id="favoriteStore"
                    value={favoriteStore}
                    onChange={(e) => setFavoriteStore(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Select a store</option>
                    <option value="walmart">Walmart</option>
                    <option value="target">Target</option>
                    <option value="kroger">Kroger</option>
                    <option value="costco">Costco</option>
                    <option value="aldi">Aldi</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Values (check all that apply)
                  </label>
                  <div className="space-y-1">
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        checked={values.includes('eco-friendly')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setValues([...values, 'eco-friendly']);
                          } else {
                            setValues(values.filter(v => v !== 'eco-friendly'));
                          }
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        aria-label="Eco-friendly"
                      />
                      <span className="ml-2 text-sm text-gray-400 dark:text-gray-500">Eco-friendly</span>
                    </label>
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        checked={values.includes('budget')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setValues([...values, 'budget']);
                          } else {
                            setValues(values.filter(v => v !== 'budget'));
                          }
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        aria-label="Budget-conscious"
                      />
                      <span className="ml-2 text-sm text-gray-700">Budget-conscious</span>
                    </label>
                    <label className="flex items-start">
                      <input
                        type="checkbox"
                        checked={values.includes('convenience')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setValues([...values, 'convenience']);
                          } else {
                            setValues(values.filter(v => v !== 'convenience'));
                          }
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                        aria-label="Convenience-focused"
                      />
                      <span className="ml-2 text-sm text-gray-700">Convenience-focused</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                    Location (City)
                  </label>
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                {error && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-600 text-green-500 dark:text-green-400 px-4 py-3 rounded-md">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center px-6 py-3 bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 text-white font-medium rounded-lg shadow-md transition-all transform hover:scale-105"
                >
                  {loading ? 'Creating account...' : 'Sign Up'}
                </button>
              </form>

              <div className="text-center mt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Already have an account?{' '}
                  <Link href="/login" className="font-medium text-indigo-400 dark:text-indigo-300 hover:text-indigo-500 dark:hover:text-indigo-300">
                    Sign In
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}