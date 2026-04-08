// localStorage store with typed helpers

export type ClientStatus = "prospect" | "actif" | "inactif";
export type MissionStatus = "ouverte" | "en_cours" | "pourvue" | "annulée";
export type CandidatStatus = "identifié" | "contacté" | "présenté" | "retenu" | "refusé";
export type ProspectStatus = "À contacter" | "Contacté" | "En discussion" | "Proposition envoyée" | "Signé" | "Perdu";

export interface Client {
  id: string;
  nom: string;
  entreprise: string;
  contact: string;
  email: string;
  telephone: string;
  secteur: string;
  statut: ClientStatus;
  dateCreation: string;
  notes: string;
}

export interface Mission {
  id: string;
  titre: string;
  clientId: string;
  statut: MissionStatus;
  poste: string;
  salaire: string;
  localisation: string;
  dateOuverture: string;
  dateCloture?: string;
  notes: string;
}

export interface Candidat {
  id: string;
  nom: string;
  prenom: string;
  poste: string;
  email: string;
  telephone: string;
  linkedin: string;
  statut: CandidatStatus;
  missionId?: string;
  dateAjout: string;
  dernierContact?: string;
  notes: string;
}

export interface Prospect {
  id: string;
  entreprise: string;
  nomContact: string;
  posteContact: string;
  statut: ProspectStatus;
  dernierContact: string;
  note: string;
}

export type CoachingStatut = "actif" | "terminé" | "pause";

export interface Coachee {
  id: string;
  nom: string;
  prenom: string;
  fonction: string;
  entreprise: string;
  email: string;
  telephone: string;
  statut: CoachingStatut;
  objectif: string;
  nbSeances: number;
  seancesFaites: number;
  dateDebut: string;
  notes: string;
}

export interface Session {
  id: string;
  coacheeId: string;
  date: string;
  duree: number; // minutes
  resume: string;
  pointsCles: string;
  prochainRdv?: string;
}

export interface PostLinkedIn {
  id: string;
  date: string;
  contenu: string;
  format: "texte" | "carousel" | "video" | "image" | "article";
  vues: number;
  likes: number;
  commentaires: number;
  partages: number;
  taux_engagement: number;
  tags: string[];
}

export interface Episode {
  id: string;
  numero: number;
  titre: string;
  invite: string;
  fonction_invite: string;
  date: string;
  duree: number; // minutes
  description: string;
  ecoutes: number;
  plateforme: string;
  lien: string;
  statut: "brouillon" | "enregistré" | "publié";
}

export interface AppData {
  clients: Client[];
  missions: Mission[];
  candidats: Candidat[];
  coachees: Coachee[];
  sessions: Session[];
  posts: PostLinkedIn[];
  episodes: Episode[];
  prospects: Prospect[];
}

const STORAGE_KEY = "lamanufacturehr_data";

