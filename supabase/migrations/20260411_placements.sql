-- Suivi post-placement: hired candidates from Recruitee with Google Calendar events

create table if not exists placements (
  id uuid primary key default gen_random_uuid(),
  recruitee_id text unique not null,
  nom text not null default '',
  prenom text not null default '',
  poste text not null default '',
  entreprise text not null default '',
  date_prise_de_poste date,
  cal_event_j_minus_1_id text,
  cal_event_j_id text,
  cal_event_j_plus_15_id text,
  cal_event_j_plus_46_id text,
  cal_event_j_plus_76_id text,
  created_at timestamptz not null default now()
);
