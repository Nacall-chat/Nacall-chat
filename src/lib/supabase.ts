import { createClient, type SupabaseClient } from '@supabase/supabase-js';
let instance: SupabaseClient | null = null;
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('YOUR_PROJECT') || key.startsWith('YOUR_')) return null;
  instance ??= createClient(url, key);
  return instance;
}
