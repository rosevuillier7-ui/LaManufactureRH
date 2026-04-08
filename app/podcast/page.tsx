"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllEpisodes, createEpisode, updateEpisode, removeEpisode } from "@/lib/db";
import { Episode, generateId } from "@/lib/store";
import Badge from "@/components/Badge";
import StatCard from "@/components/StatCard";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

type EpStatut = Episode["statut"];

const statutLabel: Record<EpStatut, string> = {
  brouillon: "Brouillon",
  enregistré: "Enregistré",
  publié: "Publié",
};
const statutVariant: Record<EpStatut, "gray" | "blue" | "green"> = {
  brouillon: "gray",
  enregistré: "blue",
  publié: "green",
};

const emptyEpisode = (nb: number): Omit<Episode, "id"> => ({
  numero: nb,
  titre: "",
  invite: "",
  fonction_invite: "",
  date: new Date().toISOString().split("T")[0],
  duree: 0,
  description: "",
  ecoutes: 0,
  plateforme: "Spotify / Apple Podcasts",
  lien: "",
  statut: "brouillon",
});

export default function PodcastPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Episode | null>(null);
  const [form, setForm] = useState(emptyEpisode(1));

  async function load() {
    const data = await getAllEpisodes();
    setEpisodes(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("episodes-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "podcast_episodes" }, () => {
        getAllEpisodes().then(setEpisodes);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  function openAdd() {
    const next = episodes.length ? Math.max(...episodes.map(e => e.numero)) + 1 : 1;
    setEditing(null);
    setForm(emptyEpisode(next));
    setModal(true);
  }
  function openEdit(e: Episode) { setEditing(e); setForm({ ...e }); setModal(true); }

  async function save() {
    if (editing) {
      await updateEpisode(editing.id, { ...form, id: editing.id });
    } else {
      await createEpisode({ ...form, id: generateId() });
    }
    await load();
    setModal(false);
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cet épisode ?")) return;
    await removeEpisode(id);
    await load();
  }

  if (loading) return null;

  const published = episodes.filter(e => e.statut === "publié");
  const totalEcoutes = published.reduce((s, e) => s + e.ecoutes, 0);
  const avgEcoutes = published.length ? Math.round(totalEcoutes / published.length) : 0;
  const sorted = [...episodes].sort((a, b) => b.numero - a.numero);

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-2xl">🎙</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">13ème Mois</h1>
            <p className="text-gray-500 text-sm">Podcast RH & Management</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Épisodes publiés" value={published.length} color="rose" />
        <StatCard label="Total écoutes" value={totalEcoutes.toLocaleString("fr-FR")} color="amber" />
        <StatCard label="Moy. écoutes / épisode" value={avgEcoutes.toLocaleString("fr-FR")} color="sky" />
        <StatCard label="En préparation" value={episodes.filter(e => e.statut !== "publié").length} color="gray" />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Tous les épisodes</h2>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <PlusIcon className="w-4 h-4" /> Nouvel épisode
        </button>
      </div>

      <div className="space-y-3">
        {sorted.map(ep => (
          <div key={ep.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-rose-100 flex flex-col items-center justify-center text-rose-600 flex-shrink-0">
                <span className="text-xs text-rose-400">Ep.</span>
                <span className="text-xl font-bold leading-none">{ep.numero}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-gray-900">{ep.titre || <span className="text-gray-400 italic">Sans titre</span>}</p>
                  <Badge label={statutLabel[ep.statut]} variant={statutVariant[ep.statut]} />
                </div>
                {ep.invite && (
                  <p className="text-sm text-gray-600 mb-1">
                    🎤 {ep.invite}
                    {ep.fonction_invite && <span className="text-gray-400"> · {ep.fonction_invite}</span>}
                  </p>
                )}
                {ep.description && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-2">{ep.description}</p>
                )}
                <div className="flex gap-4 text-xs text-gray-500">
                  {ep.date && (
                    <span>📅 {new Date(ep.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</span>
                  )}
                  {ep.duree > 0 && <span>⏱ {ep.duree} min</span>}
                  {ep.ecoutes > 0 && (
                    <span className="font-semibold text-rose-600">🎧 {ep.ecoutes.toLocaleString("fr-FR")} écoutes</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(ep)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={() => remove(ep.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-6">{editing ? "Modifier l'épisode" : "Nouvel épisode"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Numéro</label>
                <input className="input" type="number" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Statut</label>
                <select className="input" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as EpStatut }))}>
                  <option value="brouillon">Brouillon</option>
                  <option value="enregistré">Enregistré</option>
                  <option value="publié">Publié</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Titre</label>
                <input className="input" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Invité(e)</label>
                <input className="input" value={form.invite} onChange={e => setForm(f => ({ ...f, invite: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Fonction de l&apos;invité(e)</label>
                <input className="input" value={form.fonction_invite} onChange={e => setForm(f => ({ ...f, fonction_invite: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Date de publication</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Durée (min)</label>
                <input className="input" type="number" min={0} value={form.duree} onChange={e => setForm(f => ({ ...f, duree: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Écoutes</label>
                <input className="input" type="number" min={0} value={form.ecoutes} onChange={e => setForm(f => ({ ...f, ecoutes: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Plateforme</label>
                <input className="input" value={form.plateforme} onChange={e => setForm(f => ({ ...f, plateforme: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
                <textarea className="input resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
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
