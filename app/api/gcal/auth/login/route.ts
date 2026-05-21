import { NextRequest, NextResponse } from "next/server";
import { parseAccountKey } from "@/lib/gcal";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

export async function GET(request: NextRequest) {
  const redirectUri = `${request.nextUrl.origin}/api/gcal/auth/callback`;
  const from = request.nextUrl.searchParams.get("from") ?? "/recrutement/suivi";
  const account = parseAccountKey(request.nextUrl.searchParams.get("account"));

  // Carry both the return path and the target account through OAuth `state`.
  const state = encodeURIComponent(JSON.stringify({ from, account }));

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  // access_type=offline + prompt=consent guarantee a refresh_token is issued.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}
