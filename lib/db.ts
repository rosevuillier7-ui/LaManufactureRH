// Supabase async CRUD for all entities.
// All functions throw on error — callers should handle as needed.

import { supabase } from "./supabase";
import type {
  Prospect, ProspectStatus, ProspectAction, ActionType, TypeService,
  Client, ClientStatus,
  Mission, MissionStatus,
  Candidat, CandidatStatus,
  Coachee, CoachingStatut,
  Session,
  PostLinkedIn,
  Episode,
  CoachingObjective,
  Placement,
  DebriefTheme,
  InstagramStat,
  PodcastSponsor,
} from "./store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return (v as string) ?? "";
}
function num(v: unknown): number {
  return (v as number) ?? 0;
}
function nullable(v: unknown): string | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  return v as string;
}
function toNullable(v: string | undefined): string | null {
  return v === "" || v === undefined ? null : v;
}

// ─── Prospects ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbProspect(row: any): Prospect {
  return {
    id: str(row.id),
    entreprise: str(row.entreprise),
    nomContact: str(row.nom_contact),
    posteContact: str(row.poste_contact),
    statut: str(row.statut) as ProspectStatus,
    dernierContact: str(row.dernier_contact),
    note: str(row.note),
    telephone: nullable(row.telephone),
    email: nullable(row.email),
    linkedin: nullable(row.linkedin),
    typeService: nullable(row.type_service) as TypeService | undefined,
    typeServiceAutre: nullable(row.type_service_autre),
    valeurEstimee: nullable(row.valeur_estimee),
    prochainRdv: nullable(row.prochain_rdv),
    secteurActivite: nullable(row.secteur_activite),
    typeContact: nullable(row.type_contact),
    resultat: nullable(row.resultat),
    todo: nullable(row.todo),
    todoDate: nullable(row.todo_date),
    statutPaiement: str(row.statut_paiement) || "Payé",
    signedAt: nullable(row.signed_at),
  };
}

function toDbProspect(p: Prospect) {
  return {
    id: p.id,
    entreprise: p.entreprise,
    nom_contact: p.nomContact,
    poste_contact: p.posteContact,
    statut: p.statut,
    dernier_contact: p.dernierContact,
    note: p.note,
    telephone: toNullable(p.telephone),
    email: toNullable(p.email),
    linkedin: toNullable(p.linkedin),
    type_service: toNullable(p.typeService),
    type_service_autre: toNullable(p.typeServiceAutre),
    valeur_estimee: toNullable(p.valeurEstimee),
    prochain_rdv: toNullable(p.prochainRdv),
    secteur_activite: toNullable(p.secteurActivite),
    type_contact: toNullable(p.typeContact),
    resultat: toNullable(p.resultat),
    todo: toNullable(p.todo),
    todo_date: toNullable(p.todoDate),
    statut_paiement: p.statutPaiement ?? "Payé",
    signed_at: toNullable(p.signedAt),
  };
}

export async function getAllProspects(): Promise<Prospect[]> {
  const { data, error } = await supabase.from("prospects").select("*").order("dernier_contact", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbProspect);
}

export async function getActiveProspects(): Promise<Prospect[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .neq("statut", "Signé")
    .order("dernier_contact", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbProspect);
}

