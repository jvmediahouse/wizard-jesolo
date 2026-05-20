import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface PlanInterestsScreenProps {
  travelGroup: string;
  onSelect: (interests: string[]) => void;
}

export function PlanInterestsScreen({ travelGroup, onSelect }: PlanInterestsScreenProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string[]>([]);

  const isFamily = travelGroup === 'family' || travelGroup === 'familyKids';
  const iconMap: Record<string, string> = {
    sport: 'https://jesolo.it/wp-content/uploads/2024/04/Sport-1.svg',
    relax: 'https://jesolo.it/wp-content/uploads/2024/04/Beach-2.svg',
    culture: 'https://jesolo.it/wp-content/uploads/2024/04/Culture-1.svg',
    nightlife: 'https://jesolo.it/wp-content/uploads/2024/04/Fun-1.svg',
    bleisure: 'https://jesolo.it/wp-content/uploads/2024/04/Experience-1.svg',
    lifestyle: 'https://jesolo.it/wp-content/uploads/2024/04/Lifestyle-1.svg',
    trips: 'https://jesolo.it/wp-content/uploads/2024/04/Food-1.svg',
  };

  const baseOptions = [
    { key: 'sport', label: t('planInterests.sport'), iconUrl: iconMap.sport },
    { key: 'relax', label: t('planInterests.relax'), iconUrl: iconMap.relax },
    { key: 'culture', label: t('planInterests.culture'), iconUrl: iconMap.culture },
    { key: 'nightlife', label: isFamily ? t('planInterests.funOnly') : t('planInterests.nightlife'), iconUrl: iconMap.nightlife },
    { key: 'lifestyle', label: t('planInterests.lifestyle'), iconUrl: iconMap.lifestyle },
    { key: 'trips', label: t('planInterests.trips'), iconUrl: iconMap.trips },
  ];

  if (travelGroup === 'solo') {
    baseOptions.push({ key: 'bleisure', label: t('planInterests.bleisure'), iconUrl: iconMap.bleisure });
  }

  const toggle = (key: string) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  return (
    <div className="space-y-3">
      <ChatBubble>{t('planInterests.title')}</ChatBubble>
      <p className="px-1 text-sm text-muted-foreground">
        {t('planInterests.subtitle')}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {baseOptions.map((o, i) => (
          <motion.div key={o.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.04 }}>
            <Button
              type="button"
              variant="outline"
              aria-pressed={selected.includes(o.key)}
              onClick={() => toggle(o.key)}
              className={[
                'h-full min-h-36 w-full flex-col gap-3 rounded-xl border bg-card px-4 py-5 text-center shadow-sm transition-all duration-200',
                'hover:border-ocean/40 hover:bg-ocean-light hover:shadow-md',
                selected.includes(o.key)
                  ? 'border-primary bg-ocean-light text-foreground ring-2 ring-primary/20'
                  : 'border-border text-card-foreground',
              ].join(' ')}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sand-light p-3">
                <img
                  src={o.iconUrl}
                  alt={o.label}
                  loading="lazy"
                  className="h-10 w-10 object-contain"
                />
              </span>
              <span className="text-sm font-semibold leading-tight text-inherit sm:text-base">{o.label}</span>
            </Button>
          </motion.div>
        ))}
      </div>
      {selected.length > 0 && (
        <Button onClick={() => onSelect(selected)} className="w-full mt-2">
          {t('dataCollection.continue')}
        </Button>
      )}
    </div>
  );
}
