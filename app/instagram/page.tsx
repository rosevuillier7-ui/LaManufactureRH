"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import {
  getAllInstagramStats,
  createInstagramStat,
  updateInstagramStat,
  removeInstagramStat,
} from "@/lib/db";
import type { InstagramStat } from "@/lib/store";
import { generateId } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

function emptyForm() {
  return {
    month: CURRENT_MONTH,
    abonnes: 0,
    dmsRecus: 0,
    dmsConvertis: 0,
    prospectsGeneres: 0,
    postsPublies: 0,
    reelsPublies: 0,
    bestPostUrl: "",
    bestPostNotes: "",
  };
}

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  const labels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${labels[parseInt(month) - 1]} ${year}`;
}

function AbonnesChart({ stats }: { stats: InstagramStat[] }) {
  const sorted = [...stats].sort((a, b) => a.month.localeCompare(b.month));
  if (sorted.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        Ajoutez au moins 2 entrées pour voir l&apos;évolution
      </div>
    );
  }

  const W = 700, H = 180, padL = 52, padR = 20, padT = 20, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const values = sorted.map((s) => s.abonnes);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const pts = sorted.map((s, i) => ({
    x: padL + (i / (sorted.length - 1)) * innerW,
    y: padT + ((maxV - s.abonnes) / range) * innerH,
    month: s.month,
    value: s.abonnes,
  }));

  const lineD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaD = `${lineD} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 180 }}>
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#ig-grad)" />
      <path d={lineD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3.5} fill="#6366f1" />
          <title>{p.value.toLocaleString("fr-FR")} abonnés</title>
          <text x={p.x} y={H - 6} textAnchor="middle" fontSize={9} fill="#9ca3af">
            {p.month.slice(5)}/{p.month.slice(2, 4)}
          </text>
        </g>
      ))}
      <text x={padL - 4} y={padT + 5} textAnchor="end" fontSize={9} fill="#9ca3af">
        {maxV.toLocaleString("fr-FR")}
      </text>
      <text x={padL - 4} y={padT + innerH} textAnchor="end" fontSize={9} fill="#9ca3af">
        {minV.toLocaleString("fr-FR")}
      </text>
    </svg>
  );
}

