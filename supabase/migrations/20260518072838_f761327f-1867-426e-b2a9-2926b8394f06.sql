
CREATE TABLE public.bike_tours (
  id text PRIMARY KEY,
  parent_page_id bigint REFERENCES public.bike_routes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  komoot_url text NOT NULL,
  distance_km numeric,
  duration_min integer,
  elevation_m integer,
  image_url text,
  category text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bike_tours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read bike_tours"
ON public.bike_tours
FOR SELECT
USING (true);

CREATE TRIGGER update_bike_tours_updated_at
BEFORE UPDATE ON public.bike_tours
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_bike_tours_parent ON public.bike_tours(parent_page_id);
CREATE INDEX idx_bike_tours_category ON public.bike_tours(category);
