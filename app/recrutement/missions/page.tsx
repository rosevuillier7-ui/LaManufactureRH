"use client";

import { useEffect, useState } from "react";
import { loadData, saveData, AppData, Mission, generateId, MissionStatus } from "@/lib/store";
import Badge from "@/components/Badge";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

const statusLabel: Record<MissionStatus, string> = {
  ouverte: "Ouverte",
  en_cours: "En cours",
  pourvue: "Pourvue",
  annulée: "Annulée",
};
const statusVariant: Record<MissionStatus, "yellow" | "blue" | "green" | "red"> = {
  ouverte: "yellow",
  en_cours: "blue",
  pourvue: "green",
  annulée: "red",
};

const emptyMission = (): Omit<Mission, "id"> => ({
  titre: "",
  clientId: "",
  statut: "ouverte",
  poste: "",
  salaire: "",
  localisation: "",
  dateOuverture: new Date().toISOString().split("T")[0],
  notes: "",
});

export default function MissionsPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Mission | null>(null);
  const [form, setForm] = useState(emptyMission());

  useEffect(() => { setData(loadData()); }, []);

  function openAdd() { setEditing(null); setForm(emptyMission()); setModal(true); }
  function openEdit(m: Mission) { setEditing(m); setForm({ ...m }); setModal(true); }

  function save() {
    if (!data) return;
    let missions: Mission[];
    if (editing) {
      missions = data.missions.map(m => m.id === editing.id ? { ...form, id: editing.id } : m);
    } else {
      missions = [...data.missions, { ...form, id: generateId() }];
    }
    const updated = { ...data, missions };
    saveData(updated);
    setData(updated);
    setModal(false);
  }

  function remove(id: string) {
    if (!data || !confirm("Supprimer cette mission ?")) return;
    const updated = { ...data, missions: data.missions.filter(m => m.id !== id) };
    saveData(updated);
    setData(updated);
  }

  if (!data) return null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Missions</h1>
          <p className="text-gray-500 mt-1">{data.missions.length} missions au total</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <PlusIcon className="w-4 h-4" /> Nouvelle mission
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 font-medium text-gray-500">Mission</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Client</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Localisation</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Salaire</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Statut</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Ouverture</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.missions.map(mission => {
              const client = data.clients.find(c => c.id === mission.clientId);
              return (
                <tr key={mission.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{mission.titre}</p>
                    <p className="text-xs text-gray-400">{mission.poste}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{client?.entreprise ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-500">{mission.localisation}</td>
                  <td className="px-6 py-4 text-gray-500">{mission.salaire}</td>
                  <td className="px-6 py-4">
                    <Badge label={statusLabel[mission.statut]} variant={statusVariant[mission.statut]} />
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    {new Date(mission.dateOuverture).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(mission)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => remove(mission.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-6">{editing ? "Modifier la mission" : "Nouvelle mission"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Titre</label>
                <input className="input" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Client</label>
                <select className="input" value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}>
                  <option value="">Sélectionner</option>
                  {data.clients.map(c => <option key={c.id} value={c.id}>{c.entreprise}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Statut</label>
                <select className="input" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as MissionStatus }))}>
                  <option value="ouverte">Ouverte</option>
                  <option value="en_cours">En cours</option>
                  <option value="pourvue">Pourvue</option>
                  <option value="annulée">Annulée</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Poste</label>
                <input className="input" value={form.poste} onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Salaire</label>
                <input className="input" placeholder="ex: 60-70K€" value={form.salaire} onChange={e => setForm(f => ({ ...f, salaire: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Localisation</label>
                <input className="input" value={form.localisation} onChange={e => setForm(f => ({ ...f, localisation: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Date d&apos;ouverture</label>
                <input className="input" type="date" value={form.dateOuverture} onChange={e => setForm(f => ({ ...f, dateOuverture: e.target.value }))} />
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
