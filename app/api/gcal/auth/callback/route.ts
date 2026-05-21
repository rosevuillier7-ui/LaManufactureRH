import { NextRequest, NextResponse } from "next/server";
import {
  parseAccountKey,
  exchangeCodeForTokens,
  fetchAccountEmail,
  saveTokens,
  type AccountKey,
} from "@/lib/gcal";

function decodeState(raw: string | null): { from: string; account: AccountKey } {
  if (!raw) return { from: "/recrutement/suivi", account: parseAccountKey(null) };
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return {
      from: typeof parsed.from === "string" ? parsed.from : "/recrutement/suivi",
      account: parseAccountKey(parsed.account),
    };
  } catch {
    // Backward-compat: older state was just the `from` path, plain-encoded.
    return { from: decodeURIComponent(raw), account: parseAccountKey(null) };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const { from, account } = decodeState(searchParams.get("state"));

  const errorUrl = (acc: AccountKey) =>
    new URL(`${from}?gcal_error=1&account=${acc}`, origin);

  if (!code || searchParams.get("error")) {
    return NextResponse.redirect(errorUrl(account));
  }

  const redirectUri = `${origin}/api/gcal/auth/callback`;
  const tokens = await exchangeCodeForTokens(code, redirectUri);

  if (!tokens || !tokens.access_token) {
    return NextResponse.redirect(errorUrl(account));
  }

  // Read the connected account's email from its primary calendar id.
  const email = await fetchAccountEmail(tokens.access_token);

  try {
    await saveTokens(account, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      email,
    });
  } catch {
    return NextResponse.redirect(errorUrl(account));
  }

  return NextResponse.redirect(
    new URL(`${from}?gcal_connected=1&account=${account}`, origin)
  );
}
