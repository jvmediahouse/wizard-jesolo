import '@/i18n';
import { useTranslation } from 'react-i18next';
import { useWizard } from '@/hooks/useWizard';
import { WizardHeader } from '@/components/wizard/WizardHeader';
import { WelcomeScreen } from '@/components/wizard/WelcomeScreen';
import { EventsScreen } from '@/components/wizard/EventsScreen';
import { PlanDateScreen } from '@/components/wizard/PlanDateScreen';
import { PlanGroupScreen } from '@/components/wizard/PlanGroupScreen';
import { PlanPetScreen } from '@/components/wizard/PlanPetScreen';
import { PlanInterestsScreen } from '@/components/wizard/PlanInterestsScreen';
import { DataCollectionScreen } from '@/components/wizard/DataCollectionScreen';
import { LeadCaptureScreen } from '@/components/wizard/LeadCaptureScreen';
import { ResultsScreen } from '@/components/wizard/ResultsScreen';
import { AnimatePresence, motion } from 'framer-motion';
import type { WizardStep } from '@/hooks/useWizard';
import { useEmbedMode } from '@/hooks/useEmbedMode';

const INFO_POINT_URLS: Record<string, string> = {
  it: 'https://jesolo.it/info-point/',
  en: 'https://jesolo.it/en/info-point/',
  de: 'https://jesolo.it/de/info-point/',
};

const Index = () => {
  const { step, userData, progress, canGoBack, goTo, goBack, updateData } = useWizard();
  const { i18n } = useTranslation();
  const { mode, isEmbedded } = useEmbedMode();
  const isWidgetEmbed = mode === 'widget';
  const infoPointUrl = INFO_POINT_URLS[i18n.language] ?? INFO_POINT_URLS.en;
  const backgroundIframeMessageType = 'wizart:navigate-background-iframe';

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <WelcomeScreen
            onSelectPath={(path) => {
              updateData({ path });
              if (path === 'events') goTo('events-date');
              else if (path === 'plan') goTo('plan-date');
            }}
            onInfoClick={() => {
              if (isEmbedded) {
                if (window.parent !== window) {
                  window.parent.postMessage(
                    {
                      type: backgroundIframeMessageType,
                      url: infoPointUrl,
                    },
                    '*'
                  );
                }
                return;
              }

              window.open(infoPointUrl, '_blank', 'noopener,noreferrer');
            }}
          />
        );

      case 'events-date':
      case 'events-results':
        return (
          <EventsScreen
            step={step}
            selectedDate={userData.selectedDate}
            onSelectDate={(date) => {
              updateData({ selectedDate: date });
              goTo('events-results');
            }}
            onContinue={() => goTo('plan-date')}
          />
        );

      case 'plan-date':
        return (
          <PlanDateScreen
            selectedDate={userData.selectedDate}
            endDate={userData.endDate}
            onSelect={(start, end) => {
              updateData({ selectedDate: start, endDate: end });
              goTo('plan-group');
            }}
          />
        );

      case 'plan-group':
        return (
          <PlanGroupScreen
            onSelect={(group) => {
              updateData({ travelGroup: group });
              goTo('plan-pet');
            }}
          />
        );

      case 'plan-pet':
        return (
          <PlanPetScreen
            onSelect={(hasPet) => {
              updateData({ hasPet });
              goTo('plan-interests');
            }}
          />
        );

      case 'plan-interests': {
        const getFirstDataStep = (interests: string[]): WizardStep => {
          if (interests.includes('relax')) return 'data-beach';
          if (interests.includes('sport')) return 'data-sports';
          if (interests.includes('culture')) return 'data-event-type';
          if (interests.includes('lifestyle')) return 'data-lifestyle';
          return 'data-age';
        };
        return (
          <PlanInterestsScreen
            travelGroup={userData.travelGroup}
            onSelect={(interests) => {
              updateData({ interests });
              goTo(getFirstDataStep(interests));
            }}
          />
        );
      }

      case 'data-beach':
      case 'data-sports':
      case 'data-event-type':
      case 'data-lifestyle':
      case 'data-age':
      case 'data-name':
      case 'data-city':
        return (
          <DataCollectionScreen
            step={step}
            onTextInput={(field, value) => {
              updateData({ [field]: value } as any);
              const nextMap: Partial<Record<WizardStep, WizardStep>> = {
              };
              const next = nextMap[step];
              if (next) goTo(next);
            }}
            onOptionSelect={(field, value) => {
              updateData({ [field]: value } as any);
              if (step === 'data-beach') {
                goTo(
                  userData.interests.includes('sport') ? 'data-sports' :
                  userData.interests.includes('culture') ? 'data-event-type' :
                  userData.interests.includes('lifestyle') ? 'data-lifestyle' :
                  'data-age'
                );
              } else if (step === 'data-age') {
                goTo('data-name');
              }
            }}
            onMultiSelect={(field, values) => {
              updateData({ [field]: values } as any);
              if (step === 'data-sports') {
                goTo(
                  userData.interests.includes('culture') ? 'data-event-type' :
                  userData.interests.includes('lifestyle') ? 'data-lifestyle' :
                  'data-age'
                );
              } else if (step === 'data-event-type') {
                goTo(userData.interests.includes('lifestyle') ? 'data-lifestyle' : 'data-age');
              } else if (step === 'data-lifestyle') {
                goTo('data-age');
              }
            }}
            onNext={() => {
              const nextMap: Partial<Record<WizardStep, WizardStep>> = {
                'data-name': 'data-city',
                'data-city': 'lead-capture',
              };
              const next = nextMap[step];
              if (next) goTo(next);
            }}
          />
        );

      case 'lead-capture':
        return (
          <LeadCaptureScreen
            userData={userData}
            onUpdateData={updateData}
            onComplete={() => goTo('results')}
          />
        );

      case 'results':
      case 'complete':
        return <ResultsScreen userData={userData} />;

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen bg-background flex flex-col ${isEmbedded ? 'overflow-hidden' : ''}`}>
      {!isEmbedded && <WizardHeader progress={progress} canGoBack={canGoBack} onBack={goBack} />}
      {isWidgetEmbed && <WizardHeader progress={progress} canGoBack={canGoBack} onBack={goBack} compact />}
      <main
        className={`flex-1 mx-auto w-full px-4 ${isEmbedded ? (isWidgetEmbed ? 'py-3' : 'py-4 sm:py-6') : 'py-6'} ${step === 'welcome' ? (isWidgetEmbed ? 'max-w-full' : 'max-w-md') : isEmbedded && mode === 'page' ? 'max-w-2xl' : 'max-w-lg'}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>
      {!isEmbedded && (
        <footer className="border-t border-border py-3 text-center text-xs text-muted-foreground">
          Jesolo.it — Portale turistico di Jesolo
        </footer>
      )}
    </div>
  );
};

export default Index;
