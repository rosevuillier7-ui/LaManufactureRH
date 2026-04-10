import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code || searchParams.get("error")) {
    return NextResponse.redirect(new URL("/podcast?yt_error=1", origin));
  }

  const redirectUri = `${origin}/api/youtube/auth/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/podcast?yt_error=1", origin));
  }

  const tokens = await tokenRes.json();
  const response = NextResponse.redirect(new URL("/podcast?yt_connected=1", origin));

  const cookieBase = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  response.cookies.set("yt_access_token", tokens.access_token, {
    ...cookieBase,
    maxAge: tokens.expires_in ?? 3600,
  });

  if (tokens.refresh_token) {
    response.cookies.set("yt_refresh_token", tokens.refresh_token, {
      ...cookieBase,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
