"use client";
import { useEffect, useState } from "react";
import { loadData, AppData } from "@/lib/store";
import StatCard from "@/components/StatCard";
import Link from "next/link";

export default function CoachingPage() {
  const [data, setData] = useState<AppData | null>(null);
  useEffect(() => { setData(loadData()); }, []);
  if (!data) return null;

  const actifs = data.coachees.filter(c => c.statut === "actif").length;
  const terminés = data.coachees.filter(c => c.statut === "terminé").length;
  const totalSeances = data.coachees.reduce((s, c) => s + c.seancesFaites, 0);
  const avgProgress = data.coachees.length
    ? Math.round(data.coachees.reduce((s, c) => s + (c.seancesFaites / c.nbSeances) * 100, 0) / data.coachees.length)
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
          <p className="text-sm text-gray-500 mt-1">{data.coachees.length} accompagnements enregistrés</p>
        </Link>
        <Link href="/coaching/seances" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group">
          <div className="text-3xl mb-3">📅</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Séances</h3>
          <p className="text-sm text-gray-500 mt-1">{data.sessions.length} séances enregistrées</p>
        </Link>
      </div>
    </div>
  );
}