export default function InstagramPage() {
  const [stats, setStats] = useState<InstagramStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [editEntry, setEditEntry] = useState<InstagramStat | null>(null);

  async function load() {
    const data = await getAllInstagramStats();
    setStats(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("instagram-stats-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "instagram_stats" }, () => {
        getAllInstagramStats().then(setStats);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Sort descending for display; ascending for chart
  const sorted = [...stats].sort((a, b) => b.month.localeCompare(a.month));

  // KPI derivations
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;
  const currentMonthEntry = stats.find((s) => s.month === CURRENT_MONTH) ?? null;
  const prevMonthEntry = sorted.find((s) => s.month < CURRENT_MONTH) ?? null;

  function getDelta(curr: number, prev: number | undefined): string | undefined {
    if (prev === undefined) return undefined;
    const d = curr - prev;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d.toLocaleString("fr-FR")} vs mois préc.`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const existing = stats.find((s) => s.month === form.month);
      if (existing) {
        await updateInstagramStat(existing.id, { ...existing, ...form });
      } else {
        await createInstagramStat({
          ...form,
          id: generateId(),
        });
      }
      await load();
      setForm(emptyForm());
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette entrée ?")) return;
    await removeInstagramStat(id);
    await load();
  }

  async function saveEdit() {
    if (!editEntry) return;
    await updateInstagramStat(editEntry.id, editEntry);
    await load();
    setEditEntry(null);
  }

  if (loading) return <div className="p-8 text-gray-500">Chargement...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Instagram</h1>
        <p className="text-sm text-gray-500 mt-1">Suivi mensuel — conversion dirigeants en coaching</p>
      </div>

      {/* Section 1 — KPIs */}
      <section className="mb-10">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Abonnés"
            value={(latest?.abonnes ?? 0).toLocaleString("fr-FR")}
            sub={latest && previous ? getDelta(latest.abonnes, previous.abonnes) : undefined}
            color="violet"
          />
          <StatCard
            label="DM reçus ce mois"
            value={currentMonthEntry?.dmsRecus ?? 0}
            sub={currentMonthEntry && prevMonthEntry ? getDelta(currentMonthEntry.dmsRecus, prevMonthEntry.dmsRecus) : undefined}
            color="indigo"
          />
          <StatCard
            label="DM → Call / RDV"
            value={currentMonthEntry?.dmsConvertis ?? 0}
            sub={currentMonthEntry && prevMonthEntry ? getDelta(currentMonthEntry.dmsConvertis, prevMonthEntry.dmsConvertis) : undefined}
            color="emerald"
          />
          <StatCard
            label="Prospects générés"
            value={currentMonthEntry?.prospectsGeneres ?? 0}
            sub={currentMonthEntry && prevMonthEntry ? getDelta(currentMonthEntry.prospectsGeneres, prevMonthEntry.prospectsGeneres) : undefined}
            color="amber"
          />
        </div>
        {(currentMonthEntry?.prospectsGeneres ?? 0) > 0 && (
          <div className="mt-3">
            <Link href="/commercial/prospects" className="text-sm text-indigo-600 hover:underline">
              Voir les {currentMonthEntry!.prospectsGeneres} prospect{currentMonthEntry!.prospectsGeneres > 1 ? "s" : ""} →
            </Link>
          </div>
        )}
      </section>

      {/* Section 2 — Évolution abonnés */}
      <section className="mb-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Évolution abonnés</h2>
          <AbonnesChart stats={stats} />
        </div>
      </section>

      {/* Section 3 — Publications ce mois */}
      <section className="mb-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Publications ce mois</h2>
          {currentMonthEntry ? (
            <div className="space-y-5">
              <div className="flex gap-8">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{currentMonthEntry.postsPublies}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Posts</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{currentMonthEntry.reelsPublies}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Reels</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-indigo-600">
                    {currentMonthEntry.postsPublies + currentMonthEntry.reelsPublies}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Total</div>
                </div>
              </div>
              {(currentMonthEntry.bestPostUrl || currentMonthEntry.bestPostNotes) && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                    Meilleur post du mois
                  </p>
                  {currentMonthEntry.bestPostUrl && (
                    <a
                      href={currentMonthEntry.bestPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-indigo-600 hover:underline break-all block mb-2"
                    >
                      {currentMonthEntry.bestPostUrl}
                    </a>
                  )}
                  {currentMonthEntry.bestPostNotes && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-4 py-3">
                      {currentMonthEntry.bestPostNotes}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Aucune donnée pour ce mois. Utilisez la saisie manuelle ci-dessous.
            </p>
          )}
        </div>
      </section>

      {/* Section 4 — Saisie manuelle */}
      <section className="mb-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Saisie manuelle</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mois</label>
                <input
                  type="month"
                  className="input"
                  value={form.month}
                  onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Abonnés</label>
                <input
                  type="number"
                  className="input"
                  value={form.abonnes}
                  min={0}
                  onChange={(e) => setForm((f) => ({ ...f, abonnes: +e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">DM reçus</label>
                <input
                  type="number"
                  className="input"
                  value={form.dmsRecus}
                  min={0}
                  onChange={(e) => setForm((f) => ({ ...f, dmsRecus: +e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">DM → RDV</label>
                <input
                  type="number"
                  className="input"
                  value={form.dmsConvertis}
                  min={0}
                  onChange={(e) => setForm((f) => ({ ...f, dmsConvertis: +e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Prospects générés</label>
                <input
                  type="number"
                  className="input"
                  value={form.prospectsGeneres}
                  min={0}
                  onChange={(e) => setForm((f) => ({ ...f, prospectsGeneres: +e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Posts publiés</label>
                <input
                  type="number"
                  className="input"
                  value={form.postsPublies}
                  min={0}
                  onChange={(e) => setForm((f) => ({ ...f, postsPublies: +e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Reels publiés</label>
                <input
                  type="number"
                  className="input"
                  value={form.reelsPublies}
                  min={0}
                  onChange={(e) => setForm((f) => ({ ...f, reelsPublies: +e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">URL meilleur post</label>
              <input
                type="url"
                className="input"
                value={form.bestPostUrl}
                onChange={(e) => setForm((f) => ({ ...f, bestPostUrl: e.target.value }))}
                placeholder="https://instagram.com/p/..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes meilleur post</label>
              <textarea
                className="input"
                rows={3}
                value={form.bestPostNotes}
                onChange={(e) => setForm((f) => ({ ...f, bestPostNotes: e.target.value }))}
                placeholder="Pourquoi ce post a bien performé..."
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                {saving ? "Enregistrement..." : stats.some((s) => s.month === form.month) ? "Mettre à jour" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Section 5 — Historique */}
      <section>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Historique</h2>
          </div>
          {sorted.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400">
              Aucune entrée pour le moment.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Mois</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Abonnés</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">DM reçus</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">DM→RDV</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Prospects</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Posts</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Reels</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{formatMonth(s.month)}</td>
                      <td className="px-4 py-4 text-right text-gray-700">{s.abonnes.toLocaleString("fr-FR")}</td>
                      <td className="px-4 py-4 text-right text-gray-700">{s.dmsRecus}</td>
                      <td className="px-4 py-4 text-right text-gray-700">{s.dmsConvertis}</td>
                      <td className="px-4 py-4 text-right text-gray-700">{s.prospectsGeneres}</td>
                      <td className="px-4 py-4 text-right text-gray-700">{s.postsPublies}</td>
                      <td className="px-4 py-4 text-right text-gray-700">{s.reelsPublies}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditEntry({ ...s })}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Edit modal */}
      {editEntry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-gray-900 mb-5">
              Modifier — {formatMonth(editEntry.month)}
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Mois</label>
                  <input
                    type="month"
                    className="input"
                    value={editEntry.month}
                    onChange={(e) => setEditEntry((s) => s && { ...s, month: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Abonnés</label>
                  <input
                    type="number"
                    className="input"
                    value={editEntry.abonnes}
                    min={0}
                    onChange={(e) => setEditEntry((s) => s && { ...s, abonnes: +e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">DM reçus</label>
                  <input
                    type="number"
                    className="input"
                    value={editEntry.dmsRecus}
                    min={0}
                    onChange={(e) => setEditEntry((s) => s && { ...s, dmsRecus: +e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">DM → RDV</label>
                  <input
                    type="number"
                    className="input"
                    value={editEntry.dmsConvertis}
                    min={0}
                    onChange={(e) => setEditEntry((s) => s && { ...s, dmsConvertis: +e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Prospects</label>
                  <input
                    type="number"
                    className="input"
                    value={editEntry.prospectsGeneres}
                    min={0}
                    onChange={(e) => setEditEntry((s) => s && { ...s, prospectsGeneres: +e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Posts</label>
                  <input
                    type="number"
                    className="input"
                    value={editEntry.postsPublies}
                    min={0}
                    onChange={(e) => setEditEntry((s) => s && { ...s, postsPublies: +e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reels</label>
                  <input
                    type="number"
                    className="input"
                    value={editEntry.reelsPublies}
                    min={0}
                    onChange={(e) => setEditEntry((s) => s && { ...s, reelsPublies: +e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">URL meilleur post</label>
                <input
                  type="url"
                  className="input"
                  value={editEntry.bestPostUrl}
                  onChange={(e) => setEditEntry((s) => s && { ...s, bestPostUrl: e.target.value })}
                  placeholder="https://instagram.com/p/..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes meilleur post</label>
                <textarea
                  className="input"
                  rows={3}
                  value={editEntry.bestPostNotes}
                  onChange={(e) => setEditEntry((s) => s && { ...s, bestPostNotes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditEntry(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={saveEdit}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
