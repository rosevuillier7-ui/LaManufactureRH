import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken, parseAccountKey, GcalReconnectError } from "@/lib/gcal";

const PODCAST_KEYWORDS = ["podcast", "épisode", "episode", "13ème mois", "13eme mois"];

function matchesPodcast(title: string): boolean {
  const lower = title.toLowerCase();
  return PODCAST_KEYWORDS.some((k) => lower.includes(k));
}

export async function GET(request: NextRequest) {
  const account = parseAccountKey(request.nextUrl.searchParams.get("account"));

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(account);
  } catch (err) {
    if (err instanceof GcalReconnectError) {
      return NextResponse.json({ connected: false, events: [], reconnect: true, account });
    }
    throw err;
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

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = (data.items ?? []).filter((e: any) => matchesPodcast(e.summary ?? ""));

  return NextResponse.json({ connected: true, events });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const account = parseAccountKey(body.account_key ?? body.account);

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(account);
  } catch (err) {
    if (err instanceof GcalReconnectError) {
      return NextResponse.json(
        { error: "Compte Google à reconnecter", reconnect: true, account },
        { status: 401 }
      );
    }
    throw err;
  }

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
  return NextResponse.json(created);
}
