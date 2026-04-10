"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllSessions, createSession, updateSession, removeSession, getAllCoachees } from "@/lib/db";
import { Session, Coachee, generateId } from "@/lib/store";
import { PlusIcon, PencilIcon, TrashIcon, ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";

const dureeOptions = [30, 45, 60, 90, 120];

const energyColor = (n: number) => {
  if (n === 0) return "bg-gray-200 text-gray-400";
  if (n <= 2) return "bg-rose-100 text-rose-600";
  if (n === 3) return "bg-amber-100 text-amber-600";
  return "bg-emerald-100 text-emerald-600";
};

const energyDot = (n: number) => {
  if (n === 0) return "bg-gray-300";
  if (n <= 2) return "bg-rose-500";
  if (n === 3) return "bg-amber-400";
  return "bg-emerald-500";
};

const emptySession = (): Omit<Session, "id"> => ({
  coacheeId: "",
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

export default function SeancesPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [coachees, setCoachees] = useState<Coachee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [form, setForm] = useState(emptySession());

  // Compte-rendu state
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [compteRendu, setCompteRendu] = useState<{ id: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [apiKeyModal, setApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  async function load() {
    const [s, c] = await Promise.all([getAllSessions(), getAllCoachees()]);
    setSessions(s);
    setCoachees(c);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("seances-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "coachees" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function openAdd() { setEditing(null); setForm(emptySession()); setModal(true); }
  function openEdit(s: Session) {
    setEditing(s);
    setForm({ ...s, prochainRdv: s.prochainRdv ?? "" });
    setModal(true);
  }

  async function save() {
    let sessionData = { ...form };
    if (!editing) {
      const coacheeSessions = sessions.filter(s => s.coacheeId === form.coacheeId);
      sessionData = { ...sessionData, numeroSeance: coacheeSessions.length + 1 };
      await createSession({ ...sessionData, id: generateId() });
    } else {
      await updateSession(editing.id, { ...sessionData, id: editing.id });
    }
    await load();
    setModal(false);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette séance ?")) return;
    await removeSession(id);
    await load();
  }

  function getApiKey(): string {
    if (typeof window !== "undefined") return localStorage.getItem("anthropic_api_key") || "";
    return "";
  }

  async function genererCompteRendu(sessionId: string) {
    const key = getApiKey();
    if (!key) {
      setPendingSessionId(sessionId);
      setApiKeyModal(true);
      return;
    }
    await doGenerer(sessionId, key);
  }

  async function doGenerer(sessionId: string, key: string) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    const coachee = coachees.find(c => c.id === session.coacheeId);
    setGeneratingId(sessionId);
    try {
      const userMessage = [
        `Coaché : ${coachee ? `${coachee.prenom} ${coachee.nom}` : "—"}`,
        `Date : ${new Date(session.date).toLocaleDateString("fr-FR")}`,
        `Séance n°${session.numeroSeance} — ${session.duree} min`,
        session.objectifSeance ? `Objectif de la séance : ${session.objectifSeance}` : "",
        session.resume ? `Résumé : ${session.resume}` : "",
        session.bienMarche ? `Ce qui a bien marché : ${session.bienMarche}` : "",
        session.ceQuiBloque ? `Ce qui bloque : ${session.ceQuiBloque}` : "",
        session.actionSuivante ? `Action pour la prochaine séance : ${session.actionSuivante}` : "",
        session.pointsCles ? `Points clés : ${session.pointsCles}` : "",
        session.niveauEnergie > 0 ? `Niveau d'énergie du coaché : ${session.niveauEnergie}/5` : "",
      ].filter(Boolean).join("\n");

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 1500,
          system: "Tu es un coach professionnel expert en documentation de séance. À partir de notes brutes, rédige un compte-rendu de séance structuré et professionnel en français. Structure : 1) Thème principal, 2) Prises de conscience, 3) Points clés travaillés, 4) Plan d'action décidé, 5) Prochain objectif. Style synthétique, bienveillant, centré sur le coaché.",
          messages: [{ role: "user", content: userMessage }],
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? `Erreur ${res.status}`);
      }
      const data = await res.json();
      setCompteRendu({ id: sessionId, text: data.content[0]?.text ?? "" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      alert(`Erreur lors de la génération : ${msg}`);
    } finally {
      setGeneratingId(null);
    }
  }

  function saveApiKey() {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem("anthropic_api_key", apiKeyInput.trim());
    setApiKeyModal(false);
    if (pendingSessionId) {
      doGenerer(pendingSessionId, apiKeyInput.trim());
      setPendingSessionId(null);
    }
    setApiKeyInput("");
  }

  async function copyCompteRendu() {
    if (!compteRendu) return;
    await navigator.clipboard.writeText(compteRendu.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return null;

  // Group sessions by coachee
  const grouped = new Map<string, Session[]>();
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sorted) {
    if (!grouped.has(s.coacheeId)) grouped.set(s.coacheeId, []);
    grouped.get(s.coacheeId)!.push(s);
  }

  // Order groups by most recent session
  const groupEntries = Array.from(grouped.entries()).sort(([, a], [, b]) =>
    (b[0]?.date ?? "").localeCompare(a[0]?.date ?? "")
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Séances de coaching</h1>
          <p className="text-gray-500 mt-1">{sessions.length} séances enregistrées</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <PlusIcon className="w-4 h-4" /> Nouvelle séance
        </button>
      </div>

      {sessions.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📅</p>
          <p>Aucune séance enregistrée</p>
        </div>
      )}

      <div className="space-y-8">
        {groupEntries.map(([coacheeId, groupSessions]) => {
          const coachee = coachees.find(c => c.id === coacheeId);
          return (
            <div key={coacheeId}>
              {/* Coachee header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                  {coachee ? `${coachee.prenom[0]}${coachee.nom[0]}` : "?"}
                </div>
                <h2 className="font-semibold text-gray-900">
                  {coachee ? `${coachee.prenom} ${coachee.nom}` : "Coaché inconnu"}
                </h2>
                <span className="text-xs text-gray-400">{groupSessions.length} séance{groupSessions.length > 1 ? "s" : ""}</span>
              </div>

              <div className="space-y-3 pl-11">
                {groupSessions.map(session => (
                  <div key={session.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                    <div className="flex items-start gap-4">
                      {/* Date badge */}
                      <div className="w-12 h-12 rounded-xl bg-emerald-100 flex flex-col items-center justify-center text-emerald-700 flex-shrink-0">
                        <span className="text-xs font-bold">
                          {new Date(session.date).toLocaleDateString("fr-FR", { day: "numeric" })}
                        </span>
                        <span className="text-xs capitalize">
                          {new Date(session.date).toLocaleDateString("fr-FR", { month: "short" })}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          {session.numeroSeance > 0 && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                              #{session.numeroSeance}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">{session.duree} min</span>
                          {session.niveauEnergie > 0 && (
                            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${energyColor(session.niveauEnergie)}`}>
                              <span className={`w-2 h-2 rounded-full ${energyDot(session.niveauEnergie)}`} />
                              Énergie {session.niveauEnergie}/5
                            </span>
                          )}
                          {session.prochainRdv && (
                            <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              Prochain : {new Date(session.prochainRdv).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </div>

                        {/* Content sections */}
                        <div className="space-y-2 text-sm">
                          {session.objectifSeance && (
                            <p className="text-gray-700"><span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Objectif · </span>{session.objectifSeance}</p>
                          )}
                          {session.resume && (
                            <p className="text-gray-600">{session.resume}</p>
                          )}
                          {session.bienMarche && (
                            <div className="bg-emerald-50 rounded-lg px-3 py-2 text-xs text-emerald-700">
                              <span className="font-medium">✓ Ce qui a bien marché : </span>{session.bienMarche}
                            </div>
                          )}
                          {session.ceQuiBloque && (
                            <div className="bg-rose-50 rounded-lg px-3 py-2 text-xs text-rose-700">
                              <span className="font-medium">⚠ Ce qui bloque : </span>{session.ceQuiBloque}
                            </div>
                          )}
                          {session.actionSuivante && (
                            <div className="bg-indigo-50 rounded-lg px-3 py-2 text-xs text-indigo-700">
                              <span className="font-medium">→ Action suivante : </span>{session.actionSuivante}
                            </div>
                          )}
                          {session.pointsCles && (
                            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                              💡 {session.pointsCles}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={() => genererCompteRendu(session.id)}
                          disabled={generatingId === session.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                          {generatingId === session.id ? "..." : "Compte-rendu"}
                        </button>
                        <button onClick={() => openEdit(session)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(session.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal — nouvelle/modifier séance */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{editing ? "Modifier la séance" : "Nouvelle séance"}</h2>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Coaché</label>
                  <select className="input" value={form.coacheeId} onChange={e => setForm(f => ({ ...f, coacheeId: e.target.value }))}>
                    <option value="">Sélectionner</option>
                    {coachees.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Durée</label>
                  <select className="input" value={form.duree} onChange={e => setForm(f => ({ ...f, duree: Number(e.target.value) }))}>
                    {dureeOptions.map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Niveau d&apos;énergie du coaché</label>
                  <select className="input" value={form.niveauEnergie} onChange={e => setForm(f => ({ ...f, niveauEnergie: Number(e.target.value) }))}>
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
                  <input className="input" type="date" value={form.prochainRdv ?? ""} onChange={e => setForm(f => ({ ...f, prochainRdv: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Objectif de la séance</label>
                  <input className="input" value={form.objectifSeance} onChange={e => setForm(f => ({ ...f, objectifSeance: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Ce qui a bien marché</label>
                  <textarea className="input resize-none" rows={2} value={form.bienMarche} onChange={e => setForm(f => ({ ...f, bienMarche: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Ce qui bloque</label>
                  <textarea className="input resize-none" rows={2} value={form.ceQuiBloque} onChange={e => setForm(f => ({ ...f, ceQuiBloque: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Action pour la prochaine séance</label>
                  <textarea className="input resize-none" rows={2} value={form.actionSuivante} onChange={e => setForm(f => ({ ...f, actionSuivante: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Résumé général</label>
                  <textarea className="input resize-none" rows={2} value={form.resume} onChange={e => setForm(f => ({ ...f, resume: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Points clés</label>
                  <textarea className="input resize-none" rows={2} value={form.pointsCles} onChange={e => setForm(f => ({ ...f, pointsCles: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — compte-rendu généré */}
      {compteRendu && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[85vh]">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Compte-rendu de séance</h2>
              <button
                onClick={copyCompteRendu}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                {copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                {copied ? "Copié !" : "Copier"}
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{compteRendu.text}</pre>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setCompteRendu(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Fermer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — clé API */}
      {apiKeyModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-2">Clé API Anthropic</h2>
            <p className="text-sm text-gray-500 mb-4">
              Entrez votre clé API Anthropic pour générer le compte-rendu. Elle sera stockée uniquement dans votre navigateur.
            </p>
            <input
              className="input mb-4"
              type="password"
              placeholder="sk-ant-..."
              value={apiKeyInput}
              onChange={e => setApiKeyInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveApiKey()}
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setApiKeyModal(false); setPendingSessionId(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
              <button onClick={saveApiKey} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
