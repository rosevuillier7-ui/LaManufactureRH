import { NextResponse } from "next/server";
import { upsertPlacement } from "@/lib/db";

export const maxDuration = 60;

const RECRUITEE_BASE = "https://api.recruitee.com/c";

interface RecruiteePlacement {
  id: number | string;
  candidate_id: number | string;
  offer_id: number | string;
  hired_at?: string | null;
  starts_at?: string | null;
  job_starts_at?: string | null;
}

interface RecruiteeCandidate {
  id?: number | string;
  name?: string;
  email?: string;
  phone?: string;
}

interface RecruiteeOffer {
  id?: number | string;
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
  const timeout = setTimeout(() => controller.abort(), 25_000);
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

export async function POST() {
  const companyId = process.env.RECRUITEE_COMPANY_ID;
  const apiKey = process.env.RECRUITEE_API_KEY;

  if (!companyId || !apiKey) {
    return NextResponse.json({ error: "Recruitee credentials not configured" }, { status: 500 });
  }

  const placementsUrl = `${RECRUITEE_BASE}/${companyId}/placements?per_page=100`;

  let placementsBody: Record<string, unknown>;
  try {
    placementsBody = (await apiFetch(placementsUrl, apiKey)) as Record<string, unknown>;
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch placements", detail: String(err) }, { status: 502 });
  }

  console.log(`[recruitee/sync] topLevelKeys:`, Object.keys(placementsBody));

  const placements: RecruiteePlacement[] =
    (placementsBody.placements as RecruiteePlacement[] | undefined) ??
    (placementsBody.data as RecruiteePlacement[] | undefined) ??
    [];

  console.log("[recruitee/sync] totalPlacements:", placements.length);

  if (placements.length > 0) {
    console.log("[recruitee/sync] first placement sample:", JSON.stringify(placements[0], null, 2).slice(0, 1000));
  }

  // Fetch all candidate and offer details in parallel
  const fetched = await Promise.all(
    placements.map(async (placement) => {
      const [candidateBody, offerBody] = await Promise.all([
        apiFetch(`${RECRUITEE_BASE}/${companyId}/candidates/${placement.candidate_id}`, apiKey).catch((e) => {
          console.error(`[recruitee/sync] candidate ${placement.candidate_id} error:`, e);
          return null;
        }),
        apiFetch(`${RECRUITEE_BASE}/${companyId}/offers/${placement.offer_id}`, apiKey).catch((e) => {
          console.error(`[recruitee/sync] offer ${placement.offer_id} error:`, e);
          return null;
        }),
      ]);
      return { placement, candidateBody, offerBody };
    })
  );

  let synced = 0;
  const errors: string[] = [];

  for (const { placement, candidateBody, offerBody } of fetched) {
    try {
      // Recruitee wraps single resources: { candidate: {...} } and { offer: {...} }
      const raw = candidateBody as Record<string, unknown> | null;
      const candidate: RecruiteeCandidate =
        (raw?.candidate as RecruiteeCandidate | undefined) ?? (raw as RecruiteeCandidate | null) ?? {};

      const rawOffer = offerBody as Record<string, unknown> | null;
      const offer: RecruiteeOffer =
        (rawOffer?.offer as RecruiteeOffer | undefined) ?? (rawOffer as RecruiteeOffer | null) ?? {};

      const { prenom, nom } = splitName(candidate.name ?? "");
      const poste = offer.title ?? "";
      const entreprise = offer.department ?? "";

      await upsertPlacement({
        recruiteeId: String(placement.id),
        nom,
        prenom,
        poste,
        entreprise,
      });
      synced++;
    } catch (err) {
      errors.push(`Placement ${placement.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    synced,
    total: placements.length,
    errors,
    debug: {
      url: placementsUrl,
      topLevelKeys: Object.keys(placementsBody),
      totalPlacements: placements.length,
    },
  });
}