export async function getSignedClients(): Promise<Prospect[]> {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("statut", "Signé")
    .order("signed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbProspect);
}

export async function createProspect(p: Prospect): Promise<Prospect> {
  const { data, error } = await supabase.from("prospects").insert(toDbProspect(p)).select().single();
  if (error) throw error;
  return fromDbProspect(data);
}

export async function updateProspect(id: string, p: Prospect): Promise<void> {
  const { error } = await supabase.from("prospects").update(toDbProspect(p)).eq("id", id);
  if (error) throw error;
}

export async function removeProspect(id: string): Promise<void> {
  const { error } = await supabase.from("prospects").delete().eq("id", id);
  if (error) throw error;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbAction(row: any): ProspectAction {
  return {
    id: str(row.id),
    prospectId: str(row.prospect_id),
    date: str(row.date),
    type: str(row.type) as ActionType,
    description: str(row.description),
    auteur: str(row.auteur),
  };
}

export async function getActionsForProspect(prospectId: string): Promise<ProspectAction[]> {
  const { data, error } = await supabase
    .from("prospect_actions")
    .select("*")
    .eq("prospect_id", prospectId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbAction);
}

export async function createProspectAction(a: ProspectAction): Promise<void> {
  const { error } = await supabase.from("prospect_actions").insert({
    id: a.id,
    prospect_id: a.prospectId,
    date: a.date,
    type: a.type,
    description: a.description,
    auteur: a.auteur,
  });
  if (error) throw error;
}

export async function getRecentActions(limit = 10): Promise<ProspectAction[]> {
  const { data, error } = await supabase
    .from("prospect_actions")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(fromDbAction);
}

// ─── Clients ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbClient(row: any): Client {
  return {
    id: str(row.id),
    nom: str(row.nom),
    entreprise: str(row.entreprise),
    contact: str(row.contact),
    email: str(row.email),
    telephone: str(row.telephone),
    secteur: str(row.secteur),
    statut: str(row.statut) as ClientStatus,
    dateCreation: str(row.date_creation),
    notes: str(row.notes),
  };
}

function toDbClient(c: Client) {
  return {
    id: c.id,
    nom: c.nom,
    entreprise: c.entreprise,
    contact: c.contact,
    email: c.email,
    telephone: c.telephone,
    secteur: c.secteur,
    statut: c.statut,
    date_creation: c.dateCreation,
    notes: c.notes,
  };
}

export async function getAllClients(): Promise<Client[]> {
  const { data, error } = await supabase.from("clients").select("*").order("entreprise");
  if (error) throw error;
  return (data ?? []).map(fromDbClient);
}

export async function createClient(c: Client): Promise<Client> {
  const { data, error } = await supabase.from("clients").insert(toDbClient(c)).select().single();
  if (error) throw error;
  return fromDbClient(data);
}

export async function updateClient(id: string, c: Client): Promise<void> {
  const { error } = await supabase.from("clients").update(toDbClient(c)).eq("id", id);
  if (error) throw error;
}

export async function removeClient(id: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw error;
}

// ─── Missions ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbMission(row: any): Mission {
  return {
    id: str(row.id),
    titre: str(row.titre),
    clientId: str(row.client_id),
    statut: str(row.statut) as MissionStatus,
    poste: str(row.poste),
    salaire: str(row.salaire),
    localisation: str(row.localisation),
    dateOuverture: str(row.date_ouverture),
    dateCloture: nullable(row.date_cloture),
    notes: str(row.notes),
  };
}

function toDbMission(m: Mission) {
  return {
    id: m.id,
    titre: m.titre,
    client_id: toNullable(m.clientId),
    statut: m.statut,
    poste: m.poste,
    salaire: m.salaire,
    localisation: m.localisation,
    date_ouverture: m.dateOuverture,
    date_cloture: toNullable(m.dateCloture),
    notes: m.notes,
  };
}

export async function getAllMissions(): Promise<Mission[]> {
  const { data, error } = await supabase.from("missions").select("*").order("date_ouverture", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbMission);
}

export async function createMission(m: Mission): Promise<Mission> {
  const { data, error } = await supabase.from("missions").insert(toDbMission(m)).select().single();
  if (error) throw error;
  return fromDbMission(data);
}

export async function updateMission(id: string, m: Mission): Promise<void> {
  const { error } = await supabase.from("missions").update(toDbMission(m)).eq("id", id);
  if (error) throw error;
}

export async function removeMission(id: string): Promise<void> {
  const { error } = await supabase.from("missions").delete().eq("id", id);
  if (error) throw error;
}

// ─── Candidats ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbCandidat(row: any): Candidat {
  return {
    id: str(row.id),
    nom: str(row.nom),
    prenom: str(row.prenom),
    poste: str(row.poste),
    email: str(row.email),
    telephone: str(row.telephone),
    linkedin: str(row.linkedin),
    statut: str(row.statut) as CandidatStatus,
    missionId: str(row.mission_id),
    dateAjout: str(row.date_ajout),
    dernierContact: nullable(row.dernier_contact),
    notes: str(row.notes),
  };
}

