import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowRight, Sparkles } from 'lucide-react';
import { WizardPath } from '@/hooks/useWizard';
import heroImage from '@/assets/homepage-jesolo.jpg';

interface WelcomeScreenProps {
  onSelectPath: (path: WizardPath) => void;
  onInfoClick: () => void;
}

const compactCards: { path: 'events' | 'info'; icon: string; labelKey: string }[] = [
  { path: 'events', icon: '🎉', labelKey: 'welcome.events' },
  { path: 'info', icon: '💬', labelKey: 'welcome.info' },
];

export function WelcomeScreen({ onSelectPath, onInfoClick }: WelcomeScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-0 -mt-6">
      {/* Hero Image */}
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="relative rounded-2xl overflow-hidden -mx-4"
      >
        <img
          src={heroImage}
          alt="Jesolo aerial view at dusk"
          className="w-full h-48 sm:h-56 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </motion.div>

      {/* Branded Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="text-center pt-3 pb-2"
      >
        <h1 className="text-3xl font-bold text-primary">{t('welcome.greeting')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('welcome.subtitle')}</p>
      </motion.div>

      {/* Featured: Plan visit */}
      <div className="space-y-3 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.45 }}
          className="relative rounded-2xl border border-primary/30 bg-card p-4 shadow-sm"
        >
          <span className="absolute top-3 right-3 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            {t('welcome.recommended', 'Inizia da qui')}
          </span>
          <div className="flex items-start gap-3 pr-24">
            <Sparkles className="text-accent shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-foreground">{t('welcome.plan')}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t('welcome.planDesc')}</div>
            </div>
          </div>
          <button
            onClick={() => onSelectPath('plan')}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md"
          >
            {t('welcome.startNow', 'Inizia ora')}
            <ArrowRight className="size-4" />
          </button>
        </motion.div>

        {/* Compact cards */}
        {compactCards.map(({ path, icon, labelKey }, i) => (
          <motion.button
            key={path}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.55 + i * 0.08 }}
            onClick={() => {
              if (path === 'info') onInfoClick();
              else onSelectPath(path);
            }}
            className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40"
          >
            <span className="text-lg leading-none">{icon}</span>
            <span className="flex-1 font-medium text-sm text-foreground">{t(labelKey)}</span>
            <ArrowUpRight className="size-4 text-muted-foreground" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}
