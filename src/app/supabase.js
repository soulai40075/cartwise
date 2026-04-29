'use client';
import { createBrowserClient } from '@supabase/ssr';

let client = null;

export function createClient() {
  if (typeof window === 'undefined') return null;
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return client;
}