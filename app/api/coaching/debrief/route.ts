import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { debriefText, objectifPrincipal = "", indicateursReussite = "" } = await req.json();

    if (!debriefText?.trim()) {
      return NextResponse.json({ error: "Le débrief est vide" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY non configurée sur le serveur" },
        { status: 500 }
      );
    }

    const objectivesContext = [
      objectifPrincipal ? `Objectif principal de la mission : ${objectifPrincipal}` : "",
      indicateursReussite ? `Indicateurs de réussite : ${indicateursReussite}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Tu es un coach professionnel expert en analyse de séances de coaching.
${objectivesContext ? `\nContexte de la mission :\n${objectivesContext}\n` : ""}
Notes de débrief de la séance :
${debriefText}

À partir de ce débrief${objectivesContext ? " et des objectifs de la mission" : ""}, identifie les 3 thèmes prioritaires à travailler lors de la prochaine séance de coaching. Chaque thème doit être concret, actionnable et directement lié au débrief.

Pour chaque thème, génère :
- Un titre court et percutant
- Une courte description (ce sur quoi travailler et pourquoi c'est prioritaire)
- 2 à 3 actions concrètes à mettre en œuvre avant la prochaine séance
- 1 à 2 outils ou méthodes spécifiques à utiliser (frameworks, exercices, templates, techniques)

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown ni texte autour :
[{"titre": "...", "description": "...", "actions": ["...", "..."], "outils": ["..."]}, {"titre": "...", "description": "...", "actions": ["...", "..."], "outils": ["..."]}, {"titre": "...", "description": "...", "actions": ["...", "..."], "outils": ["..."]}]`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message ?? `Erreur analyse (${res.status})`);
    }

    const data = await res.json();
    const rawText: string = data.content?.[0]?.text ?? "[]";

    let themes: Array<{ titre: string; description: string; actions: string[]; outils: string[] }> = [];
    try {
      themes = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try { themes = JSON.parse(match[0]); } catch { themes = []; }
      }
    }

    return NextResponse.json({ themes });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
