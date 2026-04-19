import { NextRequest, NextResponse } from "next/server";

const PODCAST_KEYWORDS = ["podcast", "épisode", "episode", "13ème mois", "13eme mois"];

function matchesPodcast(title: string): boolean {
  const lower = title.toLowerCase();
  return PODCAST_KEYWORDS.some((k) => lower.includes(k));
}

async function refreshGcalToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

export async function GET(request: NextRequest) {
  let accessToken = request.cookies.get("gcal_access_token")?.value;
  const refreshToken = request.cookies.get("gcal_refresh_token")?.value;

  let newAccessToken: string | null = null;

  if (!accessToken && refreshToken) {
    const refreshed = await refreshGcalToken(refreshToken);
    if (refreshed) {
      accessToken = refreshed;
      newAccessToken = refreshed;
    }
  }

  if (!accessToken) {
    return NextResponse.json({ connected: false, events: [] });
  }

  const now = new Date().toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", now);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "100");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return NextResponse.json({ connected: false, events: [] });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = (data.items ?? []).filter((e: any) => matchesPodcast(e.summary ?? ""));

  const response = NextResponse.json({ connected: true, events });

  if (newAccessToken) {
    response.cookies.set("gcal_access_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
  }

  return response;
}

export async function POST(request: NextRequest) {
  let accessToken = request.cookies.get("gcal_access_token")?.value;
  const refreshToken = request.cookies.get("gcal_refresh_token")?.value;

  let newAccessToken: string | null = null;

  if (!accessToken && refreshToken) {
    const refreshed = await refreshGcalToken(refreshToken);
    if (refreshed) {
      accessToken = refreshed;
      newAccessToken = refreshed;
    }
  }

  if (!accessToken) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }

  const body = await request.json();
  const { title, date, time, endTime, location, description } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const event: Record<string, any> = {
    summary: title,
    ...(description && { description }),
    ...(location && { location }),
  };

  if (time) {
    const startDt = `${date}T${time}:00`;
    const endDt = endTime ? `${date}T${endTime}:00` : `${date}T${time}:00`;
    event.start = { dateTime: startDt, timeZone: "Europe/Paris" };
    event.end = { dateTime: endDt, timeZone: "Europe/Paris" };
  } else {
    event.start = { date };
    event.end = { date };
  }

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }

  const created = await res.json();
  const response = NextResponse.json(created);

  if (newAccessToken) {
    response.cookies.set("gcal_access_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
  }

  return response;
}
