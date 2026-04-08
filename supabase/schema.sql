-- La Manufacture RH — Supabase schema
-- Run this entire file in the Supabase SQL editor once.

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists prospects (
  id text primary key,
  entreprise text not null default '',
  nom_contact text not null default '',
  poste_contact text not null default '',
  statut text not null default 'À contacter',
  dernier_contact date not null default current_date,
  note text not null default ''
);

create table if not exists clients (
  id text primary key,
  nom text not null default '',
  entreprise text not null default '',
  contact text not null default '',
  email text not null default '',
  telephone text not null default '',
  secteur text not null default '',
  statut text not null default 'prospect',
  date_creation date not null default current_date,
  notes text not null default ''
);

create table if not exists missions (
  id text primary key,
  titre text not null default '',
  client_id text references clients(id) on delete set null,
  statut text not null default 'ouverte',
  poste text not null default '',
  salaire text not null default '',
  localisation text not null default '',
  date_ouverture date not null default current_date,
  date_cloture date,
  notes text not null default ''
);

create table if not exists candidats (
  id text primary key,
  nom text not null default '',
  prenom text not null default '',
  poste text not null default '',
  email text not null default '',
  telephone text not null default '',
  linkedin text not null default '',
  statut text not null default 'identifié',
  mission_id text references missions(id) on delete set null,
  date_ajout date not null default current_date,
  dernier_contact date,
  notes text not null default ''
);

create table if not exists coachees (
  id text primary key,
  nom text not null default '',
  prenom text not null default '',
  fonction text not null default '',
  entreprise text not null default '',
  email text not null default '',
  telephone text not null default '',
  statut text not null default 'actif',
  objectif text not null default '',
  nb_seances integer not null default 10,
  seances_faites integer not null default 0,
  date_debut date not null default current_date,
  notes text not null default ''
);

create table if not exists sessions (
  id text primary key,
  coachee_id text references coachees(id) on delete cascade,
  date date not null default current_date,
  duree integer not null default 60,
  resume text not null default '',
  points_cles text not null default '',
  prochain_rdv date
);

create table if not exists linkedin_posts (
  id text primary key,
  date date not null default current_date,
  contenu text not null default '',
  format text not null default 'texte',
  vues integer not null default 0,
  likes integer not null default 0,
  commentaires integer not null default 0,
  partages integer not null default 0,
  taux_engagement numeric not null default 0,
  tags text[] not null default '{}'
);

create table if not exists podcast_episodes (
  id text primary key,
  numero integer not null default 1,
  titre text not null default '',
  invite text not null default '',
  fonction_invite text not null default '',
  date date not null default current_date,
  duree integer not null default 0,
  description text not null default '',
  ecoutes integer not null default 0,
  plateforme text not null default '',
  lien text not null default '',
  statut text not null default 'brouillon'
);

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Required for postgres_changes subscriptions to include old row data

alter table prospects       replica identity full;
alter table clients         replica identity full;
alter table missions        replica identity full;
alter table candidats       replica identity full;
alter table coachees        replica identity full;
alter table sessions        replica identity full;
alter table linkedin_posts  replica identity full;
alter table podcast_episodes replica identity full;

-- Add all tables to the supabase_realtime publication
-- (Supabase creates this publication automatically; we just add our tables)
alter publication supabase_realtime add table prospects;
alter publication supabase_realtime add table clients;
alter publication supabase_realtime add table missions;
alter publication supabase_realtime add table candidats;
alter publication supabase_realtime add table coachees;
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table linkedin_posts;
alter publication supabase_realtime add table podcast_episodes;

-- ─── Seed data ────────────────────────────────────────────────────────────────
-- Sample data matching the old localStorage defaults.
-- Delete or skip if you prefer to start with an empty database.

insert into clients (id, nom, entreprise, contact, email, telephone, secteur, statut, date_creation, notes) values
  ('c1', 'Dupont', 'TechCorp', 'Marie Dupont', 'marie.dupont@techcorp.fr', '06 12 34 56 78', 'Tech', 'actif', '2025-01-15', 'Client prioritaire'),
  ('c2', 'Renault', 'Groupe Horizon', 'Pierre Renault', 'p.renault@horizon.fr', '06 98 76 54 32', 'Finance', 'actif', '2025-02-10', ''),
  ('c3', 'Lambert', 'Santé Plus', 'Sophie Lambert', 's.lambert@santeplus.fr', '07 11 22 33 44', 'Santé', 'prospect', '2025-03-01', 'À relancer')
on conflict (id) do nothing;

insert into missions (id, titre, client_id, statut, poste, salaire, localisation, date_ouverture, notes) values
  ('m1', 'DRH - Groupe TechCorp', 'c1', 'en_cours', 'Directeur des Ressources Humaines', '80-95K€', 'Paris 8e', '2025-02-01', '3 candidats shortlistés'),
  ('m2', 'RRH Horizon', 'c2', 'ouverte', 'Responsable RH', '55-65K€', 'Lyon', '2025-03-15', '')
on conflict (id) do nothing;

insert into candidats (id, nom, prenom, poste, email, telephone, linkedin, statut, mission_id, date_ajout, notes) values
  ('ca1', 'Martin', 'Julie', 'DRH', 'julie.martin@email.fr', '06 55 44 33 22', 'linkedin.com/in/juliemartin', 'présenté', 'm1', '2025-02-15', 'Profil très solide, 12 ans d''expérience'),
  ('ca2', 'Bernard', 'Thomas', 'DRH', 't.bernard@email.fr', '07 66 55 44 33', 'linkedin.com/in/tbernard', 'contacté', 'm1', '2025-02-20', '')
on conflict (id) do nothing;

insert into prospects (id, entreprise, nom_contact, poste_contact, statut, dernier_contact, note) values
  ('pr1', 'Alpha Tech', 'Julien Moreau', 'DRH', 'En discussion', '2026-04-01', 'Intéressé par une mission de recrutement RRH'),
  ('pr2', 'Beta Services', 'Camille Durand', 'DG', 'À contacter', '2026-03-25', 'Référence de Marie Dupont'),
  ('pr3', 'Delta Conseil', 'Romain Favre', 'DAF', 'Proposition envoyée', '2026-04-05', 'Proposition coaching dirigeant envoyée')
on conflict (id) do nothing;

insert into coachees (id, nom, prenom, fonction, entreprise, email, telephone, statut, objectif, nb_seances, seances_faites, date_debut, notes) values
  ('co1', 'Lefebvre', 'Isabelle', 'DRH', 'Médiacom', 'i.lefebvre@mediacom.fr', '06 77 88 99 00', 'actif', 'Développer son leadership et gérer les transformations RH', 10, 6, '2025-01-10', 'Excellente progression'),
  ('co2', 'Girard', 'Marc', 'Manager', 'LogiGroup', 'm.girard@logigroup.fr', '06 11 22 33 44', 'actif', 'Améliorer la gestion d''équipe et la communication', 8, 3, '2025-02-20', '')
on conflict (id) do nothing;

insert into sessions (id, coachee_id, date, duree, resume, points_cles, prochain_rdv) values
  ('s1', 'co1', '2025-03-15', 60, 'Travail sur la délégation et la confiance', 'Meilleure écoute active, plan d''action défini', '2025-04-05')
on conflict (id) do nothing;

insert into linkedin_posts (id, date, contenu, format, vues, likes, commentaires, partages, taux_engagement, tags) values
  ('p1', '2026-03-25', 'Le recrutement n''est pas qu''une question de CV. C''est avant tout une question de contexte...', 'texte', 4200, 187, 34, 22, 5.8, ARRAY['recrutement', 'RH']),
  ('p2', '2026-03-18', '5 erreurs que font les managers dans leurs entretiens annuels (et comment les éviter)', 'carousel', 8700, 412, 67, 89, 6.5, ARRAY['management', 'RH', 'leadership']),
  ('p3', '2026-03-10', 'Pourquoi les DRH doivent devenir des acteurs business en 2026', 'article', 3100, 145, 28, 31, 6.6, ARRAY['DRH', 'stratégie'])
on conflict (id) do nothing;

insert into podcast_episodes (id, numero, titre, invite, fonction_invite, date, duree, description, ecoutes, plateforme, lien, statut) values
  ('ep1', 12, 'Le burn-out managérial : comment s''en sortir ?', 'Claire Fontaine', 'Psychologue du travail', '2026-03-20', 48, 'On décrypte le burn-out des managers avec Claire Fontaine.', 1850, 'Spotify / Apple Podcasts', '', 'publié'),
  ('ep2', 13, 'Recrutement en 2026 : l''IA change-t-elle vraiment la donne ?', 'Antoine Roux', 'Head of Talent Acquisition', '2026-04-03', 52, 'Antoine Roux partage son expérience de l''IA dans le recrutement.', 920, 'Spotify / Apple Podcasts', '', 'publié'),
  ('ep3', 14, 'La semaine de 4 jours : utopie ou modèle d''avenir ?', 'Sara Menant', 'DRH - Scale-up', '2026-04-17', 0, '', 0, '', '', 'brouillon')
on conflict (id) do nothing;
