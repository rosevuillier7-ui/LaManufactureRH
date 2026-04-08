"use client";

import { useState } from "react";

type Angle = "Conseil pratique" | "Storytelling" | "Opinion" | "Retour d'expérience" | "Cas client";
type Ton = "Professionnel" | "Direct et cash" | "Inspirant";
type Longueur = "Court 150 mots" | "Moyen 300 mots" | "Long 500 mots";

const SYSTEM_PROMPT = `Tu es un expert en personal branding LinkedIn spécialisé dans les métiers RH. Tu écris pour Flaubert Vuillier, fondateur de La Manufacture RH, cabinet de recrutement et coaching RH. Son ton est direct, professionnel et ancré dans le terrain. Il parle à des DRH, managers et dirigeants. Ses sujets de prédilection : recrutement, management, leadership, marché du travail, coaching de dirigeants. Tu génères des posts LinkedIn engageants, sans hashtags excessifs, sans emojis en excès, avec une accroche forte en première ligne.`;

const longueurMap: Record<Longueur, string> = {
  "Court 150 mots": "environ 150 mots",
  "Moyen 300 mots": "environ 300 mots",
  "Long 500 mots": "environ 500 mots",
};

export default function LinkedInPage() {
  const [sujet, setSujet] = useState("");
  const [angle, setAngle] = useState<Angle>("Conseil pratique");
  const [ton, setTon] = useState<Ton>("Professionnel");
  const [longueur, setLongueur] = useState<Longueur>("Moyen 300 mots");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("anthropic_api_key") || "";
    return "";
  });
  const [showApiModal, setShowApiModal] = useState(false);
  const [tempKey, setTempKey] = useState("");

  function saveApiKey() {
    localStorage.setItem("anthropic_api_key", tempKey);
    setApiKey(tempKey);
    setShowApiModal(false);
  }

  async function generate() {
    if (!sujet.trim()) return;
    if (!apiKey) { setTempKey(""); setShowApiModal(true); return; }

    setLoading(true);
    setOutput("");

    const userMessage = `Sujet : ${sujet}\nAngle : ${angle}\nTon : ${ton}\nLongueur : ${longueurMap[longueur]}\n\nGénère le post LinkedIn.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-opus-4-6",
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setOutput(`Erreur API : ${err.error?.message || res.statusText}`);
        return;
      }

      const data = await res.json();
      setOutput(data.content[0]?.text || "");
    } catch (e) {
      setOutput(`Erreur réseau : ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Générateur LinkedIn</h1>
          <p className="text-gray-500 mt-1">Créez des posts LinkedIn percutants avec l'IA</p>
        </div>
        <button
          onClick={() => { setTempKey(apiKey); setShowApiModal(true); }}
          className="text-xs text-gray-400 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        >
          🔑 {apiKey ? "Clé API configurée" : "Configurer clé API"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
        {/* Formulaire */}
        <div className="space-y-5">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Sujet du post</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              rows={3}
              placeholder="Ex : L'importance du feedback managérial, ou : Comment j'ai aidé un DRH à retrouver confiance..."
              value={sujet}
              onChange={e => setSujet(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Angle</label>
            <div className="flex flex-wrap gap-2">
              {(["Conseil pratique", "Storytelling", "Opinion", "Retour d'expérience", "Cas client"] as Angle[]).map(a => (
                <button
                  key={a}
                  onClick={() => setAngle(a)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${angle === a ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Ton</label>
            <div className="flex flex-wrap gap-2">
              {(["Professionnel", "Direct et cash", "Inspirant"] as Ton[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTon(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${ton === t ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Longueur</label>
            <div className="flex flex-wrap gap-2">
              {(["Court 150 mots", "Moyen 300 mots", "Long 500 mots"] as Longueur[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLongueur(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${longueur === l ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading || !sujet.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Génération en cours...
              </>
            ) : (
              <>✨ Générer</>
            )}
          </button>
        </div>

        {/* Résultat */}
        <div>
          {output ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-500">Post généré</label>
                <button
                  onClick={() => navigator.clipboard.writeText(output)}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  📋 Copier
                </button>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-700 whitespace-pre-wrap min-h-64 leading-relaxed">
                {output}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-4xl mb-3">✍️</p>
              <p className="font-medium">Votre post apparaîtra ici</p>
              <p className="text-sm mt-1">Remplissez le formulaire et cliquez sur Générer</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal clé API */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-2">Clé API Anthropic</h2>
            <p className="text-sm text-gray-500 mb-4">
              Entrez votre clé API Anthropic pour utiliser le générateur. Elle sera stockée uniquement dans votre navigateur (localStorage).
            </p>
            <input
              className="input w-full mb-4"
              type="password"
              placeholder="sk-ant-..."
              value={tempKey}
              onChange={e => setTempKey(e.target.value)}
            />
            <p className="text-xs text-gray-400 mb-4">Obtenez votre clé sur console.anthropic.com</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowApiModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
              <button onClick={saveApiKey} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
