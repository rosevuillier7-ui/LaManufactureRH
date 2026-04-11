import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // audio transcription can be slow

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    const objectifPrincipal = (formData.get("objectifPrincipal") as string) || "";
    const indicateursReussite = (formData.get("indicateursReussite") as string) || "";

    if (!audio) {
      return NextResponse.json({ error: "Fichier audio manquant" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY non configurée sur le serveur" },
        { status: 500 }
      );
    }

    // ── Step 1 : Transcribe audio with Claude ─────────────────────────────────
    const audioBuffer = await audio.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString("base64");
    const mediaType = (audio.type || "audio/mpeg") as string;

    const transcribeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcris fidèlement ce débrief de séance de coaching en français. Retourne uniquement la transcription complète, sans commentaire ni formatage.",
              },
              {
                type: "audio",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64Audio,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!transcribeRes.ok) {
      const err = await transcribeRes.json().catch(() => ({}));
      throw new Error(
        err.error?.message ?? `Erreur transcription (${transcribeRes.status})`
      );
    }

    const transcribeData = await transcribeRes.json();
    const transcription: string = transcribeData.content?.[0]?.text ?? "";

    // ── Step 2 : Analyse transcription + objectifs → 3 thèmes ────────────────
    const objectivesContext = [
      objectifPrincipal ? `Objectif principal de la mission : ${objectifPrincipal}` : "",
      indicateursReussite ? `Indicateurs de réussite : ${indicateursReussite}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const analysisPrompt = `Tu es un coach professionnel expert en analyse de séances de coaching.
${objectivesContext ? `\nContexte de la mission :\n${objectivesContext}\n` : ""}
Transcription du débrief de séance :
${transcription}

À partir de cette transcription${objectivesContext ? " et des objectifs de la mission" : ""}, identifie les 3 thèmes prioritaires à travailler lors de la prochaine séance de coaching. Chaque thème doit être concret, actionnable et directement lié au débrief.

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown ni texte autour :
[{"titre": "...", "description": "..."}, {"titre": "...", "description": "..."}, {"titre": "...", "description": "..."}]`;

    const analysisRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: analysisPrompt }],
      }),
    });

    if (!analysisRes.ok) {
      const err = await analysisRes.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `Erreur analyse (${analysisRes.status})`);
    }

    const analysisData = await analysisRes.json();
    const rawText: string = analysisData.content?.[0]?.text ?? "[]";

    let themes: Array<{ titre: string; description: string }> = [];
    try {
      themes = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try { themes = JSON.parse(match[0]); } catch { themes = []; }
      }
    }

    return NextResponse.json({ transcription, themes });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
