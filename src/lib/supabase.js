import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn("Supabase env not set — running in mock mode. Copy .env.example to .env.");
}

// Falls back to null when env is absent, so the app renders with mock data
// instead of crashing during early UI work.
export const supabase = url && key ? createClient(url, key) : null;
export const hasSupabase = !!supabase;
