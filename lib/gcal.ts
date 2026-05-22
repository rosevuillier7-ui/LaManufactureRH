// Central Google Calendar account + token module.
//
// Tokens for each Google account ("flaubert", "claire") live in the
// `google_accounts` Supabase table and are read/written ONLY through the
// service-role client (lib/supabaseAdmin) so refresh tokens never reach the
// browser. All gcal API routes resolve their access token through here.
//
// PRODUCTION DEPENDENCY: while the Google Cloud OAuth consent screen is in
// "Testing" mode, Google expires refresh tokens after 7 days, so each account
// will need to be reconnected weekly (getValidAccessToken throws
// GcalReconnectError). Publishing the app to "Production" removes that expiry.
// `access_type=offline` + `prompt=consent` in the login route are what
// guarantee a refresh token is issued in the first place — keep them.

import { getSupabaseAdmin } from "./supabaseAdmin";

export type AccountKey = "flaubert" | "claire";

export const ACCOUNT_KEYS: AccountKey[] = ["flaubert", "claire"];
export const ACCOUNT_LABELS: Record<AccountKey, string> = {
  flaubert: "Flaubert",
  claire: "Claire",
};

const DEFAULT_ACCOUNT: AccountKey = "flaubert";

/** Coerce an untrusted value into a valid AccountKey, defaulting to flaubert. */
export function parseAccountKey(value: unknown): AccountKey {
  return value === "claire" ? "claire" : DEFAULT_ACCOUNT;
}

/** Thrown when an account has no usable refresh token (never connected, or
 *  Google rejected the refresh — revoked / expired). The UI should prompt a
 *  reconnect for `account`. */
export class GcalReconnectError extends Error {
  account: AccountKey;
  constructor(account: AccountKey, message?: string) {
    super(message ?? `Compte Google "${ACCOUNT_LABELS[account]}" à reconnecter`);
    this.name = "GcalReconnectError";
    this.account = account;
  }
}

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// Refresh a little before the real expiry to avoid races near the boundary.
const EXPIRY_BUFFER_MS = 60_000;

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

/** Exchange an OAuth authorization code for tokens (used by the callback). */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;
  return (await res.json()) as GoogleTokenResponse;
}

/** Read the primary calendar's id, which equals the account's email address.
 *  Works with the calendar scope alone — no extra userinfo scope needed. */
export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return (data.id as string) ?? null;
}

/** Persist tokens for an account. refresh_token is only written when present
 *  (Google omits it on refresh responses — we must not clobber the stored one). */
export async function saveTokens(
  account: AccountKey,
  tokens: { access_token?: string; refresh_token?: string; expires_in?: number; email?: string | null }
): Promise<void> {
  const row: Record<string, unknown> = {
    account_key: account,
    updated_at: new Date().toISOString(),
  };
  if (tokens.access_token !== undefined) row.access_token = tokens.access_token;
  if (tokens.refresh_token) row.refresh_token = tokens.refresh_token;
  if (tokens.expires_in !== undefined) {
    row.expires_at = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  }
  if (tokens.email !== undefined) row.email = tokens.email;

  const { error } = await getSupabaseAdmin()
    .from("google_accounts")
    .upsert(row, { onConflict: "account_key" });
  if (error) throw error;
}

/** Return a valid access token for `account`, refreshing if expired.
 *  Throws GcalReconnectError when there is no refresh token or the refresh is
 *  rejected by Google. */
export async function getValidAccessToken(account: AccountKey): Promise<string> {
  const { data: row, error } = await getSupabaseAdmin()
    .from("google_accounts")
    .select("access_token, refresh_token, expires_at")
    .eq("account_key", account)
    .maybeSingle();
  if (error) throw error;

  if (!row || !row.refresh_token) {
    throw new GcalReconnectError(account);
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const stillValid = row.access_token && expiresAt - EXPIRY_BUFFER_MS > Date.now();
  if (stillValid) return row.access_token as string;

  // Access token missing or expired — refresh it.
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: row.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    // 400/401 here means the refresh token is revoked or expired.
    throw new GcalReconnectError(account, "Session Google expirée");
  }

  const data = (await res.json()) as GoogleTokenResponse;
  if (!data.access_token) throw new GcalReconnectError(account, "Session Google expirée");

  await saveTokens(account, {
    access_token: data.access_token,
    refresh_token: data.refresh_token, // usually absent; saveTokens ignores undefined
    expires_in: data.expires_in,
  });

  return data.access_token;
}

export interface AccountStatus {
  key: AccountKey;
  connected: boolean;
  email: string | null;
}

/** Connection status for every account, for the "Comptes Google" UI.
 *  `connected` means a refresh token is stored (the durable credential). */
export async function getAccountsStatus(): Promise<AccountStatus[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("google_accounts")
    .select("account_key, refresh_token, email");
  if (error) throw error;

  const byKey = new Map(
    (data ?? []).map((r) => [r.account_key as string, r])
  );

  return ACCOUNT_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      connected: !!row?.refresh_token,
      email: (row?.email as string) ?? null,
    };
  });
}
