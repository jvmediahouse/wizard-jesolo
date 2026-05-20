-- Create table for expanded Deskline event occurrences (recurring events)
CREATE TABLE public.deskline_event_occurrences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL REFERENCES public.deskline_events(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  start_time text,
  duration integer,
  day_of_week integer,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, occurrence_date, start_time)
);

CREATE INDEX idx_deskline_event_occurrences_event_id ON public.deskline_event_occurrences(event_id);
CREATE INDEX idx_deskline_event_occurrences_date ON public.deskline_event_occurrences(occurrence_date);

ALTER TABLE public.deskline_event_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read deskline_event_occurrences"
ON public.deskline_event_occurrences
FOR SELECT
USING (true);
