import { NextResponse } from "next/server";
import { upsertPlacement } from "@/lib/db";

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

export async function POST() {
  const companyId = process.env.RECRUITEE_COMPANY_ID;
  const apiKey = process.env.RECRUITEE_API_KEY;

  if (!companyId || !apiKey) {
    return NextResponse.json({ error: "Recruitee credentials not configured" }, { status: 500 });
  }

  // Fetch all candidates and filter client-side (Recruitee uses French status names server-side)
  const url = `${RECRUITEE_BASE}/${companyId}/candidates?per_page=100`;
  console.log("[recruitee/sync] fetching URL:", url);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  console.log("[recruitee/sync] HTTP status:", res.status);

  const rawText = await res.text();
  console.log("[recruitee/sync] response body (first 500 chars):", rawText.slice(0, 500));

  if (!res.ok) {
    return NextResponse.json(
      { error: `Recruitee API error: ${res.status}`, debug: { url, status: res.status, body: rawText.slice(0, 500) } },
      { status: 502 }
    );
  }

  const body = JSON.parse(rawText);
  const candidates: RecruiteeCandidate[] = body.candidates ?? [];
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
      httpStatus: res.status,
      responsePreview: rawText.slice(0, 500),
      totalCandidatesBeforeFilter: candidates.length,
    },
  });
}
