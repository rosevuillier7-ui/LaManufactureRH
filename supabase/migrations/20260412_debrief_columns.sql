-- Add debrief_text and themes_result columns to sessions table
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS debrief_text TEXT,
  ADD COLUMN IF NOT EXISTS themes_result JSONB;
