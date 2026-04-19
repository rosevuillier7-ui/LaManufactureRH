-- Migration: Commercial section
-- Extends the prospects table with new columns for client tracking.
-- Run this in the Supabase SQL editor.

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS secteur_activite   text,
  ADD COLUMN IF NOT EXISTS type_contact       text,
  ADD COLUMN IF NOT EXISTS resultat           text,
  ADD COLUMN IF NOT EXISTS todo               text,
  ADD COLUMN IF NOT EXISTS todo_date          date,
  ADD COLUMN IF NOT EXISTS statut_paiement    text NOT NULL DEFAULT 'Payé',
  ADD COLUMN IF NOT EXISTS signed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS type_service_autre text;

-- Enable realtime for prospect_actions if not already enabled
-- (Run only if the table exists and realtime is not yet configured)
ALTER PUBLICATION supabase_realtime ADD TABLE prospect_actions;
