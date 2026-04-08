"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getAllClients, getAllMissions, getAllCandidats } from "@/lib/db";
import { Client, Mission, Candidat } from "@/lib/store";
import StatCard from "@/components/StatCard";
import Link from "next/link";

export default function RecrutementPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [candidats, setCandidats] = useState<Candidat[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [cl, mi, ca] = await Promise.all([getAllClients(), getAllMissions(), getAllCandidats()]);
    setClients(cl);
    setMissions(mi);
    setCandidats(ca);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("recrutement-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "missions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "candidats" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) return null;

  const clientsActifs = clients.filter(c => c.statut === "actif").length;
  const missionsEnCours = missions.filter(m => m.statut === "en_cours").length;
  const missionsOuvertes = missions.filter(m => m.statut === "ouverte").length;
  const candidatsPrésentés = candidats.filter(c => c.statut === "présenté" || c.statut === "retenu").length;

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
          <p className="text-sm text-gray-500 mt-1">{clients.length} clients enregistrés</p>
        </Link>
        <Link href="/recrutement/missions" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group">
          <div className="text-3xl mb-3">📋</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Missions</h3>
          <p className="text-sm text-gray-500 mt-1">{missions.length} missions au total</p>
        </Link>
        <Link href="/recrutement/candidats" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group">
          <div className="text-3xl mb-3">👤</div>
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">Candidats</h3>
          <p className="text-sm text-gray-500 mt-1">{candidats.length} profils dans le vivier</p>
        </Link>
      </div>
    </div>
  );
}
