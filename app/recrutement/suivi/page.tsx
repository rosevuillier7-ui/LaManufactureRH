"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDaysIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid";
import { Placement } from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimelineStep {
  key: keyof Pick<
    Placement,
    | "calEventJMinus1Id"
    | "calEventJId"
    | "calEventJPlus15Id"
    | "calEventJPlus46Id"
    | "calEventJPlus76Id"
  >;
  label: string;
  offset: number; // days from start
  time?: string; // HH:MM if timed
  icon: string;
}

const STEPS: TimelineStep[] = [
  { key: "calEventJMinus1Id", label: "SMS veille", offset: -1, time: "09:00", icon: "💬" },
  { key: "calEventJId", label: "SMS 1er jour", offset: 0, time: "18:00", icon: "💬" },
  { key: "calEventJPlus15Id", label: "Call J+15", offset: 15, time: "10:00", icon: "📞" },
  { key: "calEventJPlus46Id", label: "Call J+46", offset: 46, time: "10:00", icon: "📞" },
  { key: "calEventJPlus76Id", label: "Call J+76", offset: 76, time: "10:00", icon: "📞" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function stepDate(startDate: string, step: TimelineStep): Date {
  return addDays(startDate, step.offset);
}

function isPast(d: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d <= today;
}

// ─── PlacementCard ────────────────────────────────────────────────────────────

function PlacementCard({
  placement,
  gcalConnected,
  onUpdated,
}: {
  placement: Placement;
  gcalConnected: boolean;
  onUpdated: () => void;
}) {
  const [date, setDate] = useState(placement.datePriseDePoste ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasEvents = !!placement.calEventJMinus1Id;
  const dateChanged = date !== (placement.datePriseDePoste ?? "");

  async function handleSave() {
    if (!date) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/placements/${placement.id}/start-date`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datePriseDePoste: date }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erreur inconnue");
      } else {
        onUpdated();
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  const initiales = `${placement.prenom[0] ?? ""}${placement.nom[0] ?? ""}`.toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <span className="text-indigo-700 font-semibold text-sm">{initiales}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 leading-tight">
            {placement.prenom} {placement.nom}
          </p>
          {placement.poste && (
            <p className="text-sm text-gray-500 mt-0.5">{placement.poste}</p>
          )}
          {placement.entreprise && (
            <p className="text-xs text-gray-400 mt-0.5">{placement.entreprise}</p>
          )}
        </div>
        {hasEvents && (
          <span className="ml-auto flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            Agenda créé
          </span>
        )}
      </div>

      {/* Start date */}
      <div className="flex items-end gap-3 mb-5">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Date de prise de poste
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onBlur={(e) => {
              const val = e.target.value;
              if (val && val !== (placement.datePriseDePoste ?? "")) {
                fetch(`/api/placements/${placement.id}/start-date`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ datePriseDePoste: val }),
                }).catch(() => {});
              }
            }}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        {date && (dateChanged || !hasEvents) && (
          <button
            onClick={handleSave}
            disabled={saving || !gcalConnected}
            title={!gcalConnected ? "Connectez Google Agenda d'abord" : undefined}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarDaysIcon className="w-4 h-4" />
            )}
            {saving ? "Création…" : hasEvents && dateChanged ? "Mettre à jour" : "Créer les événements"}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-600 mb-4 flex items-center gap-1">
          <ExclamationTriangleIcon className="w-4 h-4" />
          {error}
        </p>
      )}

      {/* Timeline */}
      {date && (
        <div className="border-t border-gray-50 pt-4">
          <p className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">
            Suivi
          </p>
          <div className="space-y-2">
            {STEPS.map((step, i) => {
              const sDate = stepDate(date, step);
              const done = isPast(sDate) && !!placement[step.key];
              const eventExists = !!placement[step.key];

              return (
                <div key={step.key} className="flex items-center gap-3">
                  {/* Connector line */}
                  <div className="relative flex flex-col items-center">
                    {done ? (
                      <CheckCircleSolid className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    ) : eventExists ? (
                      <ClockIcon className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-200 flex-shrink-0" />
                    )}
                    {i < STEPS.length - 1 && (
                      <div className="w-px h-3 bg-gray-100 mt-0.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-gray-700">
                        {step.icon} {step.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatDate(sDate)}{step.time ? ` · ${step.time}` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!date && (
        <p className="text-xs text-gray-400 italic">
          Définissez la date de prise de poste pour voir la timeline de suivi.
        </p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuiviPage() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; total: number } | null>(null);
  const [syncError, setSyncError] = useState("");
  const [gcalConnected, setGcalConnected] = useState(false);

  // Read banner from URL params
  const [banner, setBanner] = useState<"connected" | "error" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal_connected")) setBanner("connected");
    if (params.get("gcal_error")) setBanner("error");
    // Clean URL
    if (params.get("gcal_connected") || params.get("gcal_error")) {
      window.history.replaceState({}, "", "/recrutement/suivi");
    }
  }, []);

  const loadPlacements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/placements");
      const data = await res.json();
      setPlacements(data.placements ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkGcal = useCallback(async () => {
    const res = await fetch("/api/gcal/status");
    const data = await res.json();
    setGcalConnected(data.connected);
  }, []);

  useEffect(() => {
    loadPlacements();
    checkGcal();
  }, [loadPlacements, checkGcal]);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    try {
      const res = await fetch("/api/recruitee/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "Erreur de synchronisation");
      } else {
        setSyncResult({ synced: data.synced, total: data.total });
        await loadPlacements();
      }
    } catch {
      setSyncError("Erreur réseau");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Suivi post-placement</h1>
        <p className="text-gray-500 mt-1">
          Candidats recrutés — rappels et calls de suivi automatiques
        </p>
      </div>

      {/* Banners */}
      {banner === "connected" && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-800 rounded-xl text-sm border border-emerald-100">
          <CheckCircleIcon className="w-5 h-5 flex-shrink-0" />
          Google Agenda connecté avec succès.
        </div>
      )}
      {banner === "error" && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 text-red-800 rounded-xl text-sm border border-red-100">
          <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
          Erreur lors de la connexion à Google Agenda. Réessayez.
        </div>
      )}

      {/* Google Calendar connection */}
      {!gcalConnected && (
        <div className="mb-6 flex items-center justify-between gap-4 px-5 py-4 bg-amber-50 border border-amber-100 rounded-xl">
          <div>
            <p className="text-sm font-medium text-amber-900">Google Agenda non connecté</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Connectez votre compte Google pour créer automatiquement les événements de suivi.
            </p>
          </div>
          <a
            href="/api/gcal/auth/login"
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
          >
            <CalendarDaysIcon className="w-4 h-4" />
            Connecter Google Agenda
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          <ArrowPathIcon className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchronisation…" : "Synchroniser Recruitee"}
        </button>

        {syncResult && (
          <span className="text-sm text-emerald-700">
            {syncResult.synced} candidat{syncResult.synced !== 1 ? "s" : ""} synchronisé
            {syncResult.synced !== 1 ? "s" : ""} sur {syncResult.total}
          </span>
        )}
        {syncError && (
          <span className="text-sm text-red-600 flex items-center gap-1">
            <ExclamationTriangleIcon className="w-4 h-4" />
            {syncError}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 h-48 animate-pulse">
              <div className="flex gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 bg-gray-100 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-24" />
                </div>
              </div>
              <div className="h-9 bg-gray-100 rounded-lg" />
            </div>
          ))}
        </div>
      ) : placements.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-3">🎯</div>
          <p className="font-medium">Aucun candidat placé</p>
          <p className="text-sm mt-1">
            Synchronisez Recruitee pour importer les candidats au statut &quot;hired&quot;.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {placements.map((p) => (
            <PlacementCard
              key={p.id}
              placement={p}
              gcalConnected={gcalConnected}
              onUpdated={loadPlacements}
            />
          ))}
        </div>
      )}
    </div>
  );
}