function toDbCandidat(c: Candidat) {
  return {
    id: c.id,
    nom: c.nom,
    prenom: c.prenom,
    poste: c.poste,
    email: c.email,
    telephone: c.telephone,
    linkedin: c.linkedin,
    statut: c.statut,
    mission_id: toNullable(c.missionId),
    date_ajout: c.dateAjout,
    dernier_contact: toNullable(c.dernierContact),
    notes: c.notes,
  };
}

export async function getAllCandidats(): Promise<Candidat[]> {
  const { data, error } = await supabase.from("candidats").select("*").order("date_ajout", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbCandidat);
}

export async function createCandidat(c: Candidat): Promise<Candidat> {
  const { data, error } = await supabase.from("candidats").insert(toDbCandidat(c)).select().single();
  if (error) throw error;
  return fromDbCandidat(data);
}

export async function updateCandidat(id: string, c: Candidat): Promise<void> {
  const { error } = await supabase.from("candidats").update(toDbCandidat(c)).eq("id", id);
  if (error) throw error;
}

export async function removeCandidat(id: string): Promise<void> {
  const { error } = await supabase.from("candidats").delete().eq("id", id);
  if (error) throw error;
}

// ─── Coachees ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbCoachee(row: any): Coachee {
  return {
    id: str(row.id),
    nom: str(row.nom),
    prenom: str(row.prenom),
    fonction: str(row.fonction),
    entreprise: str(row.entreprise),
    email: str(row.email),
    telephone: str(row.telephone),
    statut: str(row.statut) as CoachingStatut,
    objectif: str(row.objectif),
    nbSeances: num(row.nb_seances),
    seancesFaites: num(row.seances_faites),
    dateDebut: str(row.date_debut),
    notes: str(row.notes),
    linkedin: str(row.linkedin),
    typeCoaching: str(row.type_coaching),
    tarifSeance: str(row.tarif_seance),
    prochainRdv: nullable(row.prochain_rdv),
  };
}

function toDbCoachee(c: Coachee) {
  return {
    id: c.id,
    nom: c.nom,
    prenom: c.prenom,
    fonction: c.fonction,
    entreprise: c.entreprise,
    email: c.email,
    telephone: c.telephone,
    statut: c.statut,
    objectif: c.objectif,
    nb_seances: c.nbSeances,
    seances_faites: c.seancesFaites,
    date_debut: c.dateDebut,
    notes: c.notes,
    linkedin: c.linkedin,
    type_coaching: c.typeCoaching,
    tarif_seance: c.tarifSeance,
    prochain_rdv: toNullable(c.prochainRdv),
  };
}

export async function getCoacheeById(id: string): Promise<Coachee | null> {
  const { data, error } = await supabase.from("coachees").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? fromDbCoachee(data) : null;
}

export async function getAllCoachees(): Promise<Coachee[]> {
  const { data, error } = await supabase.from("coachees").select("*").order("date_debut", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbCoachee);
}

export async function createCoachee(c: Coachee): Promise<Coachee> {
  const { data, error } = await supabase.from("coachees").insert(toDbCoachee(c)).select().single();
  if (error) throw error;
  return fromDbCoachee(data);
}

export async function updateCoachee(id: string, c: Coachee): Promise<void> {
  const { error } = await supabase.from("coachees").update(toDbCoachee(c)).eq("id", id);
  if (error) throw error;
}

export async function removeCoachee(id: string): Promise<void> {
  const { error } = await supabase.from("coachees").delete().eq("id", id);
  if (error) throw error;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbSession(row: any): Session {
  return {
    id: str(row.id),
    coacheeId: str(row.coachee_id),
    date: str(row.date),
    duree: num(row.duree),
    resume: str(row.resume),
    pointsCles: str(row.points_cles),
    prochainRdv: nullable(row.prochain_rdv),
    numeroSeance: num(row.numero_seance),
    objectifSeance: str(row.objectif_seance),
    bienMarche: str(row.bien_marche),
    ceQuiBloque: str(row.ce_qui_bloque),
    actionSuivante: str(row.action_suivante),
    niveauEnergie: num(row.niveau_energie),
    debriefText: nullable(row.debrief_text),
    themesResult: row.themes_result ?? undefined,
  };
}

function toDbSession(s: Session) {
  return {
    id: s.id,
    coachee_id: toNullable(s.coacheeId),
    date: s.date,
    duree: s.duree,
    resume: s.resume,
    points_cles: s.pointsCles,
    prochain_rdv: toNullable(s.prochainRdv),
    numero_seance: s.numeroSeance,
    objectif_seance: s.objectifSeance,
    bien_marche: s.bienMarche,
    ce_qui_bloque: s.ceQuiBloque,
    action_suivante: s.actionSuivante,
    niveau_energie: s.niveauEnergie,
    debrief_text: s.debriefText ?? null,
    themes_result: s.themesResult ?? null,
  };
}

export async function getAllSessions(): Promise<Session[]> {
  const { data, error } = await supabase.from("sessions").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbSession);
}

