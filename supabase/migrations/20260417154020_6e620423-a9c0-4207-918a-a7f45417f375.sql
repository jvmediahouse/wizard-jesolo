-- Add theme_order column
ALTER TABLE public.deskline_event_themes
  ADD COLUMN IF NOT EXISTS theme_order integer;

-- Drop any existing PK if present, then add composite PK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.deskline_event_themes'::regclass
      AND contype = 'p'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.deskline_event_themes DROP CONSTRAINT ' || quote_ident(conname)
      FROM pg_constraint
      WHERE conrelid = 'public.deskline_event_themes'::regclass AND contype = 'p'
      LIMIT 1
    );
  END IF;
END$$;

ALTER TABLE public.deskline_event_themes
  ADD CONSTRAINT deskline_event_themes_pkey PRIMARY KEY (event_id, theme_id);

-- Add FK to parent event with cascade delete (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.deskline_event_themes'::regclass
      AND contype = 'f'
      AND conname = 'deskline_event_themes_event_id_fkey'
  ) THEN
    ALTER TABLE public.deskline_event_themes
      ADD CONSTRAINT deskline_event_themes_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES public.deskline_events(id) ON DELETE CASCADE;
  END IF;
END$$;

-- Helpful index for joins by event_id (PK already covers this leading column, but keep explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_deskline_event_themes_event_id ON public.deskline_event_themes(event_id);
