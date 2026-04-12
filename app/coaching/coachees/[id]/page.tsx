"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getCoacheeById,
  getSessionsByCoachee,
  getObjectiveByCoachee,
  upsertObjective,
  saveSessionDebrief,
  createSession,
} from "@/lib/db";
import { Coachee, Session, CoachingObjective, DebriefTheme, generateId } from "@/lib/store";
import Badge from "@/components/Badge";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SparklesIcon,
  CheckIcon,
  PhoneIcon,
  EnvelopeIcon,
  LinkIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

const dureeOptions = [30, 45, 60, 90, 120];

const emptySessionForm = (coacheeId: string): Omit<Session, "id"> => ({
  coacheeId,
  date: new Date().toISOString().split("T")[0],
  duree: 60,
  resume: "",
  pointsCles: "",
  prochainRdv: "",
  numeroSeance: 0,
  objectifSeance: "",
  bienMarche: "",
  ceQuiBloque: "",
  actionSuivante: "",
  niveauEnergie: 0,
});

type CoachingStatut = "actif" | "terminé" | "pause";
const statusLabel: Record<CoachingStatut, string> = { actif: "Actif", terminé: "Terminé", pause: "En pause" };
const statusVariant: Record<CoachingStatut, "green" | "gray" | "yellow"> = { actif: "green", terminé: "gray", pause: "yellow" };

// ── Session row with inline debrief ───────────────────────────────────────────

interface SessionRowProps {
  session: Session;
  index: number;
  objective: CoachingObjective | null;
}

function SessionRow({ session, index, objective }: SessionRowProps) {
  const [open, setOpen] = useState(false);
  const [debriefText, setDebriefText] = useState(session.debriefText ?? "");
  const [themes, setThemes] = useState<DebriefTheme[]>(session.themesResult ?? []);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyzeDebrief() {
    if (!debriefText.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/coaching/debrief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          debriefText,
          objectifPrincipal: objective?.objectifPrincipal ?? "",
          indicateursReussite: objective?.indicateursReussite ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Erreur lors de l'analyse");
      const newThemes: DebriefTheme[] = data.themes ?? [];
      setThemes(newThemes);
      // Auto-save after successful analysis
      setSaving(true);
      await saveSessionDebrief(session.id, debriefText, newThemes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setAnalyzing(false);
      setSaving(false);
    }
  }

  async function saveDebriefText() {
    if (!debriefText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveSessionDebrief(session.id, debriefText, themes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  const label = session.numeroSeance > 0 ? `Séance ${session.numeroSeance}` : `Séance ${index + 1}`;
  const dateStr = session.date ? new Date(session.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Row header — clickable */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 flex-shrink-0">
            {session.numeroSeance > 0 ? session.numeroSeance : index + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{label}</p>
            {dateStr && <p className="text-xs text-gray-400">{dateStr}{session.duree ? ` · ${session.duree} min` : ""}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {themes.length > 0 && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full">
              Analysé
            </span>
          )}
          {debriefText && themes.length === 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">
              Débrief rédigé
            </span>
          )}
          {open ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-5 space-y-4">
          {/* Session meta */}
          {(session.objectifSeance || session.bienMarche || session.ceQuiBloque || session.actionSuivante) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {session.objectifSeance && (
                <div className="bg-white rounded-lg border border-gray-100 px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Objectif séance</p>
                  <p className="text-xs text-gray-700">{session.objectifSeance}</p>
                </div>
              )}
              {session.bienMarche && (
                <div className="bg-emerald-50 rounded-lg border border-emerald-100 px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Ce qui a bien marché</p>
                  <p className="text-xs text-gray-700">{session.bienMarche}</p>
                </div>
              )}
              {session.ceQuiBloque && (
                <div className="bg-rose-50 rounded-lg border border-rose-100 px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide mb-1">Ce qui bloque</p>
                  <p className="text-xs text-gray-700">{session.ceQuiBloque}</p>
                </div>
              )}
              {session.actionSuivante && (
                <div className="bg-indigo-50 rounded-lg border border-indigo-100 px-3 py-2.5">
                  <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-1">Action suivante</p>
                  <p className="text-xs text-gray-700">{session.actionSuivante}</p>
                </div>
              )}
            </div>
          )}

          {/* Debrief section */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Débrief séance</p>
            <textarea
              className="w-full text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 placeholder:text-gray-300"
              rows={5}
              value={debriefText}
              onChange={(e) => {
                setDebriefText(e.target.value);
                setSaved(false);
              }}
              placeholder="Notes de débrief de la séance..."
            />
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={analyzeDebrief}
                disabled={!debriefText.trim() || analyzing || saving}
                className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SparklesIcon className="w-4 h-4" />
                {analyzing ? "Analyse en cours..." : "Analyser le débrief"}
              </button>
              {debriefText && !analyzing && (
                <button
                  onClick={saveDebriefText}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {saved ? <CheckIcon className="w-3.5 h-3.5 text-emerald-500" /> : null}
                  {saved ? "Sauvegardé" : saving ? "Sauvegarde..." : "Sauvegarder le débrief"}
                </button>
              )}
            </div>

            {error && (
              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Themes */}
          {themes.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-3">3 thèmes à travailler en prochaine séance</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {themes.map((theme, i) => (
                  <div key={i} className="bg-white rounded-xl border border-emerald-100 p-3.5 shadow-sm flex flex-col gap-3">
                    <div>
                      <div className="flex items-start gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-xs font-semibold text-gray-900 leading-snug">{theme.titre}</p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed pl-7">{theme.description}</p>
                    </div>
                    {theme.actions?.length > 0 && (
                      <div className="pl-1">
                        <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">Actions</p>
                        <ul className="space-y-1">
                          {theme.actions.map((action, j) => (
                            <li key={j} className="flex items-start gap-1.5 text-xs text-gray-600">
                              <span className="mt-1 w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />
                              {action}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {theme.outils?.length > 0 && (
                      <div className="pl-1">
                        <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-1.5">Outils & méthodes</p>
                        <div className="flex flex-wrap gap-1">
                          {theme.outils.map((outil, j) => (
                            <span key={j} className="inline-block px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] text-indigo-700 font-medium">
                              {outil}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoacheeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [coachee, setCoachee] = useState<Coachee | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [objective, setObjective] = useState<CoachingObjective | null>(null);
  const [objForm, setObjForm] = useState({ objectifPrincipal: "", indicateursReussite: "" });
  const [objSaving, setObjSaving] = useState(false);
  const [objSaved, setObjSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [sessionForm, setSessionForm] = useState<Omit<Session, "id">>(emptySessionForm(""));

  useEffect(() => {
    async function load() {
      const [c, s, obj] = await Promise.all([
        getCoacheeById(id),
        getSessionsByCoachee(id),
        getObjectiveByCoachee(id),
      ]);
      setCoachee(c);
      setSessions(s);
      if (obj) {
        setObjective(obj);
        setObjForm({ objectifPrincipal: obj.objectifPrincipal, indicateursReussite: obj.indicateursReussite });
      }
      setLoading(false);
    }
    load();
  }, [id]);

  async function saveObjective() {
    if (!coachee) return;
    setObjSaving(true);
    try {
      const obj: CoachingObjective = {
        id: objective?.id ?? generateId(),
        coacheeId: coachee.id,
        objectifPrincipal: objForm.objectifPrincipal,
        indicateursReussite: objForm.indicateursReussite,
      };
      await upsertObjective(obj);
      setObjective(obj);
      setObjSaved(true);
      setTimeout(() => setObjSaved(false), 2000);
    } finally {
      setObjSaving(false);
    }
  }

  function openNewSession() {
    setSessionForm(emptySessionForm(id));
    setModal(true);
  }

  async function saveSession() {
    const numeroSeance = sessions.length + 1;
    await createSession({ ...sessionForm, id: generateId(), numeroSeance });
    const updated = await getSessionsByCoachee(id);
    setSessions(updated);
    setModal(false);
  }

  if (loading) return null;
  if (!coachee) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-4xl mb-3">🔍</p>
        <p>Coaché introuvable</p>
        <Link href="/coaching/coachees" className="mt-4 inline-block text-sm text-indigo-600 hover:underline">
          Retour à la liste
        </Link>
      </div>
    );
  }

  const pct = Math.round((coachee.seancesFaites / coachee.nbSeances) * 100);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/coaching/coachees"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors mb-6"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Mes coachés
      </Link>

      {/* Coachee header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
              {coachee.prenom[0]}{coachee.nom[0]}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{coachee.prenom} {coachee.nom}</h1>
              <p className="text-sm text-gray-500">
                {coachee.fonction}{coachee.entreprise ? ` · ${coachee.entreprise}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge label={statusLabel[coachee.statut as CoachingStatut]} variant={statusVariant[coachee.statut as CoachingStatut]} />
                {coachee.typeCoaching && (
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{coachee.typeCoaching}</span>
                )}
                {coachee.tarifSeance && (
                  <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">{coachee.tarifSeance}/séance</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
            {coachee.telephone && (
              <a href={`tel:${coachee.telephone}`} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                <PhoneIcon className="w-3.5 h-3.5" />{coachee.telephone}
              </a>
            )}
            {coachee.email && (
              <a href={`mailto:${coachee.email}`} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                <EnvelopeIcon className="w-3.5 h-3.5" />{coachee.email}
              </a>
            )}
            {coachee.linkedin && (
              <a href={coachee.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                <LinkIcon className="w-3.5 h-3.5" />LinkedIn
              </a>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mt-5">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Progression</span>
            <span>{coachee.seancesFaites} / {coachee.nbSeances} séances ({pct}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-indigo-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Objectif de la mission */}
      <div className="bg-indigo-50/60 rounded-xl border border-indigo-100 p-5 mb-6">
        <h2 className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-4">
          Objectif de la mission
        </h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Objectif principal</label>
            <textarea
              className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-gray-300"
              rows={2}
              value={objForm.objectifPrincipal}
              onChange={(e) => setObjForm((f) => ({ ...f, objectifPrincipal: e.target.value }))}
              placeholder="Décrivez l'objectif principal du coaching..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Indicateurs de réussite</label>
            <textarea
              className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-gray-300"
              rows={2}
              value={objForm.indicateursReussite}
              onChange={(e) => setObjForm((f) => ({ ...f, indicateursReussite: e.target.value }))}
              placeholder="Quels signes montreront que l'objectif est atteint ?"
            />
          </div>
          <button
            onClick={saveObjective}
            disabled={objSaving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {objSaved && <CheckIcon className="w-3.5 h-3.5" />}
            {objSaved ? "Sauvegardé" : objSaving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>

      {/* Sessions list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">
            Séances {sessions.length > 0 && <span className="text-gray-400 font-normal">({sessions.length})</span>}
          </h2>
          <button
            onClick={openNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Nouvelle séance
          </button>
        </div>
        {sessions.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm">Aucune séance enregistrée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session, i) => (
              <SessionRow key={session.id} session={session} index={i} objective={objective} />
            ))}
          </div>
        )}
      </div>

      {/* Modal — nouvelle séance */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Nouvelle séance</h2>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
                  <input className="input" type="date" value={sessionForm.date} onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Durée</label>
                  <select className="input" value={sessionForm.duree} onChange={e => setSessionForm(f => ({ ...f, duree: Number(e.target.value) }))}>
                    {dureeOptions.map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Niveau d&apos;énergie du coaché</label>
                  <select className="input" value={sessionForm.niveauEnergie} onChange={e => setSessionForm(f => ({ ...f, niveauEnergie: Number(e.target.value) }))}>
                    <option value={0}>— Non défini</option>
                    <option value={1}>1 — Très bas</option>
                    <option value={2}>2 — Bas</option>
                    <option value={3}>3 — Moyen</option>
                    <option value={4}>4 — Élevé</option>
                    <option value={5}>5 — Excellent</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Prochain RDV</label>
                  <input className="input" type="date" value={sessionForm.prochainRdv ?? ""} onChange={e => setSessionForm(f => ({ ...f, prochainRdv: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Objectif de la séance</label>
                  <input className="input" value={sessionForm.objectifSeance} onChange={e => setSessionForm(f => ({ ...f, objectifSeance: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Ce qui a bien marché</label>
                  <textarea className="input resize-none" rows={2} value={sessionForm.bienMarche} onChange={e => setSessionForm(f => ({ ...f, bienMarche: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Ce qui bloque</label>
                  <textarea className="input resize-none" rows={2} value={sessionForm.ceQuiBloque} onChange={e => setSessionForm(f => ({ ...f, ceQuiBloque: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Action pour la prochaine séance</label>
                  <textarea className="input resize-none" rows={2} value={sessionForm.actionSuivante} onChange={e => setSessionForm(f => ({ ...f, actionSuivante: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Résumé général</label>
                  <textarea className="input resize-none" rows={2} value={sessionForm.resume} onChange={e => setSessionForm(f => ({ ...f, resume: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Points clés</label>
                  <textarea className="input resize-none" rows={2} value={sessionForm.pointsCles} onChange={e => setSessionForm(f => ({ ...f, pointsCles: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
              <button onClick={saveSession} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
