"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getAllProspects,
  createProspect,
  updateProspect,
  removeProspect,
  getActionsForProspect,
  createProspectAction,
} from "@/lib/db";
import { Prospect, ProspectAction, ProspectStatus, ActionType, generateId } from "@/lib/store";
import Badge from "@/components/Badge";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  PencilSquareIcon,
  ArrowsRightLeftIcon,
  ChatBubbleLeftIcon,
} from "@heroicons/react/24/outline";

const statusOptions: ProspectStatus[] = [
  "À contacter",
  "Contacté",
  "En discussion",
  "Proposition envoyée",
  "Signé",
  "Perdu",
];

const manualActionTypes: ActionType[] = ["Appel", "Email", "RDV", "Note"];

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

function ActionIcon({ type }: { type: ActionType }) {
  const cls = "w-3.5 h-3.5";
  switch (type) {
    case "relance": return <ArrowPathIcon className={cls} />;
    case "statut": return <ArrowsRightLeftIcon className={cls} />;
    case "Appel": case "contact": return <PhoneIcon className={cls} />;
    case "Email": return <EnvelopeIcon className={cls} />;
    case "RDV": return <CalendarIcon className={cls} />;
    case "Note": case "note": return <PencilSquareIcon className={cls} />;
    default: return <ChatBubbleLeftIcon className={cls} />;
  }
}

const actionDotColor: Record<string, string> = {
  relance: "bg-blue-500",
  statut: "bg-indigo-500",
  Appel: "bg-emerald-500",
  contact: "bg-emerald-500",
  Email: "bg-amber-400",
  RDV: "bg-purple-500",
  Note: "bg-gray-400",
  note: "bg-gray-400",
};

