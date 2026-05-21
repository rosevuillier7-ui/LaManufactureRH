import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { updatePlacementStartDate, updatePlacementDate } from "@/lib/db";
import { getValidAccessToken, parseAccountKey, GcalReconnectError } from "@/lib/gcal";

const GCAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary";
const TZ = "Europe/Paris";

async function createEvent(
  token: string,
  summary: string,
  start: { dateTime?: string; date?: string; timeZone?: string },
  end: { dateTime?: string; date?: string; timeZone?: string }
): Promise<string> {
  const res = await fetch(`${GCAL_BASE}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary,
      start,
      end,
      reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.id as string;
}

async function deleteEvent(token: string, eventId: string): Promise<void> {
  await fetch(`${GCAL_BASE}/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { datePriseDePoste } = body as { datePriseDePoste: string };
  const account = parseAccountKey(body.account_key ?? body.account);

  if (!datePriseDePoste || !/^\d{4}-\d{2}-\d{2}$/.test(datePriseDePoste)) {
    return NextResponse.json({ error: "Date invalide (format YYYY-MM-DD requis)" }, { status: 400 });
  }

  // Get current placement to check for existing events to delete
  const { data: placement, error: fetchError } = await supabase
    .from("placements")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !placement) {
    return NextResponse.json({ error: "Placement introuvable" }, { status: 404 });
  }

  // Persist the new date immediately so it survives even if GCal creation fails
  await updatePlacementDate(id, datePriseDePoste);

  // Resolve the selected account's Google Calendar token (refreshes if expired).
  let token: string;
  try {
    token = await getValidAccessToken(account);
  } catch (err) {
    if (err instanceof GcalReconnectError) {
      return NextResponse.json(
        { error: "Session Google expirée, reconnectez le compte sélectionné", reconnect: true, account },
        { status: 401 }
      );
    }
    throw err;
  }

  // Delete old events if they exist
  const oldEventIds = [
    placement.cal_event_j_minus_1_id,
    placement.cal_event_j_id,
    placement.cal_event_j_plus_15_id,
    placement.cal_event_j_plus_46_id,
    placement.cal_event_j_plus_76_id,
  ].filter(Boolean);

  await Promise.allSettled(oldEventIds.map((eid) => deleteEvent(token, eid)));

  // Compute event dates
  const jMinus1 = addDays(datePriseDePoste, -1);
  const jPlus15 = addDays(datePriseDePoste, 15);
  const jPlus46 = addDays(datePriseDePoste, 46);
  const jPlus76 = addDays(datePriseDePoste, 76);
  const firstName = ((placement.candidate_name as string) || "").trim().split(/\s+/)[0] || "le candidat";

  // Helper to retry with a refreshed token on 401 (token mid-flight expiry).
  async function safeCreate(
    summary: string,
    start: { dateTime?: string; date?: string; timeZone?: string },
    end: { dateTime?: string; date?: string; timeZone?: string }
  ): Promise<string> {
    try {
      return await createEvent(token, summary, start, end);
    } catch (err) {
      if (String(err).includes("401")) {
        // Force a fresh token from the table and retry once.
        token = await getValidAccessToken(account);
        return await createEvent(token, summary, start, end);
      }
      throw err;
    }
  }

  // Create 5 calendar events sequentially to avoid rate limits
  const [idJMinus1, idJ, idJPlus15, idJPlus46, idJPlus76] = await Promise.all([
    safeCreate(
      `Envoyer SMS de bonne prise de poste à ${firstName}`,
      { dateTime: `${jMinus1}T09:00:00`, timeZone: TZ },
      { dateTime: `${jMinus1}T09:30:00`, timeZone: TZ }
    ),
    safeCreate(
      `Envoyer SMS à ${firstName} pour savoir comment s'est passé le 1er jour`,
      { dateTime: `${datePriseDePoste}T18:00:00`, timeZone: TZ },
      { dateTime: `${datePriseDePoste}T18:30:00`, timeZone: TZ }
    ),
    safeCreate(
      `Call de suivi avec ${firstName}`,
      { dateTime: `${jPlus15}T10:00:00`, timeZone: TZ },
      { dateTime: `${jPlus15}T10:30:00`, timeZone: TZ }
    ),
    safeCreate(
      `Call de suivi avec ${firstName}`,
      { dateTime: `${jPlus46}T10:00:00`, timeZone: TZ },
      { dateTime: `${jPlus46}T10:30:00`, timeZone: TZ }
    ),
    safeCreate(
      `Call de suivi avec ${firstName}`,
      { dateTime: `${jPlus76}T10:00:00`, timeZone: TZ },
      { dateTime: `${jPlus76}T10:30:00`, timeZone: TZ }
    ),
  ]);

  await updatePlacementStartDate(id, datePriseDePoste, {
    calEventJMinus1Id: idJMinus1,
    calEventJId: idJ,
    calEventJPlus15Id: idJPlus15,
    calEventJPlus46Id: idJPlus46,
    calEventJPlus76Id: idJPlus76,
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { datePriseDePoste } = body as { datePriseDePoste: string };

  if (!datePriseDePoste || !/^\d{4}-\d{2}-\d{2}$/.test(datePriseDePoste)) {
    return NextResponse.json({ error: "Date invalide (format YYYY-MM-DD requis)" }, { status: 400 });
  }

  try {
    await updatePlacementDate(id, datePriseDePoste);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[placements/start-date] PATCH error:", err);
    return NextResponse.json({ error: "Erreur lors de la sauvegarde" }, { status: 500 });
  }
}
