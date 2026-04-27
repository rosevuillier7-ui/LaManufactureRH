import { NextResponse } from "next/server";
import { upsertPlacement } from "@/lib/db";

export const maxDuration = 60;

const RECRUITEE_BASE = "https://api.recruitee.com/c";

interface CandidatePlacement {
  offer_id: number | string;
  hired_at?: string | null;
  hired_in_this_placement?: boolean;
  job_starts_at?: string | null;
}

interface RecruiteeCandidate {
  id: number | string;
  name?: string;
  emails?: string[];
  phones?: string[];
  placements?: CandidatePlacement[];
}

interface RecruiteeOffer {
  title?: string;
  department?: string;
  company_name?: string;
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

function getHiredPlacement(placements: CandidatePlacement[]): CandidatePlacement | undefined {
  return placements.find((p) => p.hired_at != null);
}

async function fetchHiredCandidates(
  companyId: string,
  apiKey: string
): Promise<{ candidates: RecruiteeCandidate[]; url: string; body: Record<string, unknown>; usedFallback: boolean }> {
  const searchUrl = `${RECRUITEE_BASE}/${companyId}/search/new/candidates`;

  try {
    const body = (await apiPost(searchUrl, apiKey, { limit: 100, hired: true })) as Record<string, unknown>;
    const hits = (body.hits as RecruiteeCandidate[] | undefined) ?? [];
    return { candidates: hits, url: searchUrl, body, usedFallback: false };
  } catch (err) {
    if (err instanceof HttpError && (err.status === 404 || err.status === 405)) {
      console.log(`[recruitee/sync] search endpoint returned ${err.status}, falling back to candidates endpoint`);
    } else {
      throw err;
    }
  }

  const fallbackUrl = `${RECRUITEE_BASE}/${companyId}/candidates?qualified=true&page=1&per_page=100`;
  const body = (await apiFetch(fallbackUrl, apiKey)) as Record<string, unknown>;
  const all = (body.candidates as RecruiteeCandidate[] | undefined) ?? [];
  const hired = all.filter((c) => getHiredPlacement(c.placements ?? []) !== undefined);
  return { candidates: hired, url: fallbackUrl, body, usedFallback: true };
}

export async function POST() {
  const companyId = process.env.RECRUITEE_COMPANY_ID;
  const apiKey = process.env.RECRUITEE_API_KEY;

  if (!companyId || !apiKey) {
    return NextResponse.json({ error: "Recruitee credentials not configured" }, { status: 500 });
  }

  let fetchResult: Awaited<ReturnType<typeof fetchHiredCandidates>>;
  try {
    fetchResult = await fetchHiredCandidates(companyId, apiKey);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch candidates", detail: String(err) }, { status: 502 });
  }

  const { candidates, url: usedUrl, body, usedFallback } = fetchResult;
  const totalHits = (body.total as number | undefined) ?? candidates.length;

  console.log(`[recruitee/sync] topLevelKeys:`, Object.keys(body));
  console.log(`[recruitee/sync] totalHits:`, totalHits, "| returned:", candidates.length);

  if (candidates.length > 0) {
    const sample = candidates[0];
    console.log(
      `[recruitee/sync] first hit sample:`,
      JSON.stringify({ id: sample.id, name: sample.name, placements: sample.placements }, null, 2).slice(0, 1000)
    );
  }

  // Fetch offer details in parallel for each hired candidate
  const enriched = await Promise.all(
    candidates.map(async (candidate) => {
      const placement = getHiredPlacement(candidate.placements ?? []);
      if (!placement) return null;
      const offerBody = await apiFetch(
        `${RECRUITEE_BASE}/${companyId}/offers/${placement.offer_id}`,
        apiKey
      ).catch((e) => {
        console.error(`[recruitee/sync] offer ${placement.offer_id} error:`, e);
        return null;
      });
      return { candidate, placement, offerBody };
    })
  );

  let synced = 0;
  const errors: string[] = [];

  for (const item of enriched) {
    if (!item) continue;
    const { candidate, placement, offerBody } = item;
    try {
      const rawOffer = offerBody as Record<string, unknown> | null;
      const offer: RecruiteeOffer =
        (rawOffer?.offer as RecruiteeOffer | undefined) ?? (rawOffer as RecruiteeOffer | null) ?? {};

      const { prenom, nom } = splitName(candidate.name ?? "");
      const poste = offer.title ?? "";
      const entreprise = offer.department ?? offer.company_name ?? "";

      await upsertPlacement({
        recruiteeId: String(candidate.id),
        nom,
        prenom,
        poste,
        entreprise,
        startDate: placement.hired_at ?? placement.job_starts_at ?? null,
      });
      synced++;
    } catch (err) {
      errors.push(`Candidate ${candidate.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    synced,
    total: candidates.length,
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
