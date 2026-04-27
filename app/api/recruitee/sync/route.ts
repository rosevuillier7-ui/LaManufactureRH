import { NextResponse } from "next/server";
import { upsertPlacement } from "@/lib/db";

export const maxDuration = 60;

const RECRUITEE_BASE = "https://api.recruitee.com/c";

interface RecruiteeOffer {
  title?: string;
  department?: string;
  city?: string;
}

interface RecruiteeApplication {
  stage?: string;
  disqualified?: boolean;
  offer?: RecruiteeOffer;
}

interface RecruiteeCandidate {
  id: number | string;
  name?: string;
  hired_at?: string | null;
  applications?: RecruiteeApplication[];
}

function splitName(fullName: string): { prenom: string; nom: string } {
  const parts = (fullName ?? "").trim().split(/\s+/);
  if (parts.length === 1) return { prenom: parts[0], nom: "" };
  return { prenom: parts[0], nom: parts.slice(1).join(" ") };
}

async function tryFetch(url: string, apiKey: string) {
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
  const text = await res.text();
  console.log(`[recruitee/sync] response body (first 800 chars):`, text.slice(0, 800));
  return { ok: res.ok, status: res.status, text };
}

export async function POST() {
  const companyId = process.env.RECRUITEE_COMPANY_ID;
  const apiKey = process.env.RECRUITEE_API_KEY;

  if (!companyId || !apiKey) {
    return NextResponse.json({ error: "Recruitee credentials not configured" }, { status: 500 });
  }

  // Try each endpoint in order; use the first that returns an array of objects
  const endpointCandidates = [
    `${RECRUITEE_BASE}/${companyId}/candidates?per_page=25`,
    `${RECRUITEE_BASE}/${companyId}/placements?per_page=25`,
    `${RECRUITEE_BASE}/${companyId}/candidates/search?per_page=25`,
  ];

  let rawText = "";
  let url = "";
  let responseStatus = 0;

  for (const endpoint of endpointCandidates) {
    const result = await tryFetch(endpoint, apiKey);
    rawText = result.text;
    url = endpoint;
    responseStatus = result.status;

    if (!result.ok) {
      console.log(`[recruitee/sync] skipping ${endpoint} (non-OK status)`);
      continue;
    }

    let parsed: unknown;
    try { parsed = JSON.parse(rawText); } catch { continue; }

    console.log(`[recruitee/sync] top-level keys for ${endpoint}:`, Object.keys(parsed as object));

    // Look for an array-valued key that contains objects (likely candidates/placements)
    const firstArrayKey = Object.entries(parsed as Record<string, unknown>).find(
      ([, v]) => Array.isArray(v) && (v as unknown[]).length > 0 && typeof (v as unknown[])[0] === "object"
    )?.[0];

    if (firstArrayKey) {
      console.log(`[recruitee/sync] using key "${firstArrayKey}" from ${endpoint}`);
      const firstItem = (parsed as Record<string, unknown[]>)[firstArrayKey][0];
      console.log(`[recruitee/sync] first item keys:`, Object.keys(firstItem as object));
      console.log(`[recruitee/sync] first item (full):`, JSON.stringify(firstItem, null, 2).slice(0, 1500));
      break;
    }

    console.log(`[recruitee/sync] no candidate array found in ${endpoint}, trying next`);
  }

  // Re-parse and extract candidates from whichever endpoint worked
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawText); } catch {
    return NextResponse.json({ error: "Failed to parse Recruitee response", debug: { url, responseStatus, rawText: rawText.slice(0, 500) } }, { status: 502 });
  }

  console.log(`[recruitee/sync] final top-level keys:`, Object.keys(body));

  // Try common array keys in order of likelihood
  const candidates: RecruiteeCandidate[] =
    (body.candidates as RecruiteeCandidate[] | undefined) ??
    (body.placements as RecruiteeCandidate[] | undefined) ??
    (body.data as RecruiteeCandidate[] | undefined) ??
    [];

  console.log("[recruitee/sync] total candidates from API (before filtering):", candidates.length);

  const HIRED_STAGES = new Set(["hired", "Hired", "engagé", "Engagé", "engage", "Engage", "embauché", "Embauché"]);

  const allStages = [...new Set(
    candidates.flatMap((c) => (c.applications ?? []).map((a) => a.stage ?? ""))
  )];
  console.log("[recruitee/sync] unique stages found:", allStages);

  // Filter for candidates with a hired application (in case API returns more)
  const hiredCandidates = candidates.filter((c) => {
    if (c.hired_at) return true;
    return (c.applications ?? []).some(
      (a) => HIRED_STAGES.has(a.stage ?? "") && !a.disqualified
    );
  });

  let synced = 0;
  const errors: string[] = [];

  for (const candidate of hiredCandidates) {
    try {
      const { prenom, nom } = splitName(candidate.name ?? "");

      // Get job info from the hired application's offer
      const hiredApp = (candidate.applications ?? []).find(
        (a) => HIRED_STAGES.has(a.stage ?? "") || !!candidate.hired_at
      );
      const poste = hiredApp?.offer?.title ?? "";
      const entreprise = hiredApp?.offer?.department ?? "";

      await upsertPlacement({
        recruiteeId: String(candidate.id),
        nom,
        prenom,
        poste,
        entreprise,
      });
      synced++;
    } catch (err) {
      errors.push(`Candidate ${candidate.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    synced,
    total: hiredCandidates.length,
    errors,
    detectedStages: allStages,
    debug: {
      url,
      httpStatus: responseStatus,
      responsePreview: rawText.slice(0, 500),
      topLevelKeys: Object.keys(body),
      totalCandidatesBeforeFilter: candidates.length,
    },
  });
}
