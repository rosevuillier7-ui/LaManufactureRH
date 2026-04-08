"use client";

import { useEffect, useState } from "react";
import { loadData, AppData } from "@/lib/store";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import Link from "next/link";

export default function Home() {
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    setData(loadData());
  }, []);

  if (!data) return null;

  const missionsOuvertes = data.missions.filter(
    (m) => m.statut === "ouverte" || m.statut === "en_cours"
  ).length;
  const clientsActifs = data.clients.filter((c) => c.statut === "actif").length;
  const coacheesActifs = data.coachees.filter((c) => c.statut === "actif").length;
  const prospectsActifs = (data.prospects || []).filter(
    (p) => p.statut !== "Signé" && p.statut !== "Perdu"
  ).length;
  const totalVues = data.posts.reduce((sum, p) => sum + p.vues, 0);
  const totalEcoutes = data.episodes.reduce((sum, e) => sum + e.ecoutes, 0);
  const episodesPubliés = data.episodes.filter((e) => e.statut === "publié").length;

  const today = new Date().toISOString().split("T")[0];
  const prochainRdv = data.sessions
    .filter((s) => s.prochainRdv && s.prochainRdv >= today)
    .sort((a, b) => (a.prochainRdv! > b.prochainRdv! ? 1 : -1))[0];

  const prochainCoachee = prochainRdv
    ? data.coachees.find((c) => c.id === prochainRdv.coacheeId)
    : null;

  return (
    <div className="p-8">
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

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Clients actifs" value={clientsActifs} color="indigo" />
        <StatCard label="Prospects actifs" value={prospectsActifs} color="sky" />
        <StatCard label="Missions ouvertes" value={missionsOuvertes} color="amber" />
        <StatCard label="Candidats" value={data.candidats.length} color="sky" />
        <StatCard label="Coachés actifs" value={coacheesActifs} color="emerald" />
        <StatCard
          label="Vues LinkedIn"
          value={totalVues.toLocaleString("fr-FR")}
          sub={`${data.posts.length} posts`}
          color="violet"
        />
        <StatCard
          label="Écoutes podcast"
          value={totalEcoutes.toLocaleString("fr-FR")}
          sub={`${episodesPubliés} épisodes`}
          color="rose"
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
            {data.missions
              .filter((m) => m.statut === "ouverte" || m.statut === "en_cours")
              .map((mission) => {
                const client = data.clients.find((c) => c.id === mission.clientId);
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
            {data.coachees
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
            {data.episodes
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

        {/* LinkedIn derniers posts */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">LinkedIn · Derniers posts</h2>
            <Link href="/linkedin" className="text-xs text-indigo-600 hover:underline py-2 px-1 -my-2 -mx-1">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {data.posts.slice(0, 3).map((post) => (
              <div key={post.id} className="border-l-2 border-violet-200 pl-3">
                <p className="text-sm text-gray-700 line-clamp-2">{post.contenu}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-400">
                  <span>{post.vues.toLocaleString("fr-FR")} vues</span>
                  <span>{post.likes} likes</span>
                  <span>{post.commentaires} comm.</span>
                  <span className="ml-auto text-indigo-500 font-medium">
                    {post.taux_engagement}%
                  </span>
                </div>
              </div>
            ))}
          </div>
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
