import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { JesoloEvent } from '@/data/mockData';
import { format, isAfter, isSameDay, parseISO } from 'date-fns';
import { it, enUS, de } from 'date-fns/locale';
import { CalendarIcon, MapPin, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { buildDesklineEventUrl, localizeJesoloUrl } from '@/lib/desklineUrl';
import { decodeHtmlEntities } from '@/lib/htmlEntities';

interface EventsScreenProps {
  step: 'events-date' | 'events-results';
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  onContinue: () => void;
}

export function EventsScreen({ step, selectedDate, onSelectDate, onContinue }: EventsScreenProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? de : i18n.language === 'en' ? enUS : it;
  const [events, setEvents] = useState<JesoloEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step !== 'events-results') return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const today = new Date();
        const todayISO = today.toISOString();
        const todayDateOnly = today.toISOString().slice(0, 10);
        // Window: today → +180 days, enough to populate the listing
        const windowEnd = new Date(today.getTime() + 1000 * 60 * 60 * 24 * 180);
        const windowEndDateOnly = windowEnd.toISOString().slice(0, 10);

        const [{ data: tribe }, { data: desklineBase }, { data: occurrences }] = await Promise.all([
          supabase.from('events')
            .select('id,title,description,start_date,url,image_url,venues(name,city)')
            .gte('start_date', todayISO)
            .order('start_date', { ascending: true })
            .limit(60),
          supabase.from('deskline_events')
            .select('id,name,name_i18n,description_short,description_short_i18n,date,place,place_i18n,town,town_i18n,url_friendly_name,url_friendly_name_i18n,image_url')
            .gte('date', todayISO)
            .order('date', { ascending: true })
            .limit(60),
          supabase.from('deskline_event_occurrences')
            .select('event_id,occurrence_date,start_time,deskline_events(id,name,name_i18n,description_short,description_short_i18n,place,place_i18n,town,town_i18n,url_friendly_name,url_friendly_name_i18n,image_url)')
            .gte('occurrence_date', todayDateOnly)
            .lte('occurrence_date', windowEndDateOnly)
            .order('occurrence_date', { ascending: true })
            .limit(200),
        ]);

        const occEventIds = new Set((occurrences ?? []).map((o: any) => o.event_id));

        const lang = i18n.language;
        const langKey = (lang || 'it').split('-')[0].toLowerCase();
        const pickI18n = (i18nObj: any, fallback: any): any => {
          if (i18nObj && typeof i18nObj === 'object') {
            return i18nObj[langKey] ?? i18nObj.it ?? i18nObj.en ?? i18nObj.de ?? fallback;
          }
          return fallback;
        };
        const norm = (s?: string | null) =>
          decodeHtmlEntities(String(s ?? '')).toLowerCase().replace(/\s+/g, ' ').trim();

        const tribeItems: JesoloEvent[] = (tribe ?? []).map((e: any) => ({
          id: `t-${e.id}`,
          title: decodeHtmlEntities(e.title ?? ''),
            date: e.start_date,
          description: decodeHtmlEntities((e.description ?? '').slice(0, 220)),
            location: [e.venues?.name, e.venues?.city].filter(Boolean).join(', ') || 'Jesolo',
            image: e.image_url ?? undefined,
            url: localizeJesoloUrl(e.url, lang),
        }));

        // Dedup key: normalized title + day (YYYY-MM-DD) — prefer items from `events`
        const dayKey = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : '');
        const tribeKeys = new Set(
          tribeItems.filter(e => e.date).map(e => `${norm(e.title)}|${dayKey(e.date)}`),
        );

        const occItems: JesoloEvent[] = (occurrences ?? [])
          .map((o: any) => {
            const de = o.deskline_events;
            const title = decodeHtmlEntities(pickI18n(de?.name_i18n, de?.name) ?? '');
            const place = pickI18n(de?.place_i18n, de?.place);
            const town = pickI18n(de?.town_i18n, de?.town);
            const urlFriendly = pickI18n(de?.url_friendly_name_i18n, de?.url_friendly_name);
            const shortDesc = pickI18n(de?.description_short_i18n, de?.description_short);
            return {
              id: `do-${o.event_id}-${o.occurrence_date}-${o.start_time ?? ''}`,
              title,
              date: o.occurrence_date,
              description: decodeHtmlEntities((shortDesc ?? '').slice(0, 220)),
              location: [place, town].filter(Boolean).join(', ') || 'Jesolo',
              image: de?.image_url ?? undefined,
              url: buildDesklineEventUrl(de?.id, urlFriendly, lang),
            };
          })
          .filter((e: JesoloEvent) => e.title && !tribeKeys.has(`${norm(e.title)}|${dayKey(e.date)}`));

        const baseItems: JesoloEvent[] = (desklineBase ?? [])
          .filter((e: any) => !occEventIds.has(e.id))
          .map((e: any) => {
            const title = decodeHtmlEntities(pickI18n(e.name_i18n, e.name) ?? '');
            const place = pickI18n(e.place_i18n, e.place);
            const town = pickI18n(e.town_i18n, e.town);
            const urlFriendly = pickI18n(e.url_friendly_name_i18n, e.url_friendly_name);
            const shortDesc = pickI18n(e.description_short_i18n, e.description_short);
            return {
              id: `d-${e.id}`,
              title,
              date: e.date,
              description: decodeHtmlEntities((shortDesc ?? '').slice(0, 220)),
              location: [place, town].filter(Boolean).join(', ') || 'Jesolo',
              image: e.image_url ?? undefined,
              url: buildDesklineEventUrl(e.id, urlFriendly, lang),
            };
          })
          .filter((e: JesoloEvent) => !tribeKeys.has(`${norm(e.title)}|${dayKey(e.date)}`));

        const merged: JesoloEvent[] = [...tribeItems, ...occItems, ...baseItems]
          .filter(e => e.date)
          .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

        if (!cancel) setEvents(merged);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [step, i18n.language]);

  if (step === 'events-date') {
    return (
      <div className="space-y-3">
        <ChatBubble>{t('events.title')}</ChatBubble>
        <ChatBubble delay={0.1}>
          <p className="text-xs text-muted-foreground mb-2">{t('events.subtitle')}</p>
        </ChatBubble>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <Calendar
            mode="single"
            selected={selectedDate ?? undefined}
            onSelect={(d) => d && onSelectDate(d)}
            locale={locale}
            className="rounded-xl border bg-card shadow-sm pointer-events-auto"
          />
        </motion.div>
      </div>
    );
  }

  const matchingEvents = selectedDate
    ? events.filter(e => isSameDay(parseISO(e.date), selectedDate))
    : [];

  const displayEvents = matchingEvents.length > 0
    ? matchingEvents
    : events
        .filter(e => isAfter(parseISO(e.date), selectedDate ?? new Date()))
        .slice(0, 5);

  const message = matchingEvents.length > 0 ? t('events.matchingEvents') : t('events.noEvents');

  return (
    <div className="space-y-3">
      <ChatBubble>{message}</ChatBubble>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> ...
        </div>
      )}
      <div className="space-y-3">
        {displayEvents.map((event, i) => (
          <EventCard key={event.id} event={event} delay={0.1 + i * 0.08} locale={locale} learnMoreLabel={t('events.learnMore')} />
        ))}
      </div>
    </div>
  );
}

function EventCard({ event, delay, locale, learnMoreLabel }: { event: JesoloEvent; delay: number; locale: any; learnMoreLabel: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="overflow-hidden border-border hover:shadow-md transition-shadow">
        {event.image && (
          <a
            href={event.url || undefined}
            target={event.url ? '_blank' : undefined}
            rel={event.url ? 'noopener noreferrer' : undefined}
            className="block"
          >
            <AspectRatio ratio={16 / 9} className="bg-muted">
              <img
                src={event.image}
                alt={event.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </AspectRatio>
          </a>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CalendarIcon className="h-3 w-3" />
            {format(parseISO(event.date), 'PPP', { locale })}
          </div>
          <CardTitle className="text-base">
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline hover:text-primary transition-colors"
              >
                {event.title}
              </a>
            ) : (
              event.title
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {event.description && <p className="text-sm text-muted-foreground mb-2">{event.description}</p>}
          <div className="flex items-center gap-1 text-xs text-primary">
            <MapPin className="h-3 w-3" />
            {event.location}
          </div>
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:underline"
            >
              {learnMoreLabel} ↗
            </a>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
