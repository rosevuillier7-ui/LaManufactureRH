"use client";
import { useEffect, useState } from "react";
import { loadData, AppData } from "@/lib/store";
import StatCard from "@/components/StatCard";
import Link from "next/link";
import Badge from "@/components/Badge";

export default function RecrutementPage() {
  const [data, setData] = useState<AppData | null>(null);
  useEffect(() => { setData(loadData()); }, []);
  if (!data) return null;

  const clientsActifs = data.clients.filter(c => c.statut === "actif").length;
  const missionsEnCours = data.missions.filter(m => m.statut === "en_cours").length;
  const missionsOuvertes = data.missions.filter(m => m.statut === "ouverte").length;
  const candidatsPrésentés = data.candidats.filter(c => c.statut === "présenté" || c.statut === "retenu").length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Recrutement RH</h1>
        <p className="text-gray-500 mt-1">Pilotez vos clients, missions et candidats</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Clients actifs" value={clientsActifs} color="indigo" />
        <StatCard label="Missions en cours" value={missionsEnCours} color="amber" />
        <StatCard label="Missions ouvertes" value={missionsOuvertes} color="sky" />
        <StatCard label="Candidats présentés" value={candidatsPrésentés} color="emerald" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link href="/recrutement/clients" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group">
          <div className="text-3xl mb-3">🏢</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Clients</h3>
          <p className="text-sm text-gray-500 mt-1">{data.clients.length} clients enregistrés</p>
        </Link>
        <Link href="/recrutement/missions" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group">
          <div className="text-3xl mb-3">📋</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Missions</h3>
          <p className="text-sm text-gray-500 mt-1">{data.missions.length} missions au total</p>
        </Link>
        <Link href="/recrutement/candidats" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group">
          <div className="text-3xl mb-3">👤</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Candidats</h3>
          <p className="text-sm text-gray-500 mt-1">{data.candidats.length} profils dans le vivier</p>
        </Link>
      </div>
    </div>
  );
}
