"use client";

import { useState, useEffect } from "react";
import { getObjectiveByCoachee, upsertObjective } from "@/lib/db";
import { CoachingObjective, DebriefTheme, generateId } from "@/lib/store";
import { CloudArrowUpIcon, SparklesIcon, CheckIcon } from "@heroicons/react/24/outline";

interface Props {
  coacheeId: string;
}

export default function CoacheeDebriefSection({ coacheeId }: Props) {
  const [objective, setObjective] = useState<CoachingObjective | null>(null);
  const [form, setForm] = useState({ objectifPrincipal: "", indicateursReussite: "" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [themes, setThemes] = useState<DebriefTheme[]>([]);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    getObjectiveByCoachee(coacheeId).then((obj) => {
      if (obj) {
        setObjective(obj);
        setForm({ objectifPrincipal: obj.objectifPrincipal, indicateursReussite: obj.indicateursReussite });
      }
    });
  }, [coacheeId]);

  async function saveObjective() {
    setSaving(true);
    try {
      const obj: CoachingObjective = {
        id: objective?.id ?? generateId(),
        coacheeId,
        objectifPrincipal: form.objectifPrincipal,
        indicateursReussite: form.indicateursReussite,
      };
      await upsertObjective(obj);
      setObjective(obj);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function analyzeDebrief() {
    if (!audioFile) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setThemes([]);
    try {
      const fd = new FormData();
      fd.append("audio", audioFile);
      fd.append("objectifPrincipal", objective?.objectifPrincipal ?? form.objectifPrincipal);
      fd.append("indicateursReussite", objective?.indicateursReussite ?? form.indicateursReussite);

      const res = await fetch("/api/coaching/debrief", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Erreur lors de l'analyse");
      setThemes(data.themes ?? []);
    } catch (e: unknown) {
      setAnalysisError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="mb-5 space-y-3">

      {/* ── Objectif de la mission ── */}
      <div className="bg-indigo-50/60 rounded-xl border border-indigo-100 p-4">
        <h3 className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3">
          Objectif de la mission
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Objectif principal</label>
            <textarea
              className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-gray-300"
              rows={2}
              value={form.objectifPrincipal}
              onChange={(e) => setForm((f) => ({ ...f, objectifPrincipal: e.target.value }))}
              placeholder="Décrivez l'objectif principal du coaching..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Indicateurs de réussite</label>
            <textarea
              className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-gray-300"
              rows={2}
              value={form.indicateursReussite}
              onChange={(e) => setForm((f) => ({ ...f, indicateursReussite: e.target.value }))}
              placeholder="Quels signes montreront que l'objectif est atteint ?"
            />
          </div>
          <button
            onClick={saveObjective}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saved && <CheckIcon className="w-3.5 h-3.5" />}
            {saved ? "Sauvegardé" : saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>

      {/* ── Débrief séance ── */}
      <div className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-4">
        <h3 className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-3">
          Débrief séance
        </h3>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <label className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
            <CloudArrowUpIcon className="w-4 h-4 flex-shrink-0 text-emerald-500" />
            <span className="truncate max-w-[200px]">
              {audioFile ? audioFile.name : "Importer un audio"}
            </span>
            <input
              type="file"
              accept=".mp3,.m4a,.wav,audio/mpeg,audio/mp4,audio/wav"
              className="hidden"
              onChange={(e) => {
                setAudioFile(e.target.files?.[0] ?? null);
                setThemes([]);
                setAnalysisError(null);
              }}
            />
          </label>

          <button
            onClick={analyzeDebrief}
            disabled={!audioFile || analyzing}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <SparklesIcon className="w-4 h-4" />
            {analyzing ? "Analyse en cours..." : "Analyser le débrief"}
          </button>
        </div>

        {analysisError && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 mb-3">
            {analysisError}
          </div>
        )}

        {themes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">3 thèmes à travailler en prochaine séance</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {themes.map((theme, i) => (
                <div key={i} className="bg-white rounded-xl border border-emerald-100 p-3.5 shadow-sm">
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs font-semibold text-gray-900 leading-snug">{theme.titre}</p>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed pl-7">{theme.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
