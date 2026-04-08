"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllCoachees, getAllSessions } from "@/lib/db";
import { Coachee, Session } from "@/lib/store";
import StatCard from "@/components/StatCard";
import Link from "next/link";

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

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Coaching</h1>
        <p className="text-gray-500 mt-1">Suivi de vos accompagnements individuels</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Coachés actifs" value={actifs} color="emerald" />
        <StatCard label="Accompagnements terminés" value={terminés} color="sky" />
        <StatCard label="Séances réalisées" value={totalSeances} color="indigo" />
        <StatCard label="Progression moyenne" value={`${avgProgress}%`} color="violet" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link href="/coaching/coachees" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group">
          <div className="text-3xl mb-3">👥</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Mes coachés</h3>
          <p className="text-sm text-gray-500 mt-1">{coachees.length} accompagnements enregistrés</p>
        </Link>
        <Link href="/coaching/seances" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group">
          <div className="text-3xl mb-3">📅</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Séances</h3>
          <p className="text-sm text-gray-500 mt-1">{sessions.length} séances enregistrées</p>
        </Link>
      </div>
    </div>
  );
}