const defaultData: AppData = {
  clients: [
    {
      id: "c1",
      nom: "Dupont",
      entreprise: "TechCorp",
      contact: "Marie Dupont",
      email: "marie.dupont@techcorp.fr",
      telephone: "06 12 34 56 78",
      secteur: "Tech",
      statut: "actif",
      dateCreation: "2025-01-15",
      notes: "Client prioritaire",
    },
    {
      id: "c2",
      nom: "Renault",
      entreprise: "Groupe Horizon",
      contact: "Pierre Renault",
      email: "p.renault@horizon.fr",
      telephone: "06 98 76 54 32",
      secteur: "Finance",
      statut: "actif",
      dateCreation: "2025-02-10",
      notes: "",
    },
    {
      id: "c3",
      nom: "Lambert",
      entreprise: "Santé Plus",
      contact: "Sophie Lambert",
      email: "s.lambert@santeplus.fr",
      telephone: "07 11 22 33 44",
      secteur: "Santé",
      statut: "prospect",
      dateCreation: "2025-03-01",
      notes: "À relancer",
    },
  ],
  missions: [
    {
      id: "m1",
      titre: "DRH - Groupe TechCorp",
      clientId: "c1",
      statut: "en_cours",
      poste: "Directeur des Ressources Humaines",
      salaire: "80-95K€",
      localisation: "Paris 8e",
      dateOuverture: "2025-02-01",
      notes: "3 candidats shortlistés",
    },
    {
      id: "m2",
      titre: "RRH Horizon",
      clientId: "c2",
      statut: "ouverte",
      poste: "Responsable RH",
      salaire: "55-65K€",
      localisation: "Lyon",
      dateOuverture: "2025-03-15",
      notes: "",
    },
  ],
  candidats: [
    {
      id: "ca1",
      nom: "Martin",
      prenom: "Julie",
      poste: "DRH",
      email: "julie.martin@email.fr",
      telephone: "06 55 44 33 22",
      linkedin: "linkedin.com/in/juliemartin",
      statut: "présenté",
      missionId: "m1",
      dateAjout: "2025-02-15",
      notes: "Profil très solide, 12 ans d'expérience",
    },
    {
      id: "ca2",
      nom: "Bernard",
      prenom: "Thomas",
      poste: "DRH",
      email: "t.bernard@email.fr",
      telephone: "07 66 55 44 33",
      linkedin: "linkedin.com/in/tbernard",
      statut: "contacté",
      missionId: "m1",
      dateAjout: "2025-02-20",
      notes: "",
    },
  ],
  coachees: [
    {
      id: "co1",
      nom: "Lefebvre",
      prenom: "Isabelle",
      fonction: "DRH",
      entreprise: "Médiacom",
      email: "i.lefebvre@mediacom.fr",
      telephone: "06 77 88 99 00",
      statut: "actif",
      objectif: "Développer son leadership et gérer les transformations RH",
      nbSeances: 10,
      seancesFaites: 6,
      dateDebut: "2025-01-10",
      notes: "Excellente progression",
    },
    {
      id: "co2",
      nom: "Girard",
      prenom: "Marc",
      fonction: "Manager",
      entreprise: "LogiGroup",
      email: "m.girard@logigroup.fr",
      telephone: "06 11 22 33 44",
      statut: "actif",
      objectif: "Améliorer la gestion d'équipe et la communication",
      nbSeances: 8,
      seancesFaites: 3,
      dateDebut: "2025-02-20",
      notes: "",
    },
  ],
  sessions: [
    {
      id: "s1",
      coacheeId: "co1",
      date: "2025-03-15",
      duree: 60,
      resume: "Travail sur la délégation et la confiance",
      pointsCles: "Meilleure écoute active, plan d'action défini",
      prochainRdv: "2025-04-05",
    },
  ],
  posts: [
    {
      id: "p1",
      date: "2026-03-25",
      contenu: "Le recrutement n'est pas qu'une question de CV. C'est avant tout une question de contexte...",
      format: "texte",
      vues: 4200,
      likes: 187,
      commentaires: 34,
      partages: 22,
      taux_engagement: 5.8,
      tags: ["recrutement", "RH"],
    },
    {
      id: "p2",
      date: "2026-03-18",
      contenu: "5 erreurs que font les managers dans leurs entretiens annuels (et comment les éviter)",
      format: "carousel",
      vues: 8700,
      likes: 412,
      commentaires: 67,
      partages: 89,
      taux_engagement: 6.5,
      tags: ["management", "RH", "leadership"],
    },
    {
      id: "p3",
      date: "2026-03-10",
      contenu: "Pourquoi les DRH doivent devenir des acteurs business en 2026",
      format: "article",
      vues: 3100,
      likes: 145,
      commentaires: 28,
      partages: 31,
      taux_engagement: 6.6,
      tags: ["DRH", "stratégie"],
    },
  ],
  prospects: [
    {
      id: "pr1",
      entreprise: "Alpha Tech",
      nomContact: "Julien Moreau",
      posteContact: "DRH",
      statut: "En discussion",
      dernierContact: "2026-04-01",
      note: "Intéressé par une mission de recrutement RRH",
    },
    {
      id: "pr2",
      entreprise: "Beta Services",
      nomContact: "Camille Durand",
      posteContact: "DG",
      statut: "À contacter",
      dernierContact: "2026-03-25",
      note: "Référence de Marie Dupont",
    },
    {
      id: "pr3",
      entreprise: "Delta Conseil",
      nomContact: "Romain Favre",
      posteContact: "DAF",
      statut: "Proposition envoyée",
      dernierContact: "2026-04-05",
      note: "Proposition coaching dirigeant envoyée",
    },
  ],
  episodes: [
    {
      id: "ep1",
      numero: 12,
      titre: "Le burn-out managérial : comment s'en sortir ?",
      invite: "Claire Fontaine",
      fonction_invite: "Psychologue du travail",
      date: "2026-03-20",
      duree: 48,
      description: "On décrypte le burn-out des managers avec Claire Fontaine.",
      ecoutes: 1850,
      plateforme: "Spotify / Apple Podcasts",
      lien: "",
      statut: "publié",
    },
    {
      id: "ep2",
      numero: 13,
      titre: "Recrutement en 2026 : l'IA change-t-elle vraiment la donne ?",
      invite: "Antoine Roux",
      fonction_invite: "Head of Talent Acquisition",
      date: "2026-04-03",
      duree: 52,
      description: "Antoine Roux partage son expérience de l'IA dans le recrutement.",
      ecoutes: 920,
      plateforme: "Spotify / Apple Podcasts",
      lien: "",
      statut: "publié",
    },
    {
      id: "ep3",
      numero: 14,
      titre: "La semaine de 4 jours : utopie ou modèle d'avenir ?",
      invite: "Sara Menant",
      fonction_invite: "DRH - Scale-up",
      date: "2026-04-17",
      duree: 0,
      description: "",
      ecoutes: 0,
      plateforme: "",
      lien: "",
      statut: "brouillon",
    },
  ],
};

export function loadData(): AppData {
  if (typeof window === "undefined") return defaultData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveData(defaultData);
      return defaultData;
    }
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.prospects) parsed.prospects = defaultData.prospects;
    return parsed;
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
