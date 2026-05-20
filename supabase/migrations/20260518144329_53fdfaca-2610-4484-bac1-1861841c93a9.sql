UPDATE public.deskline_events
SET web_url = 'https://jesolo.it/eventi/tutti-gli-eventi/#/eventi/TRN/' || id || '/' || url_friendly_name
WHERE url_friendly_name IS NOT NULL;