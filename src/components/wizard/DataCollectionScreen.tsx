import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatBubble } from './ChatBubble';
import { OptionButton } from './OptionButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import type { WizardStep } from '@/hooks/useWizard';
import beachEquippedImage from '@/assets/beach-equipped.jpg';
import beachFreeImage from '@/assets/beach-free.jpg';

interface DataCollectionScreenProps {
  step: WizardStep;
  onTextInput: (field: string, value: string) => void;
  onOptionSelect: (field: string, value: string) => void;
  onMultiSelect: (field: string, values: string[]) => void;
  onNext: () => void;
}

export function DataCollectionScreen({ step, onTextInput, onOptionSelect, onMultiSelect, onNext }: DataCollectionScreenProps) {
  const { t } = useTranslation();
  const [textValue, setTextValue] = useState('');
  const [multiValues, setMultiValues] = useState<string[]>([]);

  const handleTextSubmit = (field: string) => {
    if (textValue.trim()) {
      onTextInput(field, textValue.trim());
      setTextValue('');
    }
  };

  const toggleMulti = (val: string) => {
    setMultiValues(prev =>
      prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]
    );
  };

  const handleMultiSubmit = (field: string) => {
    if (multiValues.length > 0) {
      onMultiSelect(field, multiValues);
      setMultiValues([]);
    }
  };

  if (step === 'data-name') {
    return (
      <div className="space-y-3">
        <ChatBubble>{t('dataCollection.nameQ')}</ChatBubble>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-2">
          <Input
            placeholder={t('dataCollection.namePlaceholder')}
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && textValue.trim()) {
                onTextInput('name', textValue.trim());
                setTextValue('');
                onNext();
              }
            }}
          />
          <Button
            onClick={() => {
              if (!textValue.trim()) return;
              onTextInput('name', textValue.trim());
              setTextValue('');
              onNext();
            }}
            disabled={!textValue.trim()}
            className="w-full"
          >
            {t('dataCollection.next')}
          </Button>
        </motion.div>
      </div>
    );
  }

  if (step === 'data-city') {
    return <CityStep onSubmit={(province, country) => {
      onTextInput('province', province);
      onTextInput('country', country);
      onNext();
    }} />;
  }

  if (step === 'data-age') {
    const ranges = ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'];
    return (
      <div className="space-y-3">
        <ChatBubble>{t('dataCollection.ageQ')}</ChatBubble>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {ranges.map((r, i) => (
            <OptionButton key={r} label={r} onClick={() => onOptionSelect('ageRange', r)} delay={0.1 + i * 0.05} />
          ))}
        </div>
      </div>
    );
  }

  if (step === 'data-beach') {
    const beachOptions = [
      {
        key: 'equipped',
        label: t('dataCollection.beachEquipped'),
        alt: t('dataCollection.beachEquippedAlt'),
        image: beachEquippedImage,
      },
      {
        key: 'free',
        label: t('dataCollection.beachFree'),
        alt: t('dataCollection.beachFreeAlt'),
        image: beachFreeImage,
      },
    ];

    return (
      <div className="space-y-3">
        <ChatBubble>{t('dataCollection.beachQ')}</ChatBubble>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {beachOptions.map((option, index) => (
            <motion.button
              key={option.key}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              onClick={() => onOptionSelect('beachPreference', option.key)}
              className="overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
                <img src={option.image} alt={option.alt} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="px-4 py-3 text-sm font-medium text-foreground">
                {option.label}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'data-sports') {
    const sports = [
      { key: 'cycling', label: t('dataCollection.sportCycling') },
      { key: 'outdoor', label: t('dataCollection.sportOutdoor') },
      { key: 'water', label: t('dataCollection.sportWater') },
      { key: 'golf', label: t('dataCollection.sportGolf') },
      { key: 'fitness', label: t('dataCollection.sportFitness') },
      { key: 'karting', label: t('dataCollection.sportKarting') },
    ];
    return (
      <div className="space-y-3">
        <ChatBubble>{t('dataCollection.sportsQ')}</ChatBubble>
        <div className="space-y-2 mt-2">
          {sports.map((s, i) => (
            <motion.div key={s.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <Button
                variant={multiValues.includes(s.key) ? 'default' : 'outline'}
                onClick={() => toggleMulti(s.key)}
                className="w-full justify-start"
              >
                {s.label}
              </Button>
            </motion.div>
          ))}
        </div>
        {multiValues.length > 0 && (
          <Button onClick={() => handleMultiSubmit('sports')} className="w-full mt-2">{t('dataCollection.continue')}</Button>
        )}
      </div>
    );
  }

  if (step === 'data-event-type') {
    const eventTypes = [
      { key: 'folklore', label: t('dataCollection.eventFolklore') },
      { key: 'concerts', label: t('dataCollection.eventConcerts') },
      { key: 'sport', label: t('dataCollection.eventSport') },
      { key: 'culture', label: t('dataCollection.eventCulture') },
    ];
    return (
      <div className="space-y-3">
        <ChatBubble>{t('dataCollection.eventTypeQ')}</ChatBubble>
        <div className="space-y-2 mt-2">
          {eventTypes.map((e, i) => (
            <motion.div key={e.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <Button
                variant={multiValues.includes(e.key) ? 'default' : 'outline'}
                onClick={() => toggleMulti(e.key)}
                className="w-full justify-start"
              >
                {e.label}
              </Button>
            </motion.div>
          ))}
        </div>
        {multiValues.length > 0 && (
          <Button onClick={() => handleMultiSubmit('eventTypes')} className="w-full mt-2">{t('dataCollection.continue')}</Button>
        )}
      </div>
    );
  }

  if (step === 'data-lifestyle') {
    const lifestyleOpts = [
      { key: 'food', label: t('dataCollection.lifestyleFood') },
      { key: 'shopping', label: t('dataCollection.lifestyleShopping') },
      { key: 'wellness', label: t('dataCollection.lifestyleWellness') },
    ];
    return (
      <div className="space-y-3">
        <ChatBubble>{t('dataCollection.lifestyleQ')}</ChatBubble>
        <div className="space-y-2 mt-2">
          {lifestyleOpts.map((e, i) => (
            <motion.div key={e.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <Button
                variant={multiValues.includes(e.key) ? 'default' : 'outline'}
                onClick={() => toggleMulti(e.key)}
                className="w-full justify-start"
              >
                {e.label}
              </Button>
            </motion.div>
          ))}
        </div>
        {multiValues.length > 0 && (
          <Button onClick={() => handleMultiSubmit('lifestyle')} className="w-full mt-2">{t('dataCollection.continue')}</Button>
        )}
      </div>
    );
  }

  return null;
}

function CityStep({ onSubmit }: { onSubmit: (province: string, country: string) => void }) {
  const { t } = useTranslation();
  const [province, setProvince] = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        if (data.country_name) setCountry(data.country_name);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <ChatBubble>{t('dataCollection.cityQ')}</ChatBubble>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-2">
        <Input placeholder={t('dataCollection.provincePlaceholder')} value={province} onChange={e => setProvince(e.target.value)} disabled={loading} />
        <Input placeholder={t('dataCollection.countryPlaceholder')} value={country} onChange={e => setCountry(e.target.value)} disabled={loading} />
        <Button onClick={() => onSubmit(province, country)} disabled={!country.trim() || loading} className="w-full">{t('dataCollection.next')}</Button>
      </motion.div>
    </div>
  );
}
