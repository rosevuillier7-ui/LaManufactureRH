"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  getAllClients, getAllMissions, getAllCandidats, getAllCoachees,
  getAllSessions, getAllPosts, getAllEpisodes, getAllProspects,
  getAllInstagramStats,
} from "@/lib/db";
import { Client, Mission, Candidat, Coachee, Session, PostLinkedIn, Episode, Prospect, InstagramStat } from "@/lib/store";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import Link from "next/link";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

export default function Home() {
  const [clients, setClients] = useState<Client[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [coachees, setCoachees] = useState<Coachee[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [posts, setPosts] = useState<PostLinkedIn[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [instagramStats, setInstagramStats] = useState<InstagramStat[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [cl, mi, ca, co, se, po, ep, pr, ig] = await Promise.all([
      getAllClients(), getAllMissions(), getAllCandidats(), getAllCoachees(),
      getAllSessions(), getAllPosts(), getAllEpisodes(), getAllProspects(),
      getAllInstagramStats(),
    ]);
    setClients(cl);
    setMissions(mi);
    setCandidats(ca);
    setCoachees(co);
    setSessions(se);
    setPosts(po);
    setEpisodes(ep);
    setProspects(pr);
    setInstagramStats(ig);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "missions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "candidats" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "coachees" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "linkedin_posts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "podcast_episodes" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "instagram_stats" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return null;

  // Commercial metrics
  const prospectsActifs = prospects.filter(
    (p) => p.statut !== "Signé" && p.statut !== "Perdu"
  );
  const clientsActifs = prospects.filter((p) => p.statut === "Signé");
  const caPrevProspects = prospects.filter(
    (p) => p.statut === "Proposition envoyée" || p.statut === "Signé"
  );
  const caPrev = caPrevProspects.reduce((sum, p) => {
    const val = parseFloat((p.valeurEstimee ?? "").replace(/[^\d.]/g, ""));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  // Clients with unpaid status
  const impayes = clientsActifs.filter((c) => c.statutPaiement === "Impayé");

  // Existing metrics
  const missionsOuvertes = missions.filter(
    (m) => m.statut === "ouverte" || m.statut === "en_cours"
  ).length;
  const coacheesActifs = coachees.filter((c) => c.statut === "actif").length;
  const totalVues = posts.reduce((sum, p) => sum + p.vues, 0);
  const totalEcoutes = episodes.reduce((sum, e) => sum + e.ecoutes, 0);
  const episodesPubliés = episodes.filter((e) => e.statut === "publié").length;

  // Instagram metrics
  const igSorted = [...instagramStats].sort((a, b) => b.month.localeCompare(a.month));
  const igLatest = igSorted[0] ?? null;
  const igCurrentMonth = instagramStats.find((s) => s.month === CURRENT_MONTH) ?? null;

  const today = new Date().toISOString().split("T")[0];
  const prochainRdv = sessions
    .filter((s) => s.prochainRdv && s.prochainRdv >= today)
    .sort((a, b) => (a.prochainRdv! > b.prochainRdv! ? 1 : -1))[0];

  const prochainCoachee = prochainRdv
    ? coachees.find((c) => c.id === prochainRdv.coacheeId)
    : null;

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bonjour</h1>
        <p className="text-gray-500 mt-1">
          {new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Commercial section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Commercial</h2>
          <Link href="/commercial" className="text-xs text-indigo-600 hover:underline">
            Voir tout →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Link href="/commercial/prospects" className="block">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-indigo-200 transition-colors">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Prospects actifs</p>
              <p className="text-3xl font-bold text-gray-900">{prospectsActifs.length}</p>
              <p className="text-xs text-gray-400 mt-1">en pipeline</p>
            </div>
          </Link>
          <Link href="/commercial/clients" className="block">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-indigo-200 transition-colors">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Clients actifs</p>
              <p className="text-3xl font-bold text-gray-900">{clientsActifs.length}</p>
              <p className="text-xs text-gray-400 mt-1">contrats signés</p>
            </div>
          </Link>
          <Link href="/commercial" className="block">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-indigo-200 transition-colors">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">CA prévisionnel</p>
              {caPrev > 0 ? (
                <p className="text-3xl font-bold text-gray-900">
                  {caPrev.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                </p>
              ) : (
                <p className="text-3xl font-bold text-gray-900">{caPrevProspects.length}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">proposition + signés</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Alert: Clients en retard de paiement */}
      {impayes.length > 0 && (
        <div className="mb-8 bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
            <h2 className="text-sm font-semibold text-red-700">
              Clients en retard de paiement ({impayes.length})
            </h2>
          </div>
          <div className="space-y-2">
            {impayes.map((c) => {
              const daysSigned = c.signedAt ? daysSince(c.signedAt) : null;
              return (
                <Link key={c.id} href="/commercial/clients" className="block">
                  <div className="bg-white rounded-xl p-3 border border-red-100 hover:border-red-300 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.nomContact}</p>
                      <p className="text-xs text-gray-500 truncate">{c.entreprise}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {c.valeurEstimee && (
                        <p className="text-sm font-semibold text-red-700">{c.valeurEstimee}</p>
                      )}
                      {daysSigned !== null && (
                        <p className="text-xs text-red-500">Signé il y a {daysSigned}j</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Missions ouvertes" value={missionsOuvertes} color="amber" />
        <StatCard label="Candidats" value={candidats.length} color="gray" />
        <StatCard label="Coachés actifs" value={coacheesActifs} color="emerald" />
        <StatCard
          label="Vues LinkedIn"
          value={totalVues.toLocaleString("fr-FR")}
          sub={`${posts.length} posts`}
          color="indigo"
        />
        <StatCard
          label="Écoutes podcast"
          value={totalEcoutes.toLocaleString("fr-FR")}
          sub={`${episodesPubliés} épisodes`}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Missions en cours */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Missions actives</h2>
            <Link href="/recrutement/missions" className="text-xs text-indigo-600 hover:underline py-2 px-1 -my-2 -mx-1">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {missions
              .filter((m) => m.statut === "ouverte" || m.statut === "en_cours")
              .map((mission) => {
                const client = clients.find((c) => c.id === mission.clientId);
                return (
                  <div key={mission.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-amber-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{mission.titre}</p>
                      <p className="text-xs text-gray-500">
                        {client?.entreprise} · {mission.localisation}
                      </p>
                    </div>
                    <Badge
                      label={mission.statut === "en_cours" ? "En cours" : "Ouverte"}
                      variant={mission.statut === "en_cours" ? "blue" : "yellow"}
                    />
                  </div>
                );
              })}
            {missionsOuvertes === 0 && (
              <p className="text-sm text-gray-400 italic">Aucune mission active</p>
            )}
          </div>
        </div>

        {/* Coachees actifs */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Suivi coaching</h2>
            <Link href="/coaching/coachees" className="text-xs text-indigo-600 hover:underline py-2 px-1 -my-2 -mx-1">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {coachees
              .filter((c) => c.statut === "actif")
              .map((coachee) => {
                const pct = Math.round((coachee.seancesFaites / coachee.nbSeances) * 100);
                return (
                  <div key={coachee.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium text-gray-800">
                        {coachee.prenom} {coachee.nom}
                      </span>
                      <span className="text-gray-500 text-xs">
                        {coachee.seancesFaites}/{coachee.nbSeances} séances
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {coachee.fonction} · {coachee.entreprise}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Podcast derniers épisodes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">13ème Mois</h2>
            <Link href="/podcast" className="text-xs text-indigo-600 hover:underline py-2 px-1 -my-2 -mx-1">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {episodes
              .slice(-3)
              .reverse()
              .map((ep) => (
                <div key={ep.id} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 text-xs font-bold flex-shrink-0">
                    #{ep.numero}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{ep.titre}</p>
                    <p className="text-xs text-gray-500">
                      {ep.invite} ·{" "}
                      {ep.ecoutes > 0
                        ? ep.ecoutes.toLocaleString("fr-FR") + " écoutes"
                        : "À venir"}
                    </p>
                  </div>
                  <Badge
                    label={
                      ep.statut === "publié"
                        ? "Publié"
                        : ep.statut === "enregistré"
                        ? "Enreg."
                        : "Brouillon"
                    }
                    variant={
                      ep.statut === "publié"
                        ? "green"
                        : ep.statut === "enregistré"
                        ? "blue"
                        : "gray"
                    }
                  />
                </div>
              ))}
          </div>
        </div>

        {/* Récap Instagram */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Récap Instagram</h2>
            <Link href="/instagram" className="text-xs text-indigo-600 hover:underline py-2 px-1 -my-2 -mx-1">
              Voir tout
            </Link>
          </div>
          {igLatest ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Abonnés</span>
                <span className="text-sm font-semibold text-gray-900">
                  {igLatest.abonnes.toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">DM reçus ce mois</span>
                <span className="text-sm font-semibold text-gray-900">
                  {igCurrentMonth?.dmsRecus ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">DM convertis en RDV</span>
                <span className="text-sm font-semibold text-gray-900">
                  {igCurrentMonth?.dmsConvertis ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Abonnés qualifiés ce mois</span>
                <span className="text-sm font-semibold text-gray-900">
                  {igCurrentMonth?.prospectsGeneres ?? 0}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Aucune donnée Instagram</p>
          )}
        </div>

        {/* Prochain RDV coaching */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Prochain RDV coaching</h2>
          {prochainRdv && prochainCoachee ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                  {prochainCoachee.prenom[0]}
                  {prochainCoachee.nom[0]}
                </div>
                <div>
                  <p className="font-medium text-gray-800">
                    {prochainCoachee.prenom} {prochainCoachee.nom}
                  </p>
                  <p className="text-xs text-gray-500">
                    {prochainCoachee.fonction} · {prochainCoachee.entreprise}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {new Date(prochainRdv.prochainRdv!).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Aucun RDV planifié</p>
          )}
        </div>

        {/* Accès rapides IA */}
        <div className="bg-gray-950 rounded-2xl p-6 shadow-sm text-white border border-gray-800">
          <h2 className="font-semibold mb-2">Outils IA</h2>
          <p className="text-sm text-gray-400 mb-4">
            Accédez à vos assistants IA pour rédiger, analyser et préparer vos contenus.
          </p>
          <Link
            href="/outils-ia"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Ouvrir les outils →
          </Link>
        </div>
      </div>
    </div>
  );
}
