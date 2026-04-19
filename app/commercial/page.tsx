"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getAllProspects, getRecentActions } from "@/lib/db";
import { Prospect, ProspectAction, ProspectStatus } from "@/lib/store";
import {
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  PhoneIcon,
  EnvelopeIcon,
  CalendarIcon,
  PencilSquareIcon,
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ChatBubbleLeftIcon,
  CurrencyEuroIcon,
  UsersIcon,
  UserIcon,
  BanknotesIcon,
} from "@heroicons/react/24/outline";

const pipelineStatuses: ProspectStatus[] = [
  "À contacter",
  "Contacté",
  "En discussion",
  "Proposition envoyée",
  "Signé",
];

const statusBarColor: Record<string, string> = {
  "À contacter": "bg-gray-400",
  "Contacté": "bg-yellow-400",
  "En discussion": "bg-blue-500",
  "Proposition envoyée": "bg-indigo-500",
  "Signé": "bg-green-500",
};

const actionDotColor: Record<string, string> = {
  relance: "bg-blue-500",
  statut: "bg-indigo-500",
  Appel: "bg-emerald-500",
  contact: "bg-emerald-500",
  Email: "bg-amber-400",
  RDV: "bg-purple-500",
  Note: "bg-gray-400",
  note: "bg-gray-400",
};

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function ActionIcon({ type }: { type: string }) {
  const cls = "w-3.5 h-3.5";
  switch (type) {
    case "relance": return <ArrowPathIcon className={cls} />;
    case "statut": return <ArrowsRightLeftIcon className={cls} />;
    case "Appel": case "contact": return <PhoneIcon className={cls} />;
    case "Email": return <EnvelopeIcon className={cls} />;
    case "RDV": return <CalendarIcon className={cls} />;
    case "Note": case "note": return <PencilSquareIcon className={cls} />;
    default: return <ChatBubbleLeftIcon className={cls} />;
  }
}

interface EnrichedAction extends ProspectAction {
  entreprise: string;
}

