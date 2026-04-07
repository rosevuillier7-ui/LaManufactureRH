"use client";

import { useEffect, useState } from "react";
import { loadData, saveData, AppData, PostLinkedIn, generateId } from "@/lib/store";
import Badge from "@/components/Badge";
import StatCard from "@/components/StatCard";
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";

type Format = PostLinkedIn["format"];
const formatLabel: Record<Format, string> = {
  texte: "Texte",
  carousel: "Carousel",
  video: "Vidéo",
  image: "Image",
  article: "Article",
};
const formatVariant: Record<Format, "gray" | "blue" | "purple" | "yellow" | "indigo"> = {
  texte: "gray",
  carousel: "blue",
  video: "purple",
  image: "yellow",
  article: "indigo",
};

const emptyPost = (): Omit<PostLinkedIn, "id"> => ({
  date: new Date().toISOString().split("T")[0],
  contenu: "",
  format: "texte",
  vues: 0,
  likes: 0,
  commentaires: 0,
  partages: 0,
  taux_engagement: 0,
  tags: [],
});

export default function LinkedInPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<PostLinkedIn | null>(null);
  const [form, setForm] = useState(emptyPost());
  const [tagsInput, setTagsInput] = useState("");

  useEffect(() => { setData(loadData()); }, []);

  function openAdd() { setEditing(null); setForm(emptyPost()); setTagsInput(""); setModal(true); }
  function openEdit(p: PostLinkedIn) {
    setEditing(p);
    setForm({ ...p });
    setTagsInput(p.tags.join(", "));
    setModal(true);
  }

  function save() {
    if (!data) return;
    const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    const totalInteractions = form.likes + form.commentaires + form.partages;
    const taux = form.vues > 0 ? Math.round((totalInteractions / form.vues) * 1000) / 10 : 0;
    const post = { ...form, tags, taux_engagement: taux };

    let posts: PostLinkedIn[];
    if (editing) {
      posts = data.posts.map(p => p.id === editing.id ? { ...post, id: editing.id } : p);
    } else {
      posts = [...data.posts, { ...post, id: generateId() }];
    }
    const updated = { ...data, posts };
    saveData(updated);
    setData(updated);
    setModal(false);
  }

  function remove(id: string) {
    if (!data || !confirm("Supprimer ce post ?")) return;
    const updated = { ...data, posts: data.posts.filter(p => p.id !== id) };
    saveData(updated);
    setData(updated);
  }

  if (!data) return null;

  const posts = [...data.posts].sort((a, b) => b.date.localeCompare(a.date));
  const totalVues = posts.reduce((s, p) => s + p.vues, 0);
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalCommentaires = posts.reduce((s, p) => s + p.commentaires, 0);
  const avgEngagement = posts.length
    ? Math.round(posts.reduce((s, p) => s + p.taux_engagement, 0) / posts.length * 10) / 10
    : 0;

  const bestPost = posts.reduce((best, p) => (!best || p.vues > best.vues ? p : best), null as PostLinkedIn | null);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">LinkedIn</h1>
        <p className="text-gray-500 mt-1">Analyse de vos performances de contenu</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total vues" value={totalVues.toLocaleString("fr-FR")} sub={`${posts.length} posts`} color="violet" />
        <StatCard label="Total likes" value={totalLikes.toLocaleString("fr-FR")} color="rose" />
        <StatCard label="Commentaires" value={totalCommentaires.toLocaleString("fr-FR")} color="sky" />
        <StatCard label="Engagement moyen" value={`${avgEngagement}%`} color="emerald" />
      </div>

      {bestPost && (
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
          <p className="text-sm font-medium text-violet-200 mb-2">🏆 Meilleur post</p>
          <p className="font-semibold line-clamp-2">{bestPost.contenu}</p>
          <div className="flex gap-4 mt-3 text-sm text-violet-200">
            <span>👁 {bestPost.vues.toLocaleString("fr-FR")} vues</span>
            <span>❤️ {bestPost.likes} likes</span>
            <span>💬 {bestPost.commentaires} commentaires</span>
            <span className="text-white font-medium ml-auto">{bestPost.taux_engagement}% engagement</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Tous les posts</h2>
        <button onClick={openAdd} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <PlusIcon className="w-4 h-4" /> Ajouter un post
        </button>
      </div>

      <div className="space-y-3">
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-400">
                    {new Date(post.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <Badge label={formatLabel[post.format]} variant={formatVariant[post.format]} />
                  {post.tags.map(tag => (
                    <span key={tag} className="text-xs text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">#{tag}</span>
                  ))}
                </div>
                <p className="text-sm text-gray-700 line-clamp-3">{post.contenu}</p>
                <div className="flex gap-4 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">👁 <strong className="text-gray-700">{post.vues.toLocaleString("fr-FR")}</strong></span>
                  <span className="flex items-center gap-1">❤️ <strong className="text-gray-700">{post.likes}</strong></span>
                  <span className="flex items-center gap-1">💬 <strong className="text-gray-700">{post.commentaires}</strong></span>
                  <span className="flex items-center gap-1">🔁 <strong className="text-gray-700">{post.partages}</strong></span>
                  <div className="ml-auto flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${post.taux_engagement >= 5 ? "bg-emerald-500" : post.taux_engagement >= 3 ? "bg-amber-400" : "bg-red-400"}`} />
                    <span className="text-xs font-semibold text-gray-700">{post.taux_engagement}%</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(post)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors">
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={() => remove(post.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-6">{editing ? "Modifier le post" : "Nouveau post"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Date</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Format</label>
                <select className="input" value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value as Format }))}>
                  <option value="texte">Texte</option>
                  <option value="carousel">Carousel</option>
                  <option value="video">Vidéo</option>
                  <option value="image">Image</option>
                  <option value="article">Article</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Contenu / Titre</label>
                <textarea className="input resize-none" rows={3} value={form.contenu} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Vues</label>
                <input className="input" type="number" min={0} value={form.vues} onChange={e => setForm(f => ({ ...f, vues: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Likes</label>
                <input className="input" type="number" min={0} value={form.likes} onChange={e => setForm(f => ({ ...f, likes: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Commentaires</label>
                <input className="input" type="number" min={0} value={form.commentaires} onChange={e => setForm(f => ({ ...f, commentaires: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Partages</label>
                <input className="input" type="number" min={0} value={form.partages} onChange={e => setForm(f => ({ ...f, partages: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Tags (séparés par des virgules)</label>
                <input className="input" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="recrutement, RH, leadership" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
