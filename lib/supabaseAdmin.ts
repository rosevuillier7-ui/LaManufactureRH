import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client built with the service-role key.
// Bypasses RLS — use it ONLY for tables that must never be reachable from the
// browser (e.g. `google_accounts`, which stores Google OAuth refresh tokens).
// NEVER import this into a Client Component.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
