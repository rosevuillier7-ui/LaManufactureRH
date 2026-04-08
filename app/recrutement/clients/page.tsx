"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllClients, createClient, updateClient, removeClient } from "@/lib/db";
import { Client, ClientStatus, generateId } from "@/lib/store";
import Badge from "@/components/Badge";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

const statusLabel: Record<ClientStatus, string> = {
  actif: "Actif",
  prospect: "Prospect",
  inactif: "Inactif",
};
const statusVariant: Record<ClientStatus, "green" | "yellow" | "gray"> = {
  actif: "green",
  prospect: "yellow",
  inactif: "gray",
};

const emptyClient = (): Omit<Client, "id"> => ({
  nom: "",
  entreprise: "",
  contact: "",
  email: "",
  telephone: "",
  secteur: "",
  statut: "prospect",
  dateCreation: new Date().toISOString().split("T")[0],
  notes: "",
});

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyClient());

  async function load() {
    const data = await getAllClients();
    setClients(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("clients-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        getAllClients().then(setClients);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function openAdd() { setEditing(null); setForm(emptyClient()); setModal(true); }
  function openEdit(c: Client) { setEditing(c); setForm({ ...c }); setModal(true); }

  async function save() {
    if (editing) {
      await updateClient(editing.id, { ...form, id: editing.id });
    } else {
      await createClient({ ...form, id: generateId() });
    }
    await load();
    setModal(false);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce client ?")) return;
    await removeClient(id);
    await load();
  }

  if (loading) return null;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 mt-1">{clients.length} clients enregistrés</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" /> Nouveau client
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-6 py-3 font-medium text-gray-500">Entreprise</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Contact</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Secteur</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Statut</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Email</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <tr key={client.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{client.entreprise}</td>
                <td className="px-6 py-4 text-gray-600">{client.contact}</td>
                <td className="px-6 py-4 text-gray-500">{client.secteur}</td>
                <td className="px-6 py-4">
                  <Badge label={statusLabel[client.statut]} variant={statusVariant[client.statut]} />
                </td>
                <td className="px-6 py-4 text-gray-500">{client.email}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={() => openEdit(client)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(client.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-6">{editing ? "Modifier le client" : "Nouveau client"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Entreprise</label>
                <input className="input" value={form.entreprise} onChange={e => setForm(f => ({ ...f, entreprise: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Contact</label>
                <input className="input" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} />
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
                <label className="text-xs font-medium text-gray-500 block mb-1">Secteur</label>
                <input className="input" value={form.secteur} onChange={e => setForm(f => ({ ...f, secteur: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Statut</label>
                <select className="input" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as ClientStatus }))}>
                  <option value="prospect">Prospect</option>
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
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
