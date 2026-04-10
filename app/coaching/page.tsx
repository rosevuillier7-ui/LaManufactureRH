"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllCoachees, getAllSessions } from "@/lib/db";
import { Coachee, Session } from "@/lib/store";
import StatCard from "@/components/StatCard";
import Link from "next/link";

function energyDot(niveau: number) {
  if (niveau === 0) return "bg-gray-300";
  if (niveau <= 2) return "bg-rose-500";
  if (niveau === 3) return "bg-amber-400";
  return "bg-emerald-500";
}

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

export default function CoachingPage() {
  const [coachees, setCoachees] = useState<Coachee[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [co, se] = await Promise.all([getAllCoachees(), getAllSessions()]);
    setCoachees(co);
    setSessions(se);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("coaching-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "coachees" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return null;

  const actifs = coachees.filter(c => c.statut === "actif").length;
  const terminés = coachees.filter(c => c.statut === "terminé").length;
  const totalSeances = coachees.reduce((s, c) => s + c.seancesFaites, 0);
  const avgProgress = coachees.length
    ? Math.round(coachees.reduce((s, c) => s + (c.seancesFaites / c.nbSeances) * 100, 0) / coachees.length)
    : 0;

  // CA mensuel coaching
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const caeMensuel = coachees.reduce((total, c) => {
    const tarif = parseInt(c.tarifSeance.replace(/\D/g, ""), 10) || 0;
    if (tarif === 0) return total;
    const sessionsThisMonth = sessions.filter(s => {
      if (s.coacheeId !== c.id) return false;
      const d = new Date(s.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;
    return total + tarif * sessionsThisMonth;
  }, 0);

  // Prochains RDV
  const today = now.toISOString().split("T")[0];
  const prochains = coachees
    .filter(c => c.prochainRdv && c.prochainRdv >= today)
    .sort((a, b) => (a.prochainRdv ?? "").localeCompare(b.prochainRdv ?? ""))
    .slice(0, 3);

  // Coachés à relancer (actifs, dernière séance > 14 jours ou jamais)
  const aRelancer = coachees.filter(c => {
    if (c.statut !== "actif") return false;
    const coacheeSessions = sessions.filter(s => s.coacheeId === c.id);
    if (coacheeSessions.length === 0) return true;
    const last = coacheeSessions.sort((a, b) => b.date.localeCompare(a.date))[0];
    return daysSince(last.date) > 14;
  });

  // Dernières séances
  const dernières = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Coaching</h1>
        <p className="text-gray-500 mt-1">Suivi de vos accompagnements individuels</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        <StatCard label="Coachés actifs" value={actifs} color="emerald" />
        <StatCard label="Accompagnements terminés" value={terminés} color="sky" />
        <StatCard label="Séances réalisées" value={totalSeances} color="indigo" />
        <StatCard label="Progression moyenne" value={`${avgProgress}%`} color="violet" />
        <StatCard label="CA mensuel coaching" value={caeMensuel > 0 ? `${caeMensuel}€` : "—"} color="amber" />
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* Prochains RDV */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-sm">Prochains RDV</h3>
            <span className="text-lg">📅</span>
          </div>
          {prochains.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Aucun RDV planifié</p>
          ) : (
            <div className="space-y-3">
              {prochains.map(c => (
                <div key={c.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{c.prenom} {c.nom}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(c.prochainRdv!).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                    </p>
                  </div>
                  <Link
                    href="/coaching/seances"
                    className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1 rounded-full transition-colors"
                  >
                    Préparer
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coachés à relancer */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-sm">Coachés à relancer</h3>
            <span className="text-lg">🔔</span>
          </div>
          {aRelancer.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Tous vos coachés sont actifs 👍</p>
          ) : (
            <div className="space-y-3">
              {aRelancer.map(c => {
                const coacheeSessions = sessions.filter(s => s.coacheeId === c.id);
                const last = coacheeSessions.sort((a, b) => b.date.localeCompare(a.date))[0];
                const days = last ? daysSince(last.date) : null;
                return (
                  <div key={c.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.prenom} {c.nom}</p>
                      <p className="text-xs text-amber-500">
                        {days === null ? "Jamais de séance" : `Il y a ${days} jour${days > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <Link
                      href="/coaching/coachees"
                      className="text-xs bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1 rounded-full transition-colors"
                    >
                      Voir
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Dernières séances */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 text-sm">Dernières séances</h3>
            <span className="text-lg">⚡</span>
          </div>
          {dernières.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Aucune séance enregistrée</p>
          ) : (
            <div className="space-y-3">
              {dernières.map(s => {
                const coachee = coachees.find(c => c.id === s.coacheeId);
                return (
                  <div key={s.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {coachee ? `${coachee.prenom} ${coachee.nom}` : "—"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(s.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {s.niveauEnergie > 0 && (
                        <>
                          <div className={`w-2.5 h-2.5 rounded-full ${energyDot(s.niveauEnergie)}`} />
                          <span className="text-xs text-gray-400">{s.niveauEnergie}/5</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Nav links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link href="/coaching/coachees" className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow group flex items-center gap-4">
          <div className="text-2xl">👥</div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors text-sm">Mes coachés</h3>
            <p className="text-xs text-gray-500 mt-0.5">{coachees.length} accompagnements enregistrés</p>
          </div>
        </Link>
        <Link href="/coaching/seances" className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow group flex items-center gap-4">
          <div className="text-2xl">📋</div>
          <div>
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors text-sm">Séances</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sessions.length} séances enregistrées</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
