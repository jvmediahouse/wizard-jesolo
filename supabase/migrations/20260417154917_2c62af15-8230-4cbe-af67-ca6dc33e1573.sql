-- Drop existing PK
ALTER TABLE public.deskline_event_themes DROP CONSTRAINT IF EXISTS deskline_event_themes_pkey;

-- Change theme_id from bigint to text (table is empty, safe to cast)
ALTER TABLE public.deskline_event_themes
  ALTER COLUMN theme_id TYPE text USING theme_id::text;

-- Re-add composite PK
ALTER TABLE public.deskline_event_themes
  ADD CONSTRAINT deskline_event_themes_pkey PRIMARY KEY (event_id, theme_id);

-- Ensure index on event_id exists
CREATE INDEX IF NOT EXISTS idx_deskline_event_themes_event_id
  ON public.deskline_event_themes(event_id);