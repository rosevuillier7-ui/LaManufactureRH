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
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function getHiredPlacement(placements: CandidatePlacement[]): CandidatePlacement | undefined {
  return placements.find((p) => p.hired_in_this_placement === true || p.hired_at != null);
}

export async function POST() {
  const companyId = process.env.RECRUITEE_COMPANY_ID;
  const apiKey = process.env.RECRUITEE_API_KEY;

  if (!companyId || !apiKey) {
    return NextResponse.json({ error: "Recruitee credentials not configured" }, { status: 500 });
  }

  const candidatesUrl = `${RECRUITEE_BASE}/${companyId}/candidates?per_page=100`;

  let body: Record<string, unknown>;
  try {
    body = (await apiFetch(candidatesUrl, apiKey)) as Record<string, unknown>;
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch candidates", detail: String(err) }, { status: 502 });
  }

  console.log(`[recruitee/sync] topLevelKeys:`, Object.keys(body));

  const candidates: RecruiteeCandidate[] = (body.candidates as RecruiteeCandidate[] | undefined) ?? [];

  console.log("[recruitee/sync] totalCandidates:", candidates.length);

  const hiredCandidates = candidates.filter((c) => {
    const placements = c.placements ?? [];
    return getHiredPlacement(placements) !== undefined;
  });

  console.log("[recruitee/sync] hiredCandidates:", hiredCandidates.length);

  if (hiredCandidates.length > 0) {
    console.log(
      "[recruitee/sync] first hired candidate placements sample:",
      JSON.stringify(hiredCandidates[0].placements, null, 2).slice(0, 1000)
    );
  }

  // Fetch offer details in parallel for each hired candidate
  const enriched = await Promise.all(
    hiredCandidates.map(async (candidate) => {
      const placement = getHiredPlacement(candidate.placements ?? [])!;
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

  for (const { candidate, placement, offerBody } of enriched) {
    try {
      const rawOffer = offerBody as Record<string, unknown> | null;
      const offer: RecruiteeOffer =
        (rawOffer?.offer as RecruiteeOffer | undefined) ?? (rawOffer as RecruiteeOffer | null) ?? {};

      const { prenom, nom } = splitName(candidate.name ?? "");
      const poste = offer.title ?? "";
      const entreprise = offer.department ?? "";

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
    total: hiredCandidates.length,
    errors,
    debug: {
      url: candidatesUrl,
      topLevelKeys: Object.keys(body),
      totalCandidates: candidates.length,
      hiredCandidates: hiredCandidates.length,
    },
  });
}
