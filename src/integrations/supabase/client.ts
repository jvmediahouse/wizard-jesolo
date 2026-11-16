import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { resolveSupabaseConfig } from './config';

// URL and publishable key come from `.env` (VITE_SUPABASE_*), validated in ./config.
const { url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY } = resolveSupabaseConfig(import.meta.env);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
