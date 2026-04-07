"use client";

import { useState } from "react";

type Tool = {
  id: string;
  label: string;
  icon: string;
  description: string;
  placeholder: string;
  systemPrompt: string;
  color: string;
};

const tools: Tool[] = [
  {
    id: "fiche_poste",
    label: "Rédiger une fiche de poste",
    icon: "📋",
    description: "Génère une fiche de poste structurée et attractive à partir d'une description simple.",
    placeholder: "Ex : DRH pour une scale-up tech de 200 personnes, Paris, télétravail partiel, management d'une équipe de 5 personnes...",
    systemPrompt: "Tu es un expert RH spécialisé en recrutement. Rédige une fiche de poste professionnelle, structurée et attractive en français. Inclus : contexte de l'entreprise, missions principales, profil recherché (formation, expérience, compétences), conditions (contrat, salaire, avantages). Utilise un ton dynamique et engageant.",
    color: "bg-indigo-50 border-indigo-200",
  },
  {
    id: "linkedin_post",
    label: "Rédiger un post LinkedIn",
    icon: "✍️",
    description: "Crée un post LinkedIn engageant sur un sujet RH ou management.",
    placeholder: "Ex : L'importance du feedback en entreprise, ou : Comment j'ai aidé un manager à retrouver confiance en lui...",
    systemPrompt: "Tu es un expert en personal branding RH sur LinkedIn. Rédige un post LinkedIn percutant en français, style direct et authentique. Commence par une accroche forte (pas de question banale). Développe avec une histoire ou des faits concrets. Termine par un call-to-action engageant. Entre 800 et 1500 caractères. Utilise des sauts de ligne pour la lisibilité.",
    color: "bg-violet-50 border-violet-200",
  },
  {
    id: "email_relance",
    label: "Email de relance prospect",
    icon: "📧",
    description: "Rédige un email de relance professionnel pour un prospect ou client.",
    placeholder: "Ex : Relance d'un DRH contacté il y a 3 semaines pour une mission de recrutement d'un RRH...",
    systemPrompt: "Tu es un consultant RH expert en business development. Rédige un email de relance professionnel, chaleureux et non intrusif en français. Court (max 150 mots), personnalisé, avec une valeur ajoutée claire et un call-to-action précis. Évite les formules génériques.",
    color: "bg-sky-50 border-sky-200",
  },
  {
    id: "questions_coaching",
    label: "Questions de coaching",
    icon: "💬",
    description: "Génère des questions puissantes pour une séance de coaching selon l'objectif.",
    placeholder: "Ex : Manager en difficulté avec la délégation, ou : DRH qui cherche à développer son leadership dans un contexte de transformation...",
    systemPrompt: "Tu es un coach professionnel certifié (ICF PCC). Génère 8 à 10 questions de coaching puissantes et ouvertes, adaptées au contexte décrit. Les questions doivent favoriser la réflexion en profondeur, challenger les croyances limitantes et ouvrir de nouvelles perspectives. Classe-les en 3 catégories : Exploration, Prise de conscience, Action.",
    color: "bg-emerald-50 border-emerald-200",
  },
  {
    id: "resume_seance",
    label: "Résumé de séance coaching",
    icon: "📝",
    description: "Structure tes notes de séance en un compte-rendu professionnel.",
    placeholder: "Ex : Notes brutes de la séance : Julie a parlé de ses difficultés à s'imposer face à son N+1, sentiment de ne pas être écoutée, a pris conscience que son mode de communication est trop défensif...",
    systemPrompt: "Tu es un coach professionnel expert en documentation de séance. À partir de notes brutes, rédige un compte-rendu de séance structuré et professionnel en français. Structure : 1) Thème principal, 2) Prises de conscience, 3) Points clés travaillés, 4) Plan d'action décidé, 5) Prochain objectif. Style synthétique, bienveillant, centré sur le coaché.",
    color: "bg-amber-50 border-amber-200",
  },
  {
    id: "analyse_profil",
    label: "Analyser un profil candidat",
    icon: "🔍",
    description: "Analyse un profil de candidat et évalue son adéquation avec un poste.",
    placeholder: "Ex : Profil : 8 ans RH dont 3 ans DRH dans le retail, formation RH, bon leadership mais secteur différent. Poste : DRH scale-up tech 150 personnes, profil agile, transformation digitale...",
    systemPrompt: "Tu es un cabinet de recrutement senior spécialisé RH. Analyse le profil candidat par rapport au poste en français. Structure : 1) Points forts du profil, 2) Points d'attention ou risques, 3) Questions clés à poser en entretien, 4) Verdict et recommandation (à présenter / à creuser / non adapté). Sois direct et précis.",
    color: "bg-rose-50 border-rose-200",
  },
];

export default function OutilsIAPage() {
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [input, setInput] = useState("");
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

  async function runTool() {
    if (!activeTool || !input.trim()) return;
    if (!apiKey) { setShowApiModal(true); return; }

    setLoading(true);
    setOutput("");

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
          system: activeTool.systemPrompt,
          messages: [{ role: "user", content: input }],
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

  function copyOutput() {
    navigator.clipboard.writeText(output);
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Outils IA</h1>
          <p className="text-gray-500 mt-1">Assistants IA intégrés pour votre activité RH</p>
        </div>
        <button
          onClick={() => { setTempKey(apiKey); setShowApiModal(true); }}
          className="text-xs text-gray-400 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
        >
          🔑 {apiKey ? "Clé API configurée" : "Configurer clé API"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tool picker */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Choisir un outil</h2>
          <div className="grid grid-cols-1 gap-3">
            {tools.map(tool => (
              <button
                key={tool.id}
                onClick={() => { setActiveTool(tool); setInput(""); setOutput(""); }}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  activeTool?.id === tool.id
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{tool.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{tool.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Active tool workspace */}
        <div>
          {activeTool ? (
            <div className="sticky top-8">
              <div className={`rounded-xl border-2 p-5 mb-4 ${activeTool.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{activeTool.icon}</span>
                  <h3 className="font-semibold text-gray-900">{activeTool.label}</h3>
                </div>
                <p className="text-sm text-gray-600">{activeTool.description}</p>
              </div>

              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 block mb-2">Votre demande</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={5}
                  placeholder={activeTool.placeholder}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                />
              </div>

              <button
                onClick={runTool}
                disabled={loading || !input.trim()}
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

              {output && (
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500">Résultat</label>
                    <button onClick={copyOutput} className="text-xs text-indigo-600 hover:underline">
                      📋 Copier
                    </button>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {output}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-400">
              <p className="text-5xl mb-4">🤖</p>
              <p className="font-medium">Sélectionnez un outil</p>
              <p className="text-sm mt-1">Choisissez un assistant IA à gauche pour commencer</p>
            </div>
          )}
        </div>
      </div>

      {/* API Key Modal */}
      {showApiModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-2">Clé API Anthropic</h2>
            <p className="text-sm text-gray-500 mb-4">
              Entrez votre clé API Anthropic pour utiliser les outils IA. Elle sera stockée uniquement dans votre navigateur (localStorage).
            </p>
            <input
              className="input w-full mb-4"
              type="password"
              placeholder="sk-ant-..."
              value={tempKey}
              onChange={e => setTempKey(e.target.value)}
            />
            <p className="text-xs text-gray-400 mb-4">
              Obtenez votre clé sur console.anthropic.com
            </p>
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
