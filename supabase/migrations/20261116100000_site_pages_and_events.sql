-- Content pages and events read from jesolo.it (pushed by the WordPress
-- plugin "Jesolo Wizard Sync") and natale.jesolo.it (read by
-- sync-jesolo-data). Used by the wizard and by generate-vacation-plan.

-- 1. Pages ------------------------------------------------------------------
CREATE TABLE public.site_pages (
  id TEXT PRIMARY KEY,                 -- "<site>:<lang>:<external id or path>"
  site TEXT NOT NULL,                  -- "jesolo.it" | "natale.jesolo.it"
  lang TEXT NOT NULL DEFAULT 'it',
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,                        -- plain text, no HTML
  external_id TEXT,
  source_modified_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('simple'::regconfig, coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, left(coalesce(content, ''), 200000)), 'B')
  ) STORED
);

CREATE INDEX idx_site_pages_search ON public.site_pages USING GIN (search);
CREATE INDEX idx_site_pages_site_lang ON public.site_pages (site, lang);

CREATE TRIGGER trg_site_pages_updated BEFORE UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_pages" ON public.site_pages FOR SELECT USING (true);

-- 2. Events listed on content sites (e.g. natale.jesolo.it/eventi) ----------
CREATE TABLE public.site_events (
  id TEXT PRIMARY KEY,                 -- stable hash of site + date + time + title
  site TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TEXT,                     -- "HH:MM" when published
  title TEXT NOT NULL,                 -- Italian title
  title_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  category_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  place_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  description_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  url TEXT,
  url_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_site_events_date ON public.site_events (event_date);

CREATE TRIGGER trg_site_events_updated BEFORE UPDATE ON public.site_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.site_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_events" ON public.site_events FOR SELECT USING (true);

-- 3. Relevance search used by generate-vacation-plan -------------------------
-- Matches any of the given terms (prefix match). Returns pages in p_lang for
-- sites that have that language, Italian pages for sites that do not.
CREATE OR REPLACE FUNCTION public.search_site_pages(
  p_terms TEXT[],
  p_lang TEXT DEFAULT 'it',
  p_limit INT DEFAULT 6
)
RETURNS TABLE (site TEXT, lang TEXT, url TEXT, title TEXT, content TEXT, rank REAL)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT to_tsquery('simple', string_agg(t || ':*', ' | ')) AS query
    FROM (
      SELECT DISTINCT regexp_replace(lower(term), '[^[:alnum:]]', '', 'g') AS t
      FROM unnest(p_terms) AS term
    ) cleaned
    WHERE length(t) >= 3
  ),
  sites_in_lang AS (
    SELECT DISTINCT sp.site FROM public.site_pages sp WHERE sp.lang = p_lang
  )
  SELECT sp.site, sp.lang, sp.url, sp.title, sp.content,
         ts_rank(sp.search, q.query) AS rank
  FROM public.site_pages sp, q
  WHERE q.query IS NOT NULL
    AND sp.search @@ q.query
    AND (
      sp.lang = p_lang
      OR (sp.lang = 'it' AND sp.site NOT IN (SELECT site FROM sites_in_lang))
    )
  ORDER BY rank DESC
  LIMIT greatest(1, least(p_limit, 20));
$$;

-- 4. Run the sync every 3 days instead of daily (job name kept for continuity).
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'sync-jesolo-data-daily'),
  schedule := '0 4 */3 * *'
);
