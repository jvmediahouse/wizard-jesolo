
-- VENUES
CREATE TABLE public.venues (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  country TEXT,
  zip TEXT,
  phone TEXT,
  website TEXT,
  url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CATEGORIES
CREATE TABLE public.categories (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EVENTS (Tribe)
CREATE TABLE public.events (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  excerpt TEXT,
  slug TEXT,
  url TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  cost TEXT,
  featured BOOLEAN DEFAULT false,
  venue_id BIGINT REFERENCES public.venues(id) ON DELETE SET NULL,
  kid_friendly BOOLEAN DEFAULT false,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_start_date ON public.events(start_date);

CREATE TABLE public.event_categories (
  event_id BIGINT NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, category_id)
);

-- DESKLINE EVENTS
CREATE TABLE public.deskline_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  date TIMESTAMPTZ,
  has_more_dates BOOLEAN DEFAULT false,
  place TEXT,
  town TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  description_full TEXT,
  description_short TEXT,
  url_friendly_name TEXT,
  web_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deskline_events_date ON public.deskline_events(date);

CREATE TABLE public.deskline_event_themes (
  event_id TEXT NOT NULL REFERENCES public.deskline_events(id) ON DELETE CASCADE,
  theme_id BIGINT NOT NULL,
  theme_name TEXT,
  PRIMARY KEY (event_id, theme_id)
);

-- SPORTS FACILITIES
CREATE TABLE public.sports_facility_categories (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sports_facilities (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  excerpt TEXT,
  slug TEXT,
  link TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sports_facility_to_category (
  facility_id BIGINT NOT NULL REFERENCES public.sports_facilities(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES public.sports_facility_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (facility_id, category_id)
);

-- ACTIVITIES
CREATE TABLE public.activity_categories (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.activities (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  excerpt TEXT,
  slug TEXT,
  link TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_to_category (
  activity_id BIGINT NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  category_id BIGINT NOT NULL REFERENCES public.activity_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, category_id)
);

-- SYNC LOG
CREATE TABLE public.sync_log (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  records_synced INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_venues_updated BEFORE UPDATE ON public.venues FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_deskline_events_updated BEFORE UPDATE ON public.deskline_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sports_facilities_updated BEFORE UPDATE ON public.sports_facilities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_activities_updated BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deskline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deskline_event_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_facility_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_facility_to_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_to_category ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- Public read policies for tourism content
CREATE POLICY "Public read venues" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Public read event_categories" ON public.event_categories FOR SELECT USING (true);
CREATE POLICY "Public read deskline_events" ON public.deskline_events FOR SELECT USING (true);
CREATE POLICY "Public read deskline_event_themes" ON public.deskline_event_themes FOR SELECT USING (true);
CREATE POLICY "Public read sports_facility_categories" ON public.sports_facility_categories FOR SELECT USING (true);
CREATE POLICY "Public read sports_facilities" ON public.sports_facilities FOR SELECT USING (true);
CREATE POLICY "Public read sports_facility_to_category" ON public.sports_facility_to_category FOR SELECT USING (true);
CREATE POLICY "Public read activity_categories" ON public.activity_categories FOR SELECT USING (true);
CREATE POLICY "Public read activities" ON public.activities FOR SELECT USING (true);
CREATE POLICY "Public read activity_to_category" ON public.activity_to_category FOR SELECT USING (true);
-- sync_log: no public policy = no access for anon/authenticated; only service-role bypasses RLS
