"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getSignedClients,
  updateProspect,
  getActionsForProspect,
  createProspectAction,
} from "@/lib/db";
import { Prospect, ProspectAction, ActionType, generateId } from "@/lib/store";
import {
  PlusIcon,
  PencilIcon,
  XMarkIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  PencilSquareIcon,
  ArrowsRightLeftIcon,
  ChatBubbleLeftIcon,
  LinkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const typeContactOptions = ["SMS", "Call", "Mail", "LinkedIn"];
const statutPaiementOptions = ["Payé", "Impayé"];
const manualActionTypes: ActionType[] = ["Appel", "Email", "RDV", "Note"];

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

function emptyClientForm(c: Prospect): Omit<Prospect, "id"> {
  return {
    entreprise: c.entreprise,
    nomContact: c.nomContact,
    posteContact: c.posteContact,
    statut: c.statut,
    dernierContact: c.dernierContact,
    note: c.note,
    telephone: c.telephone,
    email: c.email,
    linkedin: c.linkedin,
    typeService: c.typeService,
    typeServiceAutre: c.typeServiceAutre,
    valeurEstimee: c.valeurEstimee,
    prochainRdv: c.prochainRdv,
    secteurActivite: c.secteurActivite ?? "",
    typeContact: c.typeContact ?? "",
    resultat: c.resultat ?? "",
    todo: c.todo ?? "",
    todoDate: c.todoDate ?? "",
    statutPaiement: c.statutPaiement ?? "Payé",
    signedAt: c.signedAt,
  };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [form, setForm] = useState<Omit<Prospect, "id"> | null>(null);

  const [selectedClient, setSelectedClient] = useState<Prospect | null>(null);
  const [actions, setActions] = useState<ProspectAction[]>([]);
  const [addActionForm, setAddActionForm] = useState(false);
  const [actionForm, setActionForm] = useState<{ type: ActionType; description: string }>({
    type: "Appel",
    description: "",
  });

  const selectedRef = useRef<Prospect | null>(null);
  selectedRef.current = selectedClient;

  async function load() {
    const data = await getSignedClients();
    setClients(data);
    setLoading(false);
  }

  async function loadActions(clientId: string) {
    const data = await getActionsForProspect(clientId);
    setActions(data);
  }

  useEffect(() => {
    load();

    const clientsChannel = supabase
      .channel("commercial-clients-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => {
        getSignedClients().then(setClients);
      })
      .subscribe();

    const actionsChannel = supabase
      .channel("commercial-clients-actions-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_actions" }, () => {
        const sel = selectedRef.current;
        if (sel) loadActions(sel.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(clientsChannel);
      supabase.removeChannel(actionsChannel);
    };
  }, []);

  function openEdit(c: Prospect) {
    setEditing(c);
    setForm(emptyClientForm(c));
    setModal(true);
  }

  async function save() {
    if (!editing || !form) return;
    await updateProspect(editing.id, { ...form, id: editing.id });
    if (selectedClient?.id === editing.id) {
      setSelectedClient({ ...form, id: editing.id });
    }
    await load();
    setModal(false);
  }

  async function openPanel(c: Prospect) {
    setSelectedClient(c);
    setAddActionForm(false);
    setActionForm({ type: "Appel", description: "" });
    await loadActions(c.id);
  }

  function closePanel() {
    setSelectedClient(null);
    setActions([]);
    setAddActionForm(false);
  }

  async function saveAction() {
    if (!actionForm.description.trim() || !selectedClient) return;
    await createProspectAction({
      id: generateId(),
      prospectId: selectedClient.id,
      date: new Date().toISOString(),
      type: actionForm.type,
      description: actionForm.description.trim(),
      auteur: "",
    });
    setActionForm({ type: "Appel", description: "" });
    setAddActionForm(false);
    await loadActions(selectedClient.id);
  }

  if (loading) return null;

  const impayéCount = clients.filter(c => c.statutPaiement === "Impayé").length;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 min-w-0 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-500 mt-1">
              {clients.length} client{clients.length !== 1 ? "s" : ""}
              {impayéCount > 0 && (
                <span className="ml-2 text-red-500 font-medium">· {impayéCount} impayé{impayéCount !== 1 ? "s" : ""}</span>
              )}
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date signature</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Titre / Poste</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Société</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Secteur</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Résultat</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">To do</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paiement</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clients.map(c => {
                const isImpayé = c.statutPaiement === "Impayé";
                const isSelected = selectedClient?.id === c.id;
                const isTodoOverdue = c.todoDate && new Date(c.todoDate) < new Date();
                return (
                  <tr
                    key={c.id}
                    onClick={() => openPanel(c)}
                    className={`cursor-pointer transition-colors ${
                      isImpayé
                        ? isSelected ? "bg-red-100" : "bg-red-50 hover:bg-red-100"
                        : isSelected ? "bg-indigo-50/60" : "hover:bg-gray-50/50"
                    }`}
                  >
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">
                      {c.signedAt
                        ? new Date(c.signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900">{c.nomContact}</td>
                    <td className="px-4 py-4 text-gray-500">{c.posteContact}</td>
                    <td className="px-4 py-4 font-medium text-gray-900">{c.entreprise}</td>
                    <td className="px-4 py-4 text-gray-500">{c.secteurActivite || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-4">
                      {c.typeContact ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                          {c.typeContact}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-gray-500 max-w-[140px] truncate">{c.resultat || <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-4">
                      {c.todo ? (
                        <div>
                          <p className="text-gray-700 text-xs truncate max-w-[120px]">{c.todo}</p>
                          {c.todoDate && (
                            <p className={`text-xs mt-0.5 ${isTodoOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                              {new Date(c.todoDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            </p>
                          )}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                        isImpayé
                          ? "bg-red-100 text-red-700"
                          : "bg-green-50 text-green-700"
                      }`}>
                        {c.statutPaiement ?? "Payé"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                          title="Modifier"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-gray-400 italic text-sm">
                    Aucun client — les prospects signés apparaissent ici automatiquement
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selectedClient && (
        <div className="w-[400px] flex-shrink-0 border-l border-gray-100 bg-white overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{selectedClient.entreprise}</h2>
              <button
                onClick={closePanel}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {selectedClient.nomContact}
              {selectedClient.posteContact && <span className="text-gray-400"> · {selectedClient.posteContact}</span>}
            </p>

            {/* Signed date */}
            {selectedClient.signedAt && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 mb-3">
                <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
                Signé le {new Date(selectedClient.signedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            )}

            {/* Payment status */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                selectedClient.statutPaiement === "Impayé"
                  ? "bg-red-100 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}>
                {selectedClient.statutPaiement ?? "Payé"}
              </span>
              {selectedClient.typeContact && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                  {selectedClient.typeContact}
                </span>
              )}
              {selectedClient.secteurActivite && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700">
                  {selectedClient.secteurActivite}
                </span>
              )}
            </div>

            {/* Contact links */}
            {(selectedClient.telephone || selectedClient.email || selectedClient.linkedin) && (
              <div className="flex flex-col gap-1.5 mb-3">
                {selectedClient.telephone && (
                  <a href={`tel:${selectedClient.telephone}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-indigo-600 transition-colors">
                    <PhoneIcon className="w-3.5 h-3.5 flex-shrink-0" />{selectedClient.telephone}
                  </a>
                )}
                {selectedClient.email && (
                  <a href={`mailto:${selectedClient.email}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-indigo-600 transition-colors">
                    <EnvelopeIcon className="w-3.5 h-3.5 flex-shrink-0" />{selectedClient.email}
                  </a>
                )}
                {selectedClient.linkedin && (
                  <a href={selectedClient.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-indigo-600 transition-colors">
                    <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />LinkedIn
                  </a>
                )}
              </div>
            )}

            {/* Resultat */}
            {selectedClient.resultat && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-0.5">Résultat / Intérêt</p>
                <p className="text-xs text-gray-600 leading-relaxed">{selectedClient.resultat}</p>
              </div>
            )}

            {/* Todo */}
            {selectedClient.todo && (
              <div className="mb-2">
                <p className="text-xs font-medium text-gray-500 mb-0.5">To do</p>
                <p className="text-xs text-gray-700">{selectedClient.todo}</p>
                {selectedClient.todoDate && (
                  <p className={`text-xs mt-0.5 ${new Date(selectedClient.todoDate) < new Date() ? "text-red-500 font-medium" : "text-gray-400"}`}>
                    Échéance : {new Date(selectedClient.todoDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                )}
              </div>
            )}

            {selectedClient.note && (
              <p className="text-xs text-gray-400 italic leading-relaxed mt-2">{selectedClient.note}</p>
            )}
          </div>

          {/* Actions section */}
          <div className="px-6 py-4 flex-1">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Historique des interactions</p>

            {!addActionForm && (
              <button
                onClick={() => setAddActionForm(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-200 hover:border-indigo-300 text-gray-500 hover:text-indigo-600 rounded-xl py-2.5 text-sm font-medium transition-colors mb-5"
              >
                <PlusIcon className="w-4 h-4" /> Ajouter une interaction
              </button>
            )}

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
                    placeholder="Détails de l'interaction..."
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

            {actions.length === 0 ? (
              <p className="text-center text-gray-400 italic text-xs py-6">Aucune interaction enregistrée</p>
            ) : (
              <div className="space-y-0">
                {actions.map((a, i) => (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${actionDotColor[a.type] ?? "bg-gray-400"}`} />
                      {i < actions.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
                    </div>
                    <div className="pb-4 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-gray-400"><ActionIcon type={a.type} /></span>
                        <span className="text-xs font-semibold text-gray-700">{actionLabel[a.type] ?? a.type}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-400">
                          {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                          {" "}{new Date(a.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      {a.description && <p className="text-xs text-gray-600 leading-relaxed">{a.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal && form && editing && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Modifier le client</h2>
              <p className="text-sm text-gray-500 mt-0.5">{editing.entreprise} · {editing.nomContact}</p>
            </div>
            <div className="overflow-y-auto px-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Nom du contact</label>
                  <input className="input" value={form.nomContact} onChange={e => setForm(f => f && ({ ...f, nomContact: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Titre / Poste</label>
                  <input className="input" value={form.posteContact} onChange={e => setForm(f => f && ({ ...f, posteContact: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Téléphone</label>
                  <input className="input" type="tel" value={form.telephone ?? ""} onChange={e => setForm(f => f && ({ ...f, telephone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                  <input className="input" type="email" value={form.email ?? ""} onChange={e => setForm(f => f && ({ ...f, email: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Secteur d&apos;activité</label>
                  <input className="input" placeholder="ex: Tech, Finance, Santé..." value={form.secteurActivite ?? ""} onChange={e => setForm(f => f && ({ ...f, secteurActivite: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Type de contact</label>
                  <select className="input" value={form.typeContact ?? ""} onChange={e => setForm(f => f && ({ ...f, typeContact: e.target.value }))}>
                    <option value="">— Sélectionner —</option>
                    {typeContactOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Statut paiement</label>
                  <select className="input" value={form.statutPaiement ?? "Payé"} onChange={e => setForm(f => f && ({ ...f, statutPaiement: e.target.value }))}>
                    {statutPaiementOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Résultat / Intérêt exprimé</label>
                  <textarea className="input resize-none" rows={2} value={form.resultat ?? ""} onChange={e => setForm(f => f && ({ ...f, resultat: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">To do</label>
                  <input className="input mb-2" placeholder="Action à effectuer..." value={form.todo ?? ""} onChange={e => setForm(f => f && ({ ...f, todo: e.target.value }))} />
                  <input className="input" type="date" value={form.todoDate ?? ""} onChange={e => setForm(f => f && ({ ...f, todoDate: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Note</label>
                  <textarea className="input resize-none" rows={2} value={form.note} onChange={e => setForm(f => f && ({ ...f, note: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Annuler
              </button>
              <button onClick={save} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
