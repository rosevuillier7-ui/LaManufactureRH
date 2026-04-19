"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  getAllEpisodes, createEpisode, updateEpisode, removeEpisode,
  getAllSponsors, createSponsor, updateSponsor, removeSponsor,
} from "@/lib/db";
import { Episode, PodcastSponsor, generateId } from "@/lib/store";
import Badge from "@/components/Badge";
import StatCard from "@/components/StatCard";
import {
  PlusIcon, PencilIcon, TrashIcon, CalendarDaysIcon,
} from "@heroicons/react/24/outline";

type YouTubeStats = {
  connected: boolean;
  totalViews?: number;
  subscribers?: number | null;
  avgWatchDuration?: number | null;
  videos?: { id: string; title: string; views: number }[];
};

type CalEvent = {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  hangoutLink?: string;
};

type CalForm = {
  title: string;
  date: string;
  time: string;
  endTime: string;
  location: string;
  description: string;
};

type SponsorForm = Omit<PodcastSponsor, "id" | "created_at">;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatCalDate(event: CalEvent): string {
  const raw = event.start.dateTime ?? event.start.date ?? "";
  if (!raw) return "";
  const d = new Date(raw);
  if (event.start.dateTime) {
    return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" }) +
      " · " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

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

const emptySponsorForm = (): SponsorForm => ({
  episode_id: "",
  nom_sponsor: "",
  brief_client: "",
  linkedin_post_done: false,
  youtube_description_done: false,
  date_diffusion: "",
});

const emptyCalForm = (): CalForm => ({
  title: "",
  date: new Date().toISOString().split("T")[0],
  time: "",
  endTime: "",
  location: "",
  description: "",
});

function YouTubeNotifications() {
  const searchParams = useSearchParams();
  const ytConnected = searchParams.get("yt_connected") === "1";
  const ytError = searchParams.get("yt_error") === "1";
  return (
    <>
      {ytConnected && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          Compte YouTube connecté avec succès.
        </div>
      )}
      {ytError && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Erreur lors de la connexion YouTube. Réessaie.
        </div>
      )}
    </>
  );
}

function GcalNotifications({ onConnected }: { onConnected: () => void }) {
  const searchParams = useSearchParams();
  const connected = searchParams.get("gcal_connected") === "1";
  const error = searchParams.get("gcal_error") === "1";
  useEffect(() => {
    if (connected) onConnected();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);
  return (
    <>
      {connected && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          Google Agenda connecté avec succès.
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          Erreur lors de la connexion Google Agenda. Réessaie.
        </div>
      )}
    </>
  );
}

