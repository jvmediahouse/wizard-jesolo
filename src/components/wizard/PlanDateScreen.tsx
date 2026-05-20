import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { it, enUS, de } from 'date-fns/locale';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface PlanDateScreenProps {
  selectedDate: Date | null;
  endDate: Date | null;
  onSelect: (start: Date, end: Date | null) => void;
}

export function PlanDateScreen({ selectedDate, endDate, onSelect }: PlanDateScreenProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'de' ? de : i18n.language === 'en' ? enUS : it;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [range, setRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: selectedDate ?? undefined,
    to: endDate ?? undefined,
  });

  const canContinue = !!range.from;
  const isSingleDaySelection = !!range.from && !range.to;

  const handleClear = () => {
    setRange({ from: undefined, to: undefined });
  };

  const handleContinue = () => {
    if (range.from) {
      onSelect(range.from, range.to ?? null);
    }
  };

  return (
    <div className="space-y-3">
      <ChatBubble>{t('planDate.title')}</ChatBubble>

      {/* Calendar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex justify-center"
      >
        <Calendar
          mode="range"
          selected={range.from ? { from: range.from, to: range.to } : undefined}
          disabled={{ before: today }}
          onSelect={(r) => {
            if (r) setRange({ from: r.from, to: r.to });
          }}
          locale={locale}
          className="rounded-xl border bg-card shadow-sm"
        />
      </motion.div>

      {canContinue && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleClear}
            className="text-sm font-medium text-primary transition-opacity hover:opacity-80"
          >
            {t('planDate.clear')}
          </button>
        </div>
      )}

      {/* Selection summary */}
      {canContinue && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-sm text-muted-foreground"
        >
          {range.from && range.to
              ? `${format(range.from, 'PP', { locale })} → ${format(range.to, 'PP', { locale })}`
              : range.from
                ? format(range.from, 'PPP', { locale })
                : null}
        </motion.p>
      )}

      <Button onClick={handleContinue} disabled={!canContinue} className="w-full">
        {isSingleDaySelection ? t('planDate.continueSingleDay') : t('dataCollection.continue')}
      </Button>
    </div>
  );
}
