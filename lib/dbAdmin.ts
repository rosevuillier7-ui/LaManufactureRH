import "server-only";

// Service-role database writes. Kept OUT of lib/db.ts on purpose: lib/db.ts is
// imported by Client Components, and importing the service-role client into the
// browser bundle crashes the app ("supabaseKey is required"). Anything here is
// server-only and must be called only from API routes / route handlers.

import { getSupabaseAdmin } from "./supabaseAdmin";

// Persist the recruitment source. Written via the service-role client so the
// update is never blocked by RLS. An empty/blank value clears the column.
export async function updatePlacementSource(id: string, source: string): Promise<void> {
  const trimmed = source.trim();
  const { error } = await getSupabaseAdmin()
    .from("placements")
    .update({ source: trimmed || null })
    .eq("id", id);
  if (error) throw error;
}
