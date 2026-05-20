-- 1. Create deskline_themes dictionary table
CREATE TABLE public.deskline_themes (
  id text PRIMARY KEY,
  name text NOT NULL,
  "order" integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deskline_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read deskline_themes"
  ON public.deskline_themes
  FOR SELECT
  USING (true);

-- 2. Preserve any existing data from the join table
INSERT INTO public.deskline_themes (id, name, "order")
SELECT DISTINCT ON (theme_id) theme_id, COALESCE(theme_name, theme_id), theme_order
FROM public.deskline_event_themes
WHERE theme_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Drop denormalized columns
ALTER TABLE public.deskline_event_themes
  DROP COLUMN IF EXISTS theme_name,
  DROP COLUMN IF EXISTS theme_order;

-- 4. Add FK from join table to themes dictionary
ALTER TABLE public.deskline_event_themes
  ADD CONSTRAINT deskline_event_themes_theme_id_fkey
  FOREIGN KEY (theme_id) REFERENCES public.deskline_themes(id) ON DELETE CASCADE;

-- 5. Index on theme_id for reverse lookups
CREATE INDEX IF NOT EXISTS idx_deskline_event_themes_theme_id
  ON public.deskline_event_themes(theme_id);