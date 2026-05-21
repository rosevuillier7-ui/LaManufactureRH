-- Per-account Google Calendar OAuth tokens (Flaubert, Claire).
-- Replaces the previous single shared cookie-based token storage.

create table if not exists google_accounts (
  id            uuid primary key default gen_random_uuid(),
  account_key   text unique not null,          -- 'flaubert' | 'claire'
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  email         text,
  updated_at    timestamptz not null default now()
);

-- Lock the table down: refresh tokens are long-lived secrets.
-- RLS on + zero policies => the public anon key gets NO access at all.
-- The server's service-role key bypasses RLS, so the API routes still work.
alter table google_accounts enable row level security;

-- Seed both rows so the status UI can read them before the first connect.
insert into google_accounts (account_key) values ('flaubert'), ('claire')
on conflict (account_key) do nothing;
