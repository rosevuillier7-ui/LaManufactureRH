import { NextResponse } from "next/server";
import { upsertPlacement } from "@/lib/db";

export const maxDuration = 60;

const RECRUITEE_BASE = "https://api.recruitee.com/c";

// The last stage of every Recruitee pipeline at Flaubert is named "Engagé".
// A candidate is "placed" when one of their placements sits in that stage.
const ENGAGED_FILTER = JSON.stringify([{ field: "stages", name: { in: ["Engagé"] } }]);
// Normalized form we compare against client-side ("engage", accents stripped).
const ENGAGED_TARGET = normalize("Engagé");
// Offer statuses we treat as no longer active — placements on these are skipped.
const INACTIVE_OFFER_STATUSES = new Set(["closed", "archived"]);

const PAGE_SIZE = 500;
const MAX_PAGES = 20; // safety bound; 500 × 20 = 10k, the API's hard ceiling

interface PlacementStage {
  id: number;
  name: string;
}

interface PlacementOffer {
  id: number;
  kind?: string;
  title: string;
  slug?: string;
  status?: string;
}

interface CandidatePlacement {
  id: number;
  disqualified?: boolean;
  stage?: PlacementStage | null;
  offer?: PlacementOffer | null;
}

interface RecruiteeCandidate {
  id: number | string;
  name?: string;
  emails?: string[];
  phones?: string[];
  status?: string;
  placements?: CandidatePlacement[];
}

class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} for ${url}`);
  }
}

// Trim + lowercase + strip diacritics, so "Engagé", "engagé ", "ENGAGE" all match.
function normalize(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
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

// Fetch every candidate sitting in the "Engagé" stage, across all offers, in one
// filtered search (paginated for safety).
async function fetchEngagedCandidates(
  companyId: string,
  apiKey: string
): Promise<{ candidates: RecruiteeCandidate[]; total: number; pages: number }> {
  const all: RecruiteeCandidate[] = [];
  let total = 0;
  let page = 1;

  for (; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(page),
      filters_json: ENGAGED_FILTER,
    });
    const url = `${RECRUITEE_BASE}/${companyId}/search/new/candidates?${params}`;
    const body = (await apiFetch(url, apiKey)) as { hits?: RecruiteeCandidate[]; total?: number };
    const hits = body.hits ?? [];
    total = body.total ?? all.length + hits.length;
    all.push(...hits);

    if (hits.length < PAGE_SIZE || all.length >= total) break;
  }

  return { candidates: all, total, pages: page };
}

// From a candidate returned by the filter, pick the placement we should sync:
// stage actually "Engagé", not disqualified, on an active job offer.
// If several qualify (Engagé on multiple offers), keep the most recent placement.
function pickEngagedPlacement(c: RecruiteeCandidate): { placement: CandidatePlacement | null; reason: string } {
  const placements = c.placements ?? [];
  const matches = placements.filter((p) => {
    if (normalize(p.stage?.name ?? "") !== ENGAGED_TARGET) return false;
    if (p.disqualified === true) return false;
    if (p.offer?.kind && p.offer.kind !== "job") return false;
    if (p.offer?.status && INACTIVE_OFFER_STATUSES.has(p.offer.status.toLowerCase())) return false;
    return true;
  });

  if (matches.length > 0) {
    // Highest placement id = most recently created.
    const placement = matches.reduce((a, b) => (b.id > a.id ? b : a));
    return { placement, reason: matches.length > 1 ? `picked latest of ${matches.length} Engagé placements` : "ok" };
  }

  // No qualifying placement — explain why for the logs.
  const engaged = placements.filter((p) => normalize(p.stage?.name ?? "") === ENGAGED_TARGET);
  if (engaged.length === 0) return { placement: null, reason: "no placement in Engagé stage (filter false positive)" };
  if (engaged.every((p) => p.disqualified)) return { placement: null, reason: "Engagé but disqualified" };
  if (engaged.every((p) => p.offer?.kind && p.offer.kind !== "job"))
    return { placement: null, reason: "Engagé only on a talent pool" };
  return { placement: null, reason: "Engagé only on closed/archived offers" };
}

export async function POST() {
  const companyId = process.env.RECRUITEE_COMPANY_ID;
  const apiKey = process.env.RECRUITEE_API_KEY;

  if (!companyId || !apiKey) {
    return NextResponse.json({ error: "Recruitee credentials not configured" }, { status: 500 });
  }

  let result: Awaited<ReturnType<typeof fetchEngagedCandidates>>;
  try {
    result = await fetchEngagedCandidates(companyId, apiKey);
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch candidates", detail: String(err) }, { status: 502 });
  }

  const { candidates, total, pages } = result;

  // Diagnostics: surface what stage names / offer statuses we actually saw, so the
  // loose "Engagé" match and the active-offer filter can be tightened if needed.
  const stageNames = new Set<string>();
  const offerStatuses = new Set<string>();
  for (const c of candidates) {
    for (const p of c.placements ?? []) {
      if (p.stage?.name) stageNames.add(p.stage.name);
      if (p.offer?.status) offerStatuses.add(p.offer.status);
    }
  }
  console.log(`[recruitee/sync] Engagé candidates returned: ${candidates.length} (total: ${total}, pages: ${pages})`);
  console.log(`[recruitee/sync] distinct stage names seen:`, [...stageNames]);
  console.log(`[recruitee/sync] distinct offer statuses seen:`, [...offerStatuses]);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    const { placement, reason } = pickEngagedPlacement(candidate);

    if (!placement) {
      skipped++;
      console.log(`[recruitee/sync] skip candidate ${candidate.id} (${candidate.name ?? "?"}) — ${reason}`);
      continue;
    }

    try {
      const { prenom, nom } = splitName(candidate.name ?? "");
      console.log(
        `[recruitee/sync] saving candidate ${candidate.id} (${candidate.name ?? "?"})` +
          ` — offer: ${placement.offer?.title} [#${placement.offer?.id}, ${placement.offer?.status}]` +
          ` | ${reason}`
      );

      await upsertPlacement({
        recruiteeId: String(candidate.id),
        nom,
        prenom,
        poste: placement.offer?.title ?? "",
        entreprise: "",
      });
      synced++;
    } catch (err) {
      console.error(`[recruitee/sync] supabase insert error: candidate ${candidate.id}:`, err);
      errors.push(`Candidate ${candidate.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    synced,
    skipped,
    total,
    engagedReturned: candidates.length,
    pages,
    errors,
    debug: {
      distinctStageNames: [...stageNames],
      distinctOfferStatuses: [...offerStatuses],
    },
  });
}
