"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllCandidats, createCandidat, updateCandidat, removeCandidat, getAllMissions } from "@/lib/db";
import { Candidat, CandidatStatus, Mission, generateId } from "@/lib/store";
import Badge from "@/components/Badge";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

const statusLabel: Record<CandidatStatus, string> = {
  identifié: "Identifié",
  contacté: "Contacté",
  présenté: "Présenté",
  retenu: "Retenu",
  refusé: "Refusé",
};
const statusVariant: Record<CandidatStatus, "gray" | "yellow" | "blue" | "green" | "red"> = {
  identifié: "gray",
  contacté: "yellow",
  présenté: "blue",
  retenu: "green",
  refusé: "red",
};

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

const emptyCandidat = (): Omit<Candidat, "id"> => ({
  nom: "",
  prenom: "",
  poste: "",
  email: "",
  telephone: "",
  linkedin: "",
  statut: "identifié",
  missionId: "",
  dateAjout: new Date().toISOString().split("T")[0],
  dernierContact: new Date().toISOString().split("T")[0],
  notes: "",
});

export default function CandidatsPage() {
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Candidat | null>(null);
  const [form, setForm] = useState(emptyCandidat());
  const [filter, setFilter] = useState<CandidatStatus | "tous">("tous");

  async function load() {
    const [c, m] = await Promise.all([getAllCandidats(), getAllMissions()]);
    setCandidats(c);
    setMissions(m);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("candidats-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "candidats" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "missions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function openAdd() { setEditing(null); setForm(emptyCandidat()); setModal(true); }
  function openEdit(c: Candidat) { setEditing(c); setForm({ ...c }); setModal(true); }

  async function save() {
    if (editing) {
      await updateCandidat(editing.id, { ...form, id: editing.id });
    } else {
      await createCandidat({ ...form, id: generateId() });
    }
    await load();
    setModal(false);
  }

  async function relancer(id: string) {
    const today = new Date().toISOString().split("T")[0];
    const candidat = candidats.find(c => c.id === id);
    if (!candidat) return;
    await updateCandidat(id, { ...candidat, dernierContact: today, statut: "contacté" });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce candidat ?")) return;
    await removeCandidat(id);
    await load();
  }

  if (loading) return null;

  const filtered = filter === "tous" ? candidats : candidats.filter(c => c.statut === filter);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidats</h1>
          <p className="text-gray-500 mt-1">{candidats.length} profils dans le vivier</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <PlusIcon className="w-4 h-4" /> Nouveau candidat
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(["tous", "identifié", "contacté", "présenté", "retenu", "refusé"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === s ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}
          >
            {s === "tous" ? "Tous" : statusLabel[s as CandidatStatus]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(candidat => {
          const mission = missions.find(m => m.id === candidat.missionId);
          const contactDate = candidat.dernierContact || candidat.dateAjout;
          const overdue = daysSince(contactDate) > 5;
          return (
            <div
              key={candidat.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition-colors ${overdue ? "border-orange-300" : "border-gray-100"}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                    {candidat.prenom?.[0]}{candidat.nom?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{candidat.prenom} {candidat.nom}</p>
                    <p className="text-xs text-gray-500">{candidat.poste}</p>
                  </div>
                </div>
                <Badge label={statusLabel[candidat.statut]} variant={statusVariant[candidat.statut]} />
              </div>

              {mission && (
                <div className="mb-3 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                  📋 {mission.titre}
                </div>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                {candidat.email && <p>✉️ {candidat.email}</p>}
                {candidat.telephone && <p>📞 {candidat.telephone}</p>}
                {candidat.linkedin && <p>🔗 {candidat.linkedin}</p>}
              </div>

              <div className={`mt-3 text-xs flex items-center gap-1 ${overdue ? "text-orange-500 font-medium" : "text-gray-400"}`}>
                <span>Dernier contact :</span>
                <span>
                  {new Date(contactDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </span>
                {overdue && <span>({daysSince(contactDate)}j)</span>}
              </div>

              {candidat.notes && (
                <p className="mt-2 text-xs text-gray-400 italic line-clamp-2">{candidat.notes}</p>
              )}

              <div className="flex gap-2 mt-4 pt-3 border-t border-gray-50">
                <button onClick={() => openEdit(candidat)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <PencilIcon className="w-3.5 h-3.5" /> Modifier
                </button>
                <button
                  onClick={() => relancer(candidat.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  ↩ Relancer
                </button>
                <button onClick={() => remove(candidat.id)} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto">
                  <TrashIcon className="w-3.5 h-3.5" /> Supprimer
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-6">{editing ? "Modifier le candidat" : "Nouveau candidat"}</h2>
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
                <label className="text-xs font-medium text-gray-500 block mb-1">Poste recherché</label>
                <input className="input" value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Statut</label>
                <select className="input" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as CandidatStatus }))}>
                  <option value="identifié">Identifié</option>
                  <option value="contacté">Contacté</option>
                  <option value="présenté">Présenté</option>
                  <option value="retenu">Retenu</option>
                  <option value="refusé">Refusé</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Téléphone</label>
                <input className="input" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Date dernier contact</label>
                <input className="input" type="date" value={form.dernierContact || ""} onChange={e => setForm(f => ({ ...f, dernierContact: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">LinkedIn</label>
                <input className="input" value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Mission liée</label>
                <select className="input" value={form.missionId} onChange={e => setForm(f => ({ ...f, missionId: e.target.value }))}>
                  <option value="">Aucune</option>
                  {missions.map(m => <option key={m.id} value={m.id}>{m.titre}</option>)}
                </select>
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
