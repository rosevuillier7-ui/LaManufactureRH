"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllProspects, createProspect, updateProspect, removeProspect } from "@/lib/db";
import { Prospect, ProspectStatus, generateId } from "@/lib/store";
import Badge from "@/components/Badge";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

const statusOptions: ProspectStatus[] = [
  "À contacter",
  "Contacté",
  "En discussion",
  "Proposition envoyée",
  "Signé",
  "Perdu",
];

const statusVariant: Record<ProspectStatus, "gray" | "yellow" | "blue" | "indigo" | "green" | "red"> = {
  "À contacter": "gray",
  "Contacté": "yellow",
  "En discussion": "blue",
  "Proposition envoyée": "indigo",
  "Signé": "green",
  "Perdu": "red",
};

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

const emptyProspect = (): Omit<Prospect, "id"> => ({
  entreprise: "",
  nomContact: "",
  posteContact: "",
  statut: "À contacter",
  dernierContact: new Date().toISOString().split("T")[0],
  note: "",
});

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [form, setForm] = useState(emptyProspect());
  const [filter, setFilter] = useState<ProspectStatus | "tous">("tous");

  async function load() {
    const data = await getAllProspects();
    setProspects(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("prospects-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => {
        getAllProspects().then(setProspects);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function openAdd() { setEditing(null); setForm(emptyProspect()); setModal(true); }
  function openEdit(p: Prospect) { setEditing(p); setForm({ ...p }); setModal(true); }

  async function save() {
    if (editing) {
      await updateProspect(editing.id, { ...form, id: editing.id });
    } else {
      await createProspect({ ...form, id: generateId() });
    }
    await load();
    setModal(false);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce prospect ?")) return;
    await removeProspect(id);
    await load();
  }

  if (loading) return null;

  const filtered = filter === "tous"
    ? prospects
    : prospects.filter(p => p.statut === filter);

  const isInactive = (p: Prospect) => p.statut === "Signé" || p.statut === "Perdu";
  const isOverdue = (p: Prospect) => !isInactive(p) && daysSince(p.dernierContact) > 7;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500 mt-1">
            {prospects.filter(p => !isInactive(p)).length} prospects actifs
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" /> Nouveau prospect
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("tous")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === "tous" ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}
        >
          Tous
        </button>
        {statusOptions.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Entreprise</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Poste</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dernier contact</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Note</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(p => {
              const inactive = isInactive(p);
              const overdue = isOverdue(p);
              const days = daysSince(p.dernierContact);
              return (
                <tr
                  key={p.id}
                  className={`transition-colors ${inactive ? "opacity-40" : "hover:bg-gray-50/50"}`}
                >
                  <td className="px-5 py-4 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {overdue && (
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Pas de contact depuis plus de 7 jours" />
                      )}
                      {p.entreprise}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-700">{p.nomContact}</td>
                  <td className="px-5 py-4 text-gray-500">{p.posteContact}</td>
                  <td className="px-5 py-4">
                    <Badge label={p.statut} variant={statusVariant[p.statut]} />
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    <span className={overdue ? "text-red-500 font-medium" : ""}>
                      {new Date(p.dernierContact).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </span>
                    {overdue && (
                      <span className="text-xs text-red-400 ml-1">({days}j)</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-400 max-w-xs truncate">{p.note}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(p.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-gray-400 italic text-sm">
                  Aucun prospect
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-6">
              {editing ? "Modifier le prospect" : "Nouveau prospect"}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Entreprise</label>
                <input
                  className="input"
                  value={form.entreprise}
                  onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nom du contact</label>
                <input
                  className="input"
                  value={form.nomContact}
                  onChange={e => setForm(f => ({ ...f, nomContact: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Poste du contact</label>
                <input
                  className="input"
                  value={form.posteContact}
                  onChange={e => setForm(f => ({ ...f, posteContact: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Statut</label>
                <select
                  className="input"
                  value={form.statut}
                  onChange={e => setForm(f => ({ ...f, statut: e.target.value as ProspectStatus }))}
                >
                  {statusOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Date dernier contact</label>
                <input
                  className="input"
                  type="date"
                  value={form.dernierContact}
                  onChange={e => setForm(f => ({ ...f, dernierContact: e.target.value }))}
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Note</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={save}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
