"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllCoachees, createCoachee, updateCoachee, removeCoachee, getAllSessions } from "@/lib/db";
import { Coachee, CoachingStatut, Session, generateId } from "@/lib/store";
import Badge from "@/components/Badge";
import Link from "next/link";
import { PlusIcon, PencilIcon, TrashIcon, PhoneIcon, EnvelopeIcon, LinkIcon, CalendarIcon } from "@heroicons/react/24/outline";

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

const typeCoachingOptions = ["Individuel", "Groupe", "Dirigeant"];

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
  linkedin: "",
  typeCoaching: "",
  tarifSeance: "",
  prochainRdv: "",
});

export default function CoacheesPage() {
  const [coachees, setCoachees] = useState<Coachee[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Coachee | null>(null);
  const [form, setForm] = useState(emptyCoachee());

  async function load() {
    const [c, s] = await Promise.all([getAllCoachees(), getAllSessions()]);
    setCoachees(c);
    setSessions(s);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("coachees-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "coachees" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function openAdd() { setEditing(null); setForm(emptyCoachee()); setModal(true); }
  function openEdit(c: Coachee) {
    setEditing(c);
    setForm({ ...c, prochainRdv: c.prochainRdv ?? "" });
    setModal(true);
  }

  async function save() {
    if (editing) {
      await updateCoachee(editing.id, { ...form, id: editing.id });
    } else {
      await createCoachee({ ...form, id: generateId() });
    }
    await load();
    setModal(false);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce coaché ?")) return;
    await removeCoachee(id);
    await load();
  }

  if (loading) return null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mes coachés</h1>
          <p className="text-gray-500 mt-1">{coachees.length} accompagnements</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <PlusIcon className="w-4 h-4" /> Nouveau coaché
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {coachees.map(coachee => {
          const pct = Math.round((coachee.seancesFaites / coachee.nbSeances) * 100);
          const coacheeSessions = sessions.filter(s => s.coacheeId === coachee.id);
          const lastSession = coacheeSessions.sort((a, b) => b.date.localeCompare(a.date))[0];
          const rdvPast = coachee.prochainRdv && coachee.prochainRdv < today;

          return (
            <div key={coachee.id} className="relative bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all">
              <Link href={`/coaching/coachees/${coachee.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Voir ${coachee.prenom} ${coachee.nom}`} />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                    {coachee.prenom[0]}{coachee.nom[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{coachee.prenom} {coachee.nom}</p>
                    <p className="text-xs text-gray-500">{coachee.fonction}{coachee.entreprise ? ` · ${coachee.entreprise}` : ""}</p>
                  </div>
                </div>
                <Badge label={statusLabel[coachee.statut]} variant={statusVariant[coachee.statut]} />
              </div>

              {/* Type + tarif */}
              {(coachee.typeCoaching || coachee.tarifSeance) && (
                <div className="flex items-center gap-2 mb-3">
                  {coachee.typeCoaching && (
                    <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{coachee.typeCoaching}</span>
                  )}
                  {coachee.tarifSeance && (
                    <span className="text-xs bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">{coachee.tarifSeance}/séance</span>
                  )}
                </div>
              )}

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

              {/* Contact links */}
              <div className="relative z-10 flex flex-wrap gap-3 mb-3 text-xs text-gray-500">
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

              {/* Prochain RDV */}
              {coachee.prochainRdv && (
                <div className={`flex items-center gap-1.5 text-xs mb-3 ${rdvPast ? "text-rose-500" : "text-indigo-600"}`}>
                  <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  Prochain RDV : {new Date(coachee.prochainRdv).toLocaleDateString("fr-FR")}
                  {rdvPast && <span className="text-rose-400">(passé)</span>}
                </div>
              )}

              {lastSession && (
                <div className="text-xs text-gray-400 mb-3">
                  Dernière séance : {new Date(lastSession.date).toLocaleDateString("fr-FR")}
                </div>
              )}

              <div className="relative z-10 flex gap-2 pt-3 border-t border-gray-50">
                <button onClick={(e) => { e.preventDefault(); openEdit(coachee); }} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <PencilIcon className="w-3.5 h-3.5" /> Modifier
                </button>
                <button onClick={(e) => { e.preventDefault(); remove(coachee.id); }} className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {coachees.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">👥</p>
            <p>Aucun coaché enregistré</p>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold">{editing ? "Modifier le coaché" : "Nouveau coaché"}</h2>
            </div>
            <div className="overflow-y-auto px-6 py-4">
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
                  <label className="text-xs font-medium text-gray-500 block mb-1">Téléphone</label>
                  <input className="input" type="tel" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Email</label>
                  <input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">LinkedIn</label>
                  <input className="input" type="url" placeholder="https://linkedin.com/in/..." value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Type de coaching</label>
                  <select className="input" value={form.typeCoaching} onChange={e => setForm(f => ({ ...f, typeCoaching: e.target.value }))}>
                    <option value="">Sélectionner</option>
                    {typeCoachingOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Tarif séance</label>
                  <input className="input" placeholder="ex: 200€" value={form.tarifSeance} onChange={e => setForm(f => ({ ...f, tarifSeance: e.target.value }))} />
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
                  <label className="text-xs font-medium text-gray-500 block mb-1">Prochain RDV</label>
                  <input className="input" type="date" value={form.prochainRdv ?? ""} onChange={e => setForm(f => ({ ...f, prochainRdv: e.target.value }))} />
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
                  <label className="text-xs font-medium text-gray-500 block mb-1">Objectifs de l&apos;accompagnement</label>
                  <textarea className="input resize-none" rows={3} value={form.objectif} onChange={e => setForm(f => ({ ...f, objectif: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
                  <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
    </div>
  );
}