const actionLabel: Record<string, string> = {
  relance: "Relance",
  statut: "Statut",
  Appel: "Appel",
  contact: "Contact",
  Email: "Email",
  RDV: "RDV",
  Note: "Note",
  note: "Note",
};

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [form, setForm] = useState(emptyProspect());
  const [filter, setFilter] = useState<ProspectStatus | "tous">("tous");

  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [actions, setActions] = useState<ProspectAction[]>([]);
  const [addActionForm, setAddActionForm] = useState(false);
  const [actionForm, setActionForm] = useState<{ type: ActionType; description: string }>({
    type: "Appel",
    description: "",
  });

  // Keep ref for realtime handler (avoids stale closure)
  const selectedRef = useRef<Prospect | null>(null);
  selectedRef.current = selectedProspect;

  async function load() {
    const data = await getAllProspects();
    setProspects(data);
    setLoading(false);
  }

  async function loadActions(prospectId: string) {
    const data = await getActionsForProspect(prospectId);
    setActions(data);
  }

  useEffect(() => {
    load();

    const prospectsChannel = supabase
      .channel("prospects-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => {
        getAllProspects().then(setProspects);
      })
      .subscribe();

    const actionsChannel = supabase
      .channel("prospect-actions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_actions" }, () => {
        const sel = selectedRef.current;
        if (sel) loadActions(sel.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(prospectsChannel);
      supabase.removeChannel(actionsChannel);
    };
  }, []);

  function openAdd() { setEditing(null); setForm(emptyProspect()); setModal(true); }
  function openEdit(p: Prospect) { setEditing(p); setForm({ ...p }); setModal(true); }

  async function save() {
    if (editing) {
      if (editing.statut !== form.statut) {
        await createProspectAction({
          id: generateId(),
          prospectId: editing.id,
          date: new Date().toISOString(),
          type: "statut",
          description: `Statut changé : ${editing.statut} → ${form.statut}`,
          auteur: "",
        });
      }
      await updateProspect(editing.id, { ...form, id: editing.id });
      if (selectedProspect?.id === editing.id) {
        setSelectedProspect({ ...form, id: editing.id });
        await loadActions(editing.id);
      }
    } else {
      await createProspect({ ...form, id: generateId() });
    }
    await load();
    setModal(false);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce prospect ?")) return;
    await removeProspect(id);
    if (selectedProspect?.id === id) setSelectedProspect(null);
    await load();
  }

  async function relancer(p: Prospect) {
    const today = new Date().toISOString().split("T")[0];
    await updateProspect(p.id, { ...p, dernierContact: today });
    await createProspectAction({
      id: generateId(),
      prospectId: p.id,
      date: new Date().toISOString(),
      type: "relance",
      description: "Relance effectuée",
      auteur: "",
    });
    await load();
    if (selectedProspect?.id === p.id) {
      setSelectedProspect({ ...p, dernierContact: today });
      await loadActions(p.id);
    }
  }

  async function openPanel(p: Prospect) {
    setSelectedProspect(p);
    setAddActionForm(false);
    setActionForm({ type: "Appel", description: "" });
    await loadActions(p.id);
  }

  function closePanel() {
    setSelectedProspect(null);
    setActions([]);
    setAddActionForm(false);
  }

  async function saveAction() {
    if (!actionForm.description.trim() || !selectedProspect) return;
    await createProspectAction({
      id: generateId(),
      prospectId: selectedProspect.id,
      date: new Date().toISOString(),
      type: actionForm.type,
      description: actionForm.description.trim(),
      auteur: "",
    });
    setActionForm({ type: "Appel", description: "" });
    setAddActionForm(false);
    await loadActions(selectedProspect.id);
  }

  if (loading) return null;

  const filtered = filter === "tous"
    ? prospects
    : prospects.filter(p => p.statut === filter);

  const isInactive = (p: Prospect) => p.statut === "Signé" || p.statut === "Perdu";
  const isOverdue = (p: Prospect) => !isInactive(p) && daysSince(p.dernierContact) > 7;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 min-w-0 p-8">
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
                const isSelected = selectedProspect?.id === p.id;
                return (
                  <tr
                    key={p.id}
                    onClick={() => openPanel(p)}
                    className={`cursor-pointer transition-colors ${inactive ? "opacity-40" : ""} ${isSelected ? "bg-indigo-50/60" : "hover:bg-gray-50/50"}`}
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
                      <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => relancer(p)}
                          className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                          title="Relancer"
                        >
                          <ArrowPathIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                          title="Modifier"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                          title="Supprimer"
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
      </div>

      {/* Detail panel */}
      {selectedProspect && (
        <div className="w-[400px] flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{selectedProspect.entreprise}</h2>
              <button
                onClick={closePanel}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {selectedProspect.nomContact}
              {selectedProspect.posteContact && (
                <span className="text-gray-400"> · {selectedProspect.posteContact}</span>
              )}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge label={selectedProspect.statut} variant={statusVariant[selectedProspect.statut]} />
              <span className="text-xs text-gray-400">
                Dernier contact :{" "}
                <span className="text-gray-600">
                  {new Date(selectedProspect.dernierContact).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              </span>
            </div>
            {selectedProspect.note && (
              <p className="mt-3 text-xs text-gray-400 italic leading-relaxed">{selectedProspect.note}</p>
            )}
          </div>

          {/* Actions section */}
          <div className="px-6 py-4 flex-1">
            {/* Add action button */}
            {!addActionForm && (
              <button
                onClick={() => setAddActionForm(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600 rounded-xl py-2.5 text-sm font-medium transition-colors mb-5"
              >
                <PlusIcon className="w-4 h-4" /> Ajouter une action
              </button>
            )}

            {/* Inline add form */}
            {addActionForm && (
              <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Type</label>
                  <select
                    className="input text-sm"
                    value={actionForm.type}
                    onChange={e => setActionForm(f => ({ ...f, type: e.target.value as ActionType }))}
                  >
                    {manualActionTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
                  <textarea
                    className="input resize-none text-sm"
                    rows={3}
                    placeholder="Détails de l'action..."
                    value={actionForm.description}
                    onChange={e => setActionForm(f => ({ ...f, description: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setAddActionForm(false); setActionForm({ type: "Appel", description: "" }); }}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveAction}
                    className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            {actions.length === 0 ? (
              <p className="text-center text-gray-400 italic text-xs py-6">Aucune action enregistrée</p>
            ) : (
              <div className="space-y-0">
                {actions.map((a, i) => (
                  <div key={a.id} className="flex gap-3">
                    {/* Left column: dot + line */}
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${actionDotColor[a.type] ?? "bg-gray-400"}`} />
                      {i < actions.length - 1 && (
                        <div className="w-px flex-1 bg-gray-100 my-1" />
                      )}
                    </div>
                    {/* Right column: content */}
                    <div className="pb-4 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-gray-400">
                          <ActionIcon type={a.type} />
                        </span>
                        <span className="text-xs font-semibold text-gray-700">{actionLabel[a.type] ?? a.type}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">
                          {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          {" "}
                          {new Date(a.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {a.description && (
                        <p className="text-xs text-gray-600 leading-relaxed">{a.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit/Add modal */}
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
