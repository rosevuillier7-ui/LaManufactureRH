import { NextRequest, NextResponse } from "next/server";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export async function GET(request: NextRequest) {
  const redirectUri = `${request.nextUrl.origin}/api/gcal/auth/callback`;
  const from = request.nextUrl.searchParams.get("from") ?? "/recrutement/suivi";

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", encodeURIComponent(from));

  return NextResponse.redirect(url.toString());
}
