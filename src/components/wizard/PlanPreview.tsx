import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { MapPin, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VacationPlan } from '@/lib/pdfGenerator';
import { decodeHtmlEntities } from '@/lib/htmlEntities';
import { localizeDesklineEventUrl } from '@/lib/desklineUrl';
import { buildUsefulLinks, usefulLinksTitle } from '@/lib/usefulLinks';
import cicloturismoFallback from '@/assets/cicloturismo-fallback.jpg';

interface PlanPreviewProps {
  plan: VacationPlan;
  animate?: boolean;
  sports?: string[];
  lifestyle?: string[];
  hasPet?: boolean;
  interests?: string[];
}

const previewLocales: Record<string, string> = {
  it: 'it-IT',
  en: 'en-US',
  de: 'de-DE',
};

function capitalizeFirst(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function isAllDayTime(value?: string): boolean {
  if (!value) return false;
  return /^00:?00(:00)?$/.test(value.trim());
}

function formatDisplayDate(value: string, language: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;

  const [, year, month, day] = match;
  const locale = previewLocales[language] ?? previewLocales.en;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const parts = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(date);

  return parts
    .map((part) => {
      if (part.type === 'literal') return part.value;
      const cleaned = part.value.replace(/\./g, '');
      return part.type === 'weekday' || part.type === 'month' ? capitalizeFirst(cleaned) : cleaned;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitTitleDescription(text: string): { title: string; description: string } {
  if (!text) return { title: '', description: '' };
  const trimmed = decodeHtmlEntities(text).trim();
  const match = trimmed.match(/^(.+?)\s*[—:.\-–]\s+(.+)$/s);
  if (match && match[1].length <= 60) {
    return { title: match[1].trim(), description: match[2].trim() };
  }
  const firstDot = trimmed.indexOf('.');
  if (firstDot > 0 && firstDot <= 60) {
    return { title: trimmed.slice(0, firstDot).trim(), description: trimmed.slice(firstDot + 1).trim() };
  }
  return { title: trimmed, description: '' };
}

export function PlanPreview({ plan, animate = true, sports, lifestyle, hasPet, interests }: PlanPreviewProps) {
  const { t, i18n } = useTranslation();
  const totalDays = plan.days?.length ?? 0;
  const lang = i18n.language.split('-')[0].toLowerCase();
  const usefulLinks = buildUsefulLinks({ sports, lifestyle, interests, hasPet }, lang);
  const hasAnyLink = usefulLinks.length > 0;

  const M = animate ? motion.div : ('div' as never);

  return (
    <div className="space-y-4">
      {plan.days?.map((day, i) => {
        const isFirst = i === 0;
        const isLast = i === totalDays - 1 && totalDays > 1;
        const badgeLabel = isFirst ? t('results.arrival') : isLast ? t('results.departure') : null;
        const isFullDay = day.slots?.length === 1 && day.slots[0].time_of_day === 'full-day';
        const displayDate = formatDisplayDate(day.date, i18n.language);

        const animProps = animate
          ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.05 + i * 0.05 } }
          : {};

        return (
          <M key={i} {...(animProps as object)}>
            <Card className="border-border overflow-hidden">
              <div className="flex items-center justify-between bg-muted/50 px-4 py-2.5 border-b border-border">
                <p className="text-sm font-semibold text-foreground">
                  {displayDate}
                  {day.title ? <span className="text-muted-foreground font-normal"> — {decodeHtmlEntities(day.title)}</span> : null}
                </p>
                {badgeLabel && <Badge variant="secondary" className="text-xs">{badgeLabel}</Badge>}
              </div>

              {/* Slots */}
              <div className={`grid grid-cols-1 ${isFullDay ? '' : 'md:grid-cols-' + (day.slots?.length ?? 1)} md:divide-x divide-border`}>
                {(day.slots ?? []).map((slot) => {
                  const { title, description } = splitTitleDescription(slot.content);
                  return (
                    <div key={slot.time_of_day} className="p-4 flex flex-col gap-1.5 border-b md:border-b-0 border-border last:border-b-0">
                      {title && <p className="text-sm font-normal text-foreground leading-relaxed">{title}</p>}
                      {description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {day.events && day.events.length > 0 && (
                <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('results.recommendedEvents')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {day.events.map((event, idx) => (
                      (() => {
                        const href = localizeDesklineEventUrl(event.url, lang);
                        const isKomoot = /komoot\./i.test(event.url ?? '');
                        const imageSrc = event.image || (isKomoot ? cicloturismoFallback : null);
                        return (
                      <a
                        key={idx}
                        href={href || undefined}
                        target={href ? '_blank' : undefined}
                        rel={href ? 'noopener noreferrer' : undefined}
                        className={`group rounded-lg border border-border bg-card overflow-hidden flex flex-col ${href ? 'hover:shadow-md hover:border-primary/50 transition-all' : ''}`}
                      >
                        {imageSrc && (
                          <AspectRatio ratio={16 / 9} className="bg-muted">
                            <img
                              src={imageSrc}
                              alt={decodeHtmlEntities(event.title)}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          </AspectRatio>
                        )}
                        <div className="p-3 flex flex-col gap-1">
                          <p className={`text-sm font-medium leading-snug ${href ? 'text-primary group-hover:underline' : 'text-foreground'}`}>
                            {decodeHtmlEntities(event.title)}
                          </p>
                          {(event.time || event.location) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {event.time && (
                                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{isAllDayTime(event.time) ? t('results.allDay') : event.time}</span>
                              )}
                              {event.location && (
                                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{decodeHtmlEntities(event.location)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </a>
                        );
                      })()
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </M>
        );
      })}      
      {hasAnyLink && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">
          {usefulLinksTitle(lang)}
        </p>
      )}
      {usefulLinks.map((link) => (
        <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer" className="block mt-2">
          <Button variant="outline" className="w-full gap-2 border-primary/40 hover:bg-primary/5">
            <ExternalLink className="h-4 w-4" />
            {link.label}
          </Button>
        </a>
      ))}
    </div>
  );
}