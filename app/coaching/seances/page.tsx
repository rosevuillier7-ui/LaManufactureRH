"use client";

import { useEffect, useState } from "react";
import { loadData, saveData, AppData, Session, generateId } from "@/lib/store";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

const emptySession = (): Omit<Session, "id"> => ({
  coacheeId: "",
  date: new Date().toISOString().split("T")[0],
  duree: 60,
  resume: "",
  pointsCles: "",
  prochainRdv: "",
});

export default function SeancesPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [form, setForm] = useState(emptySession());

  useEffect(() => { setData(loadData()); }, []);

  function openAdd() { setEditing(null); setForm(emptySession()); setModal(true); }
  function openEdit(s: Session) { setEditing(s); setForm({ ...s }); setModal(true); }

  function save() {
    if (!data) return;
    let sessions: Session[];
    if (editing) {
      sessions = data.sessions.map(s => s.id === editing.id ? { ...form, id: editing.id } : s);
    } else {
      sessions = [...data.sessions, { ...form, id: generateId() }];
    }
    const updated = { ...data, sessions };
    saveData(updated);
    setData(updated);
    setModal(false);
  }

  function remove(id: string) {
    if (!data || !confirm("Supprimer cette séance ?")) return;
    const updated = { ...data, sessions: data.sessions.filter(s => s.id !== id) };
    saveData(updated);
    setData(updated);
  }

  if (!data) return null;

  const sorted = [...data.sessions].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Séances de coaching</h1>
          <p className="text-gray-500 mt-1">{data.sessions.length} séances enregistrées</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <PlusIcon className="w-4 h-4" /> Nouvelle séance
        </button>
      </div>

      <div className="space-y-4">
        {sorted.map(session => {
          const coachee = data.coachees.find(c => c.id === session.coacheeId);
          return (
            <div key={session.id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex flex-col items-center justify-center text-emerald-700 flex-shrink-0">
                  <span className="text-xs font-bold">
                    {new Date(session.date).toLocaleDateString("fr-FR", { day: "numeric" })}
                  </span>
                  <span className="text-xs capitalize">
                    {new Date(session.date).toLocaleDateString("fr-FR", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold text-gray-900">
                      {coachee ? `${coachee.prenom} ${coachee.nom}` : "—"}
                    </p>
                    <span className="text-xs text-gray-400">{session.duree} min</span>
                    {session.prochainRdv && (
                      <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        Prochain : {new Date(session.prochainRdv).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>
                  {session.resume && (
                    <p className="text-sm text-gray-600 mb-2">{session.resume}</p>
                  )}
                  {session.pointsCles && (
                    <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                      💡 {session.pointsCles}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(session)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(session.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {data.sessions.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">📅</p>
            <p>Aucune séance enregistrée</p>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-6">{editing ? "Modifier la séance" : "Nouvelle séance"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Coaché</label>
                <select className="input" value={form.coacheeId} onChange={e => setForm(f => ({ ...f, coacheeId: e.target.value }))}>
                  <option value="">Sélectionner</option>
                  {data.coachees.map(c => <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Durée (min)</label>
                <input className="input" type="number" value={form.duree} onChange={e => setForm(f => ({ ...f, duree: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Résumé</label>
                <textarea className="input resize-none" rows={2} value={form.resume} onChange={e => setForm(f => ({ ...f, resume: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Points clés</label>
                <textarea className="input resize-none" rows={2} value={form.pointsCles} onChange={e => setForm(f => ({ ...f, pointsCles: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Prochain RDV</label>
                <input className="input" type="date" value={form.prochainRdv} onChange={e => setForm(f => ({ ...f, prochainRdv: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
