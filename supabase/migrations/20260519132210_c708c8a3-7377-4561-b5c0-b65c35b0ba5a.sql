
ALTER TABLE public.deskline_events
  ADD COLUMN IF NOT EXISTS name_i18n jsonb,
  ADD COLUMN IF NOT EXISTS description_full_i18n jsonb,
  ADD COLUMN IF NOT EXISTS description_short_i18n jsonb,
  ADD COLUMN IF NOT EXISTS url_friendly_name_i18n jsonb,
  ADD COLUMN IF NOT EXISTS place_i18n jsonb,
  ADD COLUMN IF NOT EXISTS town_i18n jsonb;

ALTER TABLE public.deskline_themes
  ADD COLUMN IF NOT EXISTS name_i18n jsonb;