export async function getSessionsByCoachee(coacheeId: string): Promise<Session[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("coachee_id", coacheeId)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDbSession);
}

export async function saveSessionDebrief(
  sessionId: string,
  debriefText: string,
  themesResult: DebriefTheme[]
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ debrief_text: debriefText, themes_result: themesResult })
    .eq("id", sessionId);
  if (error) throw error;
}

export async function createSession(s: Session): Promise<Session> {
  const { data, error } = await supabase.from("sessions").insert(toDbSession(s)).select().single();
  if (error) throw error;
  return fromDbSession(data);
}

export async function updateSession(id: string, s: Session): Promise<void> {
  const { error } = await supabase.from("sessions").update(toDbSession(s)).eq("id", id);
  if (error) throw error;
}

export async function removeSession(id: string): Promise<void> {
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

// ─── LinkedIn posts ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbPost(row: any): PostLinkedIn {
  return {
    id: str(row.id),
    date: str(row.date),
    contenu: str(row.contenu),
    format: str(row.format) as PostLinkedIn["format"],
    vues: num(row.vues),
    likes: num(row.likes),
    commentaires: num(row.commentaires),
    partages: num(row.partages),
    taux_engagement: num(row.taux_engagement),
    tags: (row.tags as string[]) ?? [],
  };
}

function toDbPost(p: PostLinkedIn) {
  return {
    id: p.id,
    date: p.date,
    contenu: p.contenu,
    format: p.format,
    vues: p.vues,
    likes: p.likes,
    commentaires: p.commentaires,
    partages: p.partages,
    taux_engagement: p.taux_engagement,
    tags: p.tags,
  };
}

export async function getAllPosts(): Promise<PostLinkedIn[]> {
  const { data, error } = await supabase.from("linkedin_posts").select("*").order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbPost);
}

export async function createPost(p: PostLinkedIn): Promise<PostLinkedIn> {
  const { data, error } = await supabase.from("linkedin_posts").insert(toDbPost(p)).select().single();
  if (error) throw error;
  return fromDbPost(data);
}

export async function updatePost(id: string, p: PostLinkedIn): Promise<void> {
  const { error } = await supabase.from("linkedin_posts").update(toDbPost(p)).eq("id", id);
  if (error) throw error;
}

export async function removePost(id: string): Promise<void> {
  const { error } = await supabase.from("linkedin_posts").delete().eq("id", id);
  if (error) throw error;
}

// ─── Podcast episodes ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbEpisode(row: any): Episode {
  return {
    id: str(row.id),
    numero: num(row.numero),
    titre: str(row.titre),
    invite: str(row.invite),
    fonction_invite: str(row.fonction_invite),
    date: str(row.date),
    duree: num(row.duree),
    description: str(row.description),
    ecoutes: num(row.ecoutes),
    plateforme: str(row.plateforme),
    lien: str(row.lien),
    statut: str(row.statut) as Episode["statut"],
  };
}

function toDbEpisode(e: Episode) {
  return {
    id: e.id,
    numero: e.numero,
    titre: e.titre,
    invite: e.invite,
    fonction_invite: e.fonction_invite,
    date: e.date,
    duree: e.duree,
    description: e.description,
    ecoutes: e.ecoutes,
    plateforme: e.plateforme,
    lien: e.lien,
    statut: e.statut,
  };
}

export async function getAllEpisodes(): Promise<Episode[]> {
  const { data, error } = await supabase.from("podcast_episodes").select("*").order("numero", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbEpisode);
}

export async function createEpisode(e: Episode): Promise<Episode> {
  const { data, error } = await supabase.from("podcast_episodes").insert(toDbEpisode(e)).select().single();
  if (error) throw error;
  return fromDbEpisode(data);
}

export async function updateEpisode(id: string, e: Episode): Promise<void> {
  const { error } = await supabase.from("podcast_episodes").update(toDbEpisode(e)).eq("id", id);
  if (error) throw error;
}

export async function removeEpisode(id: string): Promise<void> {
  const { error } = await supabase.from("podcast_episodes").delete().eq("id", id);
  if (error) throw error;
}

// ─── Coaching Objectives ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbObjective(row: any): CoachingObjective {
  return {
    id: str(row.id),
    coacheeId: str(row.coachee_id),
    objectifPrincipal: str(row.objectif_principal),
    indicateursReussite: str(row.indicateurs_reussite),
  };
}

export async function getObjectiveByCoachee(coacheeId: string): Promise<CoachingObjective | null> {
  const { data, error } = await supabase
    .from("coaching_objectives")
    .select("*")
    .eq("coachee_id", coacheeId)
    .maybeSingle();
  if (error) throw error;
  return data ? fromDbObjective(data) : null;
}

export async function upsertObjective(obj: CoachingObjective): Promise<void> {
  const { error } = await supabase.from("coaching_objectives").upsert(
    {
      id: obj.id,
      coachee_id: obj.coacheeId,
      objectif_principal: obj.objectifPrincipal,
      indicateurs_reussite: obj.indicateursReussite,
    },
    { onConflict: "coachee_id" }
  );
  if (error) throw error;
}

// ─── Placements ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbPlacement(row: any): Placement {
  return {
    id: str(row.id),
    recruiteeId: str(row.recruitee_id),
    nom: str(row.nom),
    prenom: str(row.prenom),
    poste: str(row.poste),
    entreprise: str(row.entreprise),
    datePriseDePoste: nullable(row.date_prise_de_poste),
    calEventJMinus1Id: nullable(row.cal_event_j_minus_1_id),
    calEventJId: nullable(row.cal_event_j_id),
    calEventJPlus15Id: nullable(row.cal_event_j_plus_15_id),
    calEventJPlus46Id: nullable(row.cal_event_j_plus_46_id),
    calEventJPlus76Id: nullable(row.cal_event_j_plus_76_id),
    createdAt: str(row.created_at),
  };
}

export async function getAllPlacements(): Promise<Placement[]> {
  const { data, error } = await supabase
    .from("placements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbPlacement);
}

export async function upsertPlacement(p: {
  recruiteeId: string;
  nom: string;
  prenom: string;
  poste: string;
  entreprise: string;
  startDate?: string | null;
}): Promise<Placement> {
  const row: Record<string, unknown> = {
    recruitee_id: p.recruiteeId,
    nom: p.nom,
    prenom: p.prenom,
    poste: p.poste,
    entreprise: p.entreprise,
  };
  if (p.startDate) row.date_prise_de_poste = p.startDate;
  const { data, error } = await supabase
    .from("placements")
    .upsert(row, { onConflict: "recruitee_id" })
    .select()
    .single();
  if (error) throw error;
  return fromDbPlacement(data);
}

export async function updatePlacementStartDate(
  id: string,
  datePriseDePoste: string,
  eventIds: {
    calEventJMinus1Id: string;
    calEventJId: string;
    calEventJPlus15Id: string;
    calEventJPlus46Id: string;
    calEventJPlus76Id: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from("placements")
    .update({
      date_prise_de_poste: datePriseDePoste,
      cal_event_j_minus_1_id: eventIds.calEventJMinus1Id,
      cal_event_j_id: eventIds.calEventJId,
      cal_event_j_plus_15_id: eventIds.calEventJPlus15Id,
      cal_event_j_plus_46_id: eventIds.calEventJPlus46Id,
      cal_event_j_plus_76_id: eventIds.calEventJPlus76Id,
    })
    .eq("id", id);
  if (error) throw error;
}

// ─── Instagram Stats ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbInstagramStat(row: any): InstagramStat {
  return {
    id: str(row.id),
    month: str(row.month),
    abonnes: num(row.abonnes),
    dmsRecus: num(row.dms_recus),
    dmsConvertis: num(row.dms_convertis),
    prospectsGeneres: num(row.prospects_generes),
    postsPublies: num(row.posts_publies),
    reelsPublies: num(row.reels_publies),
    bestPostUrl: str(row.best_post_url),
    bestPostNotes: str(row.best_post_notes),
    createdAt: str(row.created_at),
  };
}

function toDbInstagramStat(s: InstagramStat) {
  return {
    id: s.id,
    month: s.month,
    abonnes: s.abonnes,
    dms_recus: s.dmsRecus,
    dms_convertis: s.dmsConvertis,
    prospects_generes: s.prospectsGeneres,
    posts_publies: s.postsPublies,
    reels_publies: s.reelsPublies,
    best_post_url: toNullable(s.bestPostUrl),
    best_post_notes: toNullable(s.bestPostNotes),
  };
}

export async function getAllInstagramStats(): Promise<InstagramStat[]> {
  const { data, error } = await supabase
    .from("instagram_stats")
    .select("*")
    .order("month", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbInstagramStat);
}

export async function createInstagramStat(s: InstagramStat): Promise<InstagramStat> {
  const { data, error } = await supabase
    .from("instagram_stats")
    .insert(toDbInstagramStat(s))
    .select()
    .single();
  if (error) throw error;
  return fromDbInstagramStat(data);
}

export async function updateInstagramStat(id: string, s: InstagramStat): Promise<void> {
  const { error } = await supabase
    .from("instagram_stats")
    .update(toDbInstagramStat(s))
    .eq("id", id);
  if (error) throw error;
}

export async function removeInstagramStat(id: string): Promise<void> {
  const { error } = await supabase.from("instagram_stats").delete().eq("id", id);
  if (error) throw error;
}

// ─── Podcast Sponsors ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromDbSponsor(row: any): PodcastSponsor {
  return {
    id: str(row.id),
    episode_id: nullable(row.episode_id),
    nom_sponsor: str(row.nom_sponsor),
    brief_client: nullable(row.brief_client),
    linkedin_post_done: !!(row.linkedin_post_done),
    youtube_description_done: !!(row.youtube_description_done),
    date_diffusion: nullable(row.date_diffusion),
    created_at: str(row.created_at),
  };
}

function toDbSponsor(s: PodcastSponsor) {
  return {
    id: s.id,
    episode_id: toNullable(s.episode_id),
    nom_sponsor: s.nom_sponsor,
    brief_client: toNullable(s.brief_client),
    linkedin_post_done: s.linkedin_post_done,
    youtube_description_done: s.youtube_description_done,
    date_diffusion: toNullable(s.date_diffusion),
  };
}

export async function getAllSponsors(): Promise<PodcastSponsor[]> {
  const { data, error } = await supabase
    .from("podcast_sponsors")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbSponsor);
}

export async function createSponsor(s: PodcastSponsor): Promise<PodcastSponsor> {
  const { data, error } = await supabase.from("podcast_sponsors").insert(toDbSponsor(s)).select().single();
  if (error) throw error;
  return fromDbSponsor(data);
}

export async function updateSponsor(id: string, s: Partial<PodcastSponsor>): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (s.episode_id !== undefined) patch.episode_id = toNullable(s.episode_id);
  if (s.nom_sponsor !== undefined) patch.nom_sponsor = s.nom_sponsor;
  if (s.brief_client !== undefined) patch.brief_client = toNullable(s.brief_client);
  if (s.linkedin_post_done !== undefined) patch.linkedin_post_done = s.linkedin_post_done;
  if (s.youtube_description_done !== undefined) patch.youtube_description_done = s.youtube_description_done;
  if (s.date_diffusion !== undefined) patch.date_diffusion = toNullable(s.date_diffusion);
  const { error } = await supabase.from("podcast_sponsors").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeSponsor(id: string): Promise<void> {
  const { error } = await supabase.from("podcast_sponsors").delete().eq("id", id);
  if (error) throw error;
}
