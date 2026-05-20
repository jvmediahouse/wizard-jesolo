CREATE TABLE public.bike_routes (
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

CREATE TABLE public.beach_establishments (
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

CREATE TRIGGER trg_bike_routes_updated
BEFORE UPDATE ON public.bike_routes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_beach_establishments_updated
BEFORE UPDATE ON public.beach_establishments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bike_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beach_establishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read bike_routes"
ON public.bike_routes
FOR SELECT
USING (true);

CREATE POLICY "Public read beach_establishments"
ON public.beach_establishments
FOR SELECT
USING (true);