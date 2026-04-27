import { NextResponse } from "next/server";
import { upsertPlacement } from "@/lib/db";

export const maxDuration = 60;

const RECRUITEE_BASE = "https://api.recruitee.com/c";

interface PlacementOffer {
  id: number;
  title: string;
}

interface CandidatePlacement {
  is_hired: boolean;
  offer: PlacementOffer;
  hired_at?: string | null;
  job_starts_at?: string | null;
}

interface RecruiteeCandidate {
  id: number | string;
  name?: string;
  emails?: string[];
  phones?: string[];
  placements?: CandidatePlacement[];
}

class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
  }
}

function splitName(fullName: string): { prenom: string; nom: string } {
  const parts = (fullName ?? "").trim().split(/\s+/);
  if (parts.length === 1) return { prenom: parts[0], nom: "" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

async function apiFetch(url: string, apiKey: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  console.log(`[recruitee/sync] GET ${url} → HTTP ${res.status}`);
  if (!res.ok) throw new HttpError(res.status, url);
  return res.json();
}

async function apiPost(url: string, apiKey: string, payload: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  console.log(`[recruitee/sync] POST ${url} → HTTP ${res.status}`);
  if (!res.ok) throw new HttpError(res.status, url);
  return res.json();
}

async function fetchAllCandidates(
  companyId: string,
  apiKey: string
): Promise<{ candidates: RecruiteeCandidate[]; url: string; body: Record<string, unknown>; usedFallback: boolean }> {
  const searchUrl = `${RECRUITEE_BASE}/${companyId}/search/new/candidates`;

  try {
    const body = (await apiPost(searchUrl, apiKey, { limit: 200 })) as Record<string, unknown>;
    const hits = (body.hits as RecruiteeCandidate[] | undefined) ?? [];
    return { candidates: hits, url: searchUrl, body, usedFallback: false };
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 405)) {
      console.log(`[recruitee/sync] search endpoint returned ${err.status}, falling back to candidates endpoint`);
    } else {
      throw err;
    }
  }

  const fallbackUrl = `${RECRUITEE_BASE}/${companyId}/candidates?qualified=true&page=1&per_page=200`;
  const body = (await apiFetch(fallbackUrl, apiKey)) as Record<string, unknown>;
  const all = (body.candidates as RecruiteeCandidate[] | undefined) ?? [];
  return { candidates: all, url: fallbackUrl, body, usedFallback: true };
}

export async function POST() {
  const companyId = process.env.RECRUITEE_COMPANY_ID;
  const apiKey = process.env.RECRUITEE_API_KEY;

  if (!companyId || !apiKey) {
    return NextResponse.json({ error: "Recruitee credentials not configured" }, { status: 500 });
  }

  let fetchResult: Awaited<ReturnType<typeof fetchAllCandidates>>;
  try {
    fetchResult = await fetchAllCandidates(companyId, apiKey);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch candidates", detail: String(err) }, { status: 502 });
  }

  const { candidates, url: usedUrl, body, usedFallback } = fetchResult;
  const totalHits = (body.total as number | undefined) ?? candidates.length;

  console.log(`[recruitee/sync] topLevelKeys:`, Object.keys(body));
  console.log(`[recruitee/sync] totalHits:`, totalHits, "| returned:", candidates.length);

  if (candidates.length > 0) {
    console.log(`[recruitee/sync] first hit FULL JSON:`, JSON.stringify(candidates[0], null, 2));
  }

  const hiredCandidates = candidates.filter((c) =>
    (c.placements ?? []).some((p) => p.is_hired === true)
  );

  console.log(`[recruitee/sync] hired candidates found: ${hiredCandidates.length}`);

  let synced = 0;
  const errors: string[] = [];

  for (const candidate of hiredCandidates) {
    try {
      const hiredPlacement = (candidate.placements ?? []).find((p) => p.is_hired === true)!;
      const email = candidate.emails?.[0] ?? null;
      const phone = candidate.phones?.[0] ?? null;

      console.log(
        `[recruitee/sync] saving candidate ${candidate.id}` +
          ` — job: ${hiredPlacement.offer?.title}` +
          ` | hired_at: ${hiredPlacement.hired_at}` +
          ` | email: ${email}` +
          ` | phone: ${phone}`
      );

      const { prenom, nom } = splitName(candidate.name ?? "");

      await upsertPlacement({
        recruiteeId: String(candidate.id),
        nom,
        prenom,
        poste: hiredPlacement.offer?.title ?? "",
        entreprise: "",
        startDate: hiredPlacement.hired_at ?? null,
      });
      synced++;
    } catch (err) {
      console.error(`[recruitee/sync] supabase insert error: candidate ${candidate.id}:`, err);
      errors.push(`Candidate ${candidate.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    synced,
    total: candidates.length,
    hiredFound: hiredCandidates.length,
    errors,
    debug: {
      url: usedUrl,
      usedFallback,
      topLevelKeys: Object.keys(body),
      totalHits,
      hitsReturned: candidates.length,
    },
  });
}
