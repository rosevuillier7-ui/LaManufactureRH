import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client built with the service-role key.
// Bypasses RLS — use it ONLY for tables that must never be reachable from the
// browser (e.g. `google_accounts`, which stores Google OAuth refresh tokens).
//
// Two safeguards keep the service-role key out of the browser bundle:
//   1. `import "server-only"` makes any import from a Client Component a BUILD
//      error, not a silent runtime crash.
//   2. The client is created lazily inside getSupabaseAdmin() — never at module
//      load — so merely importing this file can never throw. It only throws if
//      actually called without the key, which can only happen server-side.

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "getSupabaseAdmin: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
        "The service-role client is server-only and must never run in the browser."
    );
  }

  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
