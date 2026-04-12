// Type definitions for La Manufacture RH

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

export type TypeService = "Recrutement" | "Coaching" | "Les deux";

export interface Prospect {
  id: string;
  entreprise: string;
  nomContact: string;
  posteContact: string;
  statut: ProspectStatus;
  dernierContact: string;
  note: string;
  telephone?: string;
  email?: string;
  linkedin?: string;
  typeService?: TypeService;
  valeurEstimee?: string;
  prochainRdv?: string;
}

export type ActionType = "contact" | "relance" | "statut" | "note" | "Appel" | "Email" | "RDV" | "Note";

export interface ProspectAction {
  id: string;
  prospectId: string;
  date: string;
  type: ActionType;
  description: string;
  auteur: string;
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
  linkedin: string;
  typeCoaching: string;
  tarifSeance: string;
  prochainRdv?: string;
}

export interface Session {
  id: string;
  coacheeId: string;
  date: string;
  duree: number; // minutes
  resume: string;
  pointsCles: string;
  prochainRdv?: string;
  numeroSeance: number;
  objectifSeance: string;
  bienMarche: string;
  ceQuiBloque: string;
  actionSuivante: string;
  niveauEnergie: number; // 1-5, 0 = non défini
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

export interface CoachingObjective {
  id: string;
  coacheeId: string;
  objectifPrincipal: string;
  indicateursReussite: string;
}

export interface Placement {
  id: string;
  recruiteeId: string;
  nom: string;
  prenom: string;
  poste: string;
  entreprise: string;
  datePriseDePoste?: string; // YYYY-MM-DD
  calEventJMinus1Id?: string;
  calEventJId?: string;
  calEventJPlus15Id?: string;
  calEventJPlus46Id?: string;
  calEventJPlus76Id?: string;
  createdAt: string;
}

export interface DebriefTheme {
  titre: string;
  description: string;
  actions: string[];
  outils: string[];
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

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}