export default function CommercialOverviewPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [recentActions, setRecentActions] = useState<EnrichedAction[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [allProspects, actions] = await Promise.all([
      getAllProspects(),
      getRecentActions(10),
    ]);
    const prospectMap = new Map(allProspects.map(p => [p.id, p]));
    setProspects(allProspects);
    setRecentActions(
      actions.map(a => ({
        ...a,
        entreprise: prospectMap.get(a.prospectId)?.entreprise ?? "—",
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("commercial-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_actions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return null;

  const activeProspects = prospects.filter(p => p.statut !== "Signé" && p.statut !== "Perdu");
  const clients = prospects.filter(p => p.statut === "Signé");
  const impayes = clients.filter(c => c.statutPaiement === "Impayé");
  const caPrevCount = prospects.filter(
    p => p.statut === "Proposition envoyée" || p.statut === "Signé"
  ).length;

  const pipelineCounts = pipelineStatuses.map(s => ({
    status: s,
    count: prospects.filter(p => p.statut === s).length,
  }));
  const maxCount = Math.max(...pipelineCounts.map(p => p.count), 1);

  const overdueProspects = activeProspects.filter(p => daysSince(p.dernierContact) > 14);

  const todos = prospects
    .filter(p => p.todo?.trim())
    .sort((a, b) => {
      if (!a.todoDate && !b.todoDate) return 0;
      if (!a.todoDate) return 1;
      if (!b.todoDate) return -1;
      return new Date(a.todoDate).getTime() - new Date(b.todoDate).getTime();
    });

  const hasUrgences = overdueProspects.length > 0 || impayes.length > 0;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Commercial</h1>
        <p className="text-gray-500 mt-1">Vue d&apos;ensemble de votre activité commerciale</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
              <CurrencyEuroIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">CA prévisionnel</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{caPrevCount}</p>
          <p className="text-xs text-gray-400 mt-1">dossiers proposition + signés</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">Prospects actifs</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{activeProspects.length}</p>
          <p className="text-xs text-gray-400 mt-1">en pipeline</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">Clients actifs</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{clients.length}</p>
          <p className="text-xs text-gray-400 mt-1">contrats signés</p>
        </div>

        <div className={`rounded-2xl border shadow-sm p-5 ${impayes.length > 0 ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${impayes.length > 0 ? "bg-red-100" : "bg-gray-50"}`}>
              <BanknotesIcon className={`w-5 h-5 ${impayes.length > 0 ? "text-red-600" : "text-gray-400"}`} />
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider leading-tight">Clients impayés</p>
          </div>
          <p className={`text-3xl font-bold ${impayes.length > 0 ? "text-red-700" : "text-gray-900"}`}>{impayes.length}</p>
          <p className="text-xs text-gray-400 mt-1">paiements en attente</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* Pipeline bar chart */}
        <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-5">Pipeline prospects</h2>
          <div className="space-y-3">
            {pipelineCounts.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-36 flex-shrink-0">{status}</span>
                <div className="flex-1 h-6 bg-gray-50 rounded-lg overflow-hidden">
                  <div
                    className={`h-full rounded-lg transition-all ${statusBarColor[status] ?? "bg-gray-300"}`}
                    style={{ width: count === 0 ? "0%" : `${Math.max(4, (count / maxCount) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-gray-700 w-5 text-right">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-50">
            <Link href="/commercial/prospects" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
              Voir tous les prospects →
            </Link>
          </div>
        </div>

        {/* Urgences */}
        <div className={`rounded-2xl border shadow-sm p-6 ${hasUrgences ? "bg-red-50 border-red-100" : "bg-white border-gray-100"}`}>
          <div className="flex items-center gap-2 mb-4">
            <ExclamationTriangleIcon className={`w-4 h-4 ${hasUrgences ? "text-red-500" : "text-gray-400"}`} />
            <h2 className="text-sm font-semibold text-gray-700">Urgences</h2>
          </div>
          {!hasUrgences ? (
            <p className="text-xs text-gray-400 italic">Aucune urgence — tout est à jour</p>
          ) : (
            <div className="space-y-2">
              {overdueProspects.map(p => (
                <Link key={p.id} href="/commercial/prospects" className="block">
                  <div className="bg-white rounded-xl p-3 border border-red-100 hover:border-red-200 transition-colors">
                    <p className="text-xs font-semibold text-gray-800">{p.entreprise}</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Pas de contact depuis {daysSince(p.dernierContact)} jours
                    </p>
                  </div>
                </Link>
              ))}
              {impayes.map(c => (
                <Link key={c.id} href="/commercial/clients" className="block">
                  <div className="bg-white rounded-xl p-3 border border-red-100 hover:border-red-200 transition-colors">
                    <p className="text-xs font-semibold text-gray-800">{c.entreprise}</p>
                    <p className="text-xs text-red-600 mt-0.5">Paiement impayé</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Prochaines actions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardDocumentListIcon className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Prochaines actions</h2>
          </div>
          {todos.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucune action planifiée</p>
          ) : (
            <div className="space-y-1">
              {todos.map(p => {
                const isClient = p.statut === "Signé";
                const isOverdue = p.todoDate && new Date(p.todoDate) < new Date();
                return (
                  <Link key={p.id} href={isClient ? "/commercial/clients" : "/commercial/prospects"}>
                    <div className="flex gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${isClient ? "bg-green-500" : "bg-blue-500"}`} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.entreprise}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{p.todo}</p>
                        {p.todoDate && (
                          <p className={`text-xs mt-0.5 font-medium ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
                            {new Date(p.todoDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Activité récente */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Activité récente</h2>
          {recentActions.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Aucune activité récente</p>
          ) : (
            <div className="space-y-0">
              {recentActions.map((a, i) => (
                <div key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${actionDotColor[a.type] ?? "bg-gray-400"}`} />
                    {i < recentActions.length - 1 && <div className="w-px flex-1 bg-gray-100 my-1" />}
                  </div>
                  <div className="pb-3 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-gray-400"><ActionIcon type={a.type} /></span>
                      <span className="text-xs font-semibold text-gray-700">{a.entreprise}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">
                        {new Date(a.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                        {" · "}{new Date(a.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {a.description && (
                      <p className="text-xs text-gray-500 leading-relaxed truncate max-w-[240px]">{a.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