export default function PodcastPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Episode | null>(null);
  const [form, setForm] = useState(emptyEpisode(1));
  const [ytStats, setYtStats] = useState<YouTubeStats | null>(null);
  const [ytLoading, setYtLoading] = useState(true);

  // Google Calendar
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calModal, setCalModal] = useState(false);
  const [calForm, setCalForm] = useState<CalForm>(emptyCalForm());
  const [calSaving, setCalSaving] = useState(false);

  // Sponsors
  const [sponsors, setSponsors] = useState<PodcastSponsor[]>([]);
  const [sponsorModal, setSponsorModal] = useState(false);
  const [sponsorEditing, setSponsorEditing] = useState<PodcastSponsor | null>(null);
  const [sponsorForm, setSponsorForm] = useState<SponsorForm>(emptySponsorForm());
  const [sponsorSaving, setSponsorSaving] = useState(false);

  async function load() {
    const data = await getAllEpisodes();
    setEpisodes(data);
    setLoading(false);
  }

  async function loadSponsors() {
    const data = await getAllSponsors();
    setSponsors(data);
  }

  async function loadCalEvents() {
    setCalLoading(true);
    try {
      const res = await fetch("/api/gcal/events");
      const data = await res.json();
      setGcalConnected(data.connected);
      setCalEvents(data.events ?? []);
    } catch {
      setGcalConnected(false);
    } finally {
      setCalLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadSponsors();
    const channel = supabase
      .channel("episodes-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "podcast_episodes" }, () => {
        getAllEpisodes().then(setEpisodes);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    fetch("/api/gcal/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.connected) loadCalEvents();
        else setGcalConnected(false);
      })
      .catch(() => setGcalConnected(false));
  }, []);

  useEffect(() => {
    fetch("/api/youtube-stats")
      .then((r) => r.json())
      .then((data) => { setYtStats(data); setYtLoading(false); })
      .catch(() => { setYtStats({ connected: false }); setYtLoading(false); });
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

  async function saveCalEvent() {
    if (!calForm.title || !calForm.date) return;
    setCalSaving(true);
    try {
      await fetch("/api/gcal/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calForm),
      });
      setCalModal(false);
      setCalForm(emptyCalForm());
      await loadCalEvents();
    } finally {
      setCalSaving(false);
    }
  }

  function openAddSponsor() {
    setSponsorEditing(null);
    setSponsorForm(emptySponsorForm());
    setSponsorModal(true);
  }

  function openEditSponsor(s: PodcastSponsor) {
    setSponsorEditing(s);
    setSponsorForm({
      episode_id: s.episode_id ?? "",
      nom_sponsor: s.nom_sponsor,
      brief_client: s.brief_client ?? "",
      linkedin_post_done: s.linkedin_post_done,
      youtube_description_done: s.youtube_description_done,
      date_diffusion: s.date_diffusion ?? "",
    });
    setSponsorModal(true);
  }

  async function saveSponsor() {
    if (!sponsorForm.nom_sponsor) return;
    setSponsorSaving(true);
    try {
      if (sponsorEditing) {
        await updateSponsor(sponsorEditing.id, sponsorForm);
      } else {
        await createSponsor({ ...sponsorForm, id: generateId() });
      }
      await loadSponsors();
      setSponsorModal(false);
    } finally {
      setSponsorSaving(false);
    }
  }

  async function removeSponsorRow(id: string) {
    if (!confirm("Supprimer ce sponsor ?")) return;
    await removeSponsor(id);
    await loadSponsors();
  }

  async function toggleSponsorBool(id: string, field: "linkedin_post_done" | "youtube_description_done", current: boolean) {
    await updateSponsor(id, { [field]: !current });
    await loadSponsors();
  }

  if (loading) return null;

  const published = episodes.filter(e => e.statut === "publié");
  const totalEcoutes = published.reduce((s, e) => s + e.ecoutes, 0);
  const avgEcoutes = published.length ? Math.round(totalEcoutes / published.length) : 0;
  const sorted = [...episodes].sort((a, b) => b.numero - a.numero);

  const episodeOptions = sorted.filter(e => e.titre);

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

      {/* YouTube Analytics */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <h2 className="font-semibold text-gray-900">YouTube Analytics</h2>
        </div>

        <Suspense fallback={null}>
          <YouTubeNotifications />
        </Suspense>

        {ytLoading ? (
          <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ) : !ytStats?.connected ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">Connecte ton compte YouTube</p>
              <p className="text-xs text-gray-500 mt-1">Pour afficher les vues, abonnés et durée de visionnage</p>
            </div>
            <a
              href="/api/youtube/auth/login"
              className="mt-1 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Connecter YouTube
            </a>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
              <StatCard label="Vues totales" value={(ytStats.totalViews ?? 0).toLocaleString("fr-FR")} color="rose" />
              <StatCard
                label="Abonnés"
                value={ytStats.subscribers == null ? "—" : ytStats.subscribers.toLocaleString("fr-FR")}
                color="amber"
              />
              <StatCard
                label="Durée moy. visionnage"
                value={ytStats.avgWatchDuration != null ? formatDuration(ytStats.avgWatchDuration) : "—"}
                color="sky"
              />
              <StatCard
                label="Vues moy. / vidéo"
                value={
                  ytStats.videos && ytStats.videos.length > 0
                    ? Math.round(ytStats.videos.reduce((s, v) => s + v.views, 0) / ytStats.videos.length).toLocaleString("fr-FR")
                    : "—"
                }
                color="indigo"
              />
            </div>

            {ytStats.videos && ytStats.videos.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-5 py-3 font-medium">Vidéo</th>
                      <th className="text-right px-5 py-3 font-medium">Vues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ytStats.videos
                      .sort((a, b) => b.views - a.views)
                      .map((v) => (
                        <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-gray-700 truncate max-w-xs">{v.title}</td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">{v.views.toLocaleString("fr-FR")}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Agenda Épisodes à Venir */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-gray-900">Agenda Épisodes à Venir</h2>
          </div>
          {gcalConnected && (
            <button
              onClick={() => { setCalForm(emptyCalForm()); setCalModal(true); }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <PlusIcon className="w-4 h-4" /> Ajouter au calendrier
            </button>
          )}
        </div>

        <Suspense fallback={null}>
          <GcalNotifications onConnected={loadCalEvents} />
        </Suspense>

        {gcalConnected === null ? (
          <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ) : !gcalConnected ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col items-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <CalendarDaysIcon className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">Connecte Google Agenda</p>
              <p className="text-xs text-gray-500 mt-1">Pour afficher les enregistrements et publications à venir</p>
            </div>
            <a
              href="/api/gcal/auth/login?from=/podcast"
              className="mt-1 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Connecter Google Agenda
            </a>
          </div>
        ) : calLoading ? (
          <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ) : calEvents.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-center text-sm text-gray-400">
            Aucun événement podcast à venir dans Google Agenda.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {calEvents.map((event) => {
              const link = event.hangoutLink ?? (event.location?.startsWith("http") ? event.location : null);
              return (
                <div key={event.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <p className="font-semibold text-gray-900 text-sm mb-2 line-clamp-2">{event.summary}</p>
                  <p className="text-xs text-indigo-600 font-medium mb-2">📅 {formatCalDate(event)}</p>
                  {event.location && !link && (
                    <p className="text-xs text-gray-500 truncate">📍 {event.location}</p>
                  )}
                  {link && (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-indigo-500 hover:underline truncate block"
                    >
                      🔗 Rejoindre la réunion
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sponsors */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Sponsors</h2>
          <button
            onClick={openAddSponsor}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <PlusIcon className="w-4 h-4" /> Nouveau sponsor
          </button>
        </div>

        {sponsors.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm text-center text-sm text-gray-400">
            Aucun sponsor enregistré.
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-5 py-3 font-medium">Sponsor</th>
                  <th className="text-left px-5 py-3 font-medium">Épisode</th>
                  <th className="text-left px-5 py-3 font-medium">Date diffusion</th>
                  <th className="text-center px-4 py-3 font-medium">Post LinkedIn</th>
                  <th className="text-center px-4 py-3 font-medium">Desc. YouTube</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sponsors.map((s) => {
                  const ep = episodes.find(e => e.id === s.episode_id);
                  return (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900">{s.nom_sponsor}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {ep ? `Ep. ${ep.numero} — ${ep.titre}` : (s.episode_id ? s.episode_id : "—")}
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {s.date_diffusion
                          ? new Date(s.date_diffusion).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={s.linkedin_post_done}
                          onChange={() => toggleSponsorBool(s.id, "linkedin_post_done", s.linkedin_post_done)}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={s.youtube_description_done}
                          onChange={() => toggleSponsorBool(s.id, "youtube_description_done", s.youtube_description_done)}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEditSponsor(s)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeSponsorRow(s.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
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
        )}
      </div>

      {/* Episodes list */}
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

      {/* Episode modal */}
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

      {/* Calendar event modal */}
      {calModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-6">Ajouter au calendrier</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Titre *</label>
                <input className="input" placeholder="ex: Enregistrement épisode 14 — Podcast" value={calForm.title} onChange={e => setCalForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Date *</label>
                  <input className="input" type="date" value={calForm.date} onChange={e => setCalForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Heure début</label>
                  <input className="input" type="time" value={calForm.time} onChange={e => setCalForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Heure fin</label>
                <input className="input" type="time" value={calForm.endTime} onChange={e => setCalForm(f => ({ ...f, endTime: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Lieu / lien</label>
                <input className="input" placeholder="Adresse ou lien Meet/Zoom" value={calForm.location} onChange={e => setCalForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
                <textarea className="input resize-none" rows={3} value={calForm.description} onChange={e => setCalForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setCalModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
              <button
                onClick={saveCalEvent}
                disabled={calSaving || !calForm.title || !calForm.date}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {calSaving ? "Création…" : "Créer l'événement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sponsor modal */}
      {sponsorModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-6">{sponsorEditing ? "Modifier le sponsor" : "Nouveau sponsor"}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Nom du sponsor *</label>
                <input className="input" value={sponsorForm.nom_sponsor} onChange={e => setSponsorForm(f => ({ ...f, nom_sponsor: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Épisode associé</label>
                <select className="input" value={sponsorForm.episode_id ?? ""} onChange={e => setSponsorForm(f => ({ ...f, episode_id: e.target.value }))}>
                  <option value="">— Aucun —</option>
                  {episodeOptions.map(ep => (
                    <option key={ep.id} value={ep.id}>Ep. {ep.numero} — {ep.titre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Date de diffusion</label>
                <input className="input" type="date" value={sponsorForm.date_diffusion ?? ""} onChange={e => setSponsorForm(f => ({ ...f, date_diffusion: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Brief client</label>
                <textarea className="input resize-none" rows={4} value={sponsorForm.brief_client ?? ""} onChange={e => setSponsorForm(f => ({ ...f, brief_client: e.target.value }))} />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={sponsorForm.linkedin_post_done}
                    onChange={e => setSponsorForm(f => ({ ...f, linkedin_post_done: e.target.checked }))}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  Post LinkedIn fait
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={sponsorForm.youtube_description_done}
                    onChange={e => setSponsorForm(f => ({ ...f, youtube_description_done: e.target.checked }))}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  Intégré dans desc. YouTube
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setSponsorModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
              <button
                onClick={saveSponsor}
                disabled={sponsorSaving || !sponsorForm.nom_sponsor}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {sponsorSaving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
