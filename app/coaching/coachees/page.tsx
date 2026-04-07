"use client";

import { useEffect, useState } from "react";
import { loadData, saveData, AppData, Coachee, generateId, CoachingStatut } from "@/lib/store";
import Badge from "@/components/Badge";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

const statusLabel: Record<CoachingStatut, string> = {
  actif: "Actif",
  terminé: "Terminé",
  pause: "En pause",
};
const statusVariant: Record<CoachingStatut, "green" | "gray" | "yellow"> = {
  actif: "green",
  terminé: "gray",
  pause: "yellow",
};

const emptyCoachee = (): Omit<Coachee, "id"> => ({
  nom: "",
  prenom: "",
  fonction: "",
  entreprise: "",
  email: "",
  telephone: "",
  statut: "actif",
  objectif: "",
  nbSeances: 10,
  seancesFaites: 0,
  dateDebut: new Date().toISOString().split("T")[0],
  notes: "",
});

export default function CoacheesPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Coachee | null>(null);
  const [form, setForm] = useState(emptyCoachee());

  useEffect(() => { setData(loadData()); }, []);

  function openAdd() { setEditing(null); setForm(emptyCoachee()); setModal(true); }
  function openEdit(c: Coachee) { setEditing(c); setForm({ ...c }); setModal(true); }

  function save() {
    if (!data) return;
    let coachees: Coachee[];
    if (editing) {
      coachees = data.coachees.map(c => c.id === editing.id ? { ...form, id: editing.id } : c);
    } else {
      coachees = [...data.coachees, { ...form, id: generateId() }];
    }
    const updated = { ...data, coachees };
    saveData(updated);
    setData(updated);
    setModal(false);
  }

  function remove(id: string) {
    if (!data || !confirm("Supprimer ce coaché ?")) return;
    const updated = { ...data, coachees: data.coachees.filter(c => c.id !== id) };
    saveData(updated);
    setData(updated);
  }

  if (!data) return null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes coachés</h1>
          <p className="text-gray-500 mt-1">{data.coachees.length} accompagnements</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <PlusIcon className="w-4 h-4" /> Nouveau coaché
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {data.coachees.map(coachee => {
          const pct = Math.round((coachee.seancesFaites / coachee.nbSeances) * 100);
          const coacheeSessions = data.sessions.filter(s => s.coacheeId === coachee.id);
          const lastSession = coacheeSessions.sort((a, b) => b.date.localeCompare(a.date))[0];

          return (
            <div key={coachee.id} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                    {coachee.prenom[0]}{coachee.nom[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{coachee.prenom} {coachee.nom}</p>
                    <p className="text-xs text-gray-500">{coachee.fonction} · {coachee.entreprise}</p>
                  </div>
                </div>
                <Badge label={statusLabel[coachee.statut]} variant={statusVariant[coachee.statut]} />
              </div>

              {coachee.objectif && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2 italic">
                  &ldquo;{coachee.objectif}&rdquo;
                </p>
              )}

              {/* Progress bar */}
              <div className="mb-4">
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

              {lastSession && (
                <div className="text-xs text-gray-400 mb-3">
                  Dernière séance : {new Date(lastSession.date).toLocaleDateString("fr-FR")}
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-gray-50">
                <button onClick={() => openEdit(coachee)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <PencilIcon className="w-3.5 h-3.5" /> Modifier
                </button>
                <button onClick={() => remove(coachee.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-6">{editing ? "Modifier le coaché" : "Nouveau coaché"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Prénom</label>
                <input className="input" value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nom</label>
                <input className="input" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Fonction</label>
                <input className="input" value={form.fonction} onChange={e => setForm(f => ({ ...f, fonction: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Entreprise</label>
                <input className="input" value={form.entreprise} onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Statut</label>
                <select className="input" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as CoachingStatut }))}>
                  <option value="actif">Actif</option>
                  <option value="pause">En pause</option>
                  <option value="terminé">Terminé</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nb séances total</label>
                <input className="input" type="number" min={1} value={form.nbSeances} onChange={e => setForm(f => ({ ...f, nbSeances: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Séances réalisées</label>
                <input className="input" type="number" min={0} value={form.seancesFaites} onChange={e => setForm(f => ({ ...f, seancesFaites: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Objectif de l&apos;accompagnement</label>
                <textarea className="input resize-none" rows={2} value={form.objectif} onChange={e => setForm(f => ({ ...f, objectif: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
                <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
