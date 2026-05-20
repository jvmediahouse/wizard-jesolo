import { useState, useCallback } from 'react';

export type WizardPath = 'events' | 'plan' | null;

export type WizardStep =
  | 'welcome'
  | 'events-date'
  | 'events-results'
  | 'plan-date'
  | 'plan-group'
  | 'plan-pet'
  | 'plan-interests'
  | 'data-beach'
  | 'data-sports'
  | 'data-event-type'
  | 'data-lifestyle'
  | 'data-age'
  | 'data-name'
  | 'data-city'
  | 'lead-capture'
  | 'results'
  | 'complete';

export interface UserData {
  name: string;
  surname: string;
  email: string;
  city: string;
  province: string;
  country: string;
  ageRange: string;
  travelGroup: string;
  interests: string[];
  beachPreference: string;
  sports: string[];
  eventTypes: string[];
  lifestyle: string[];
  selectedDate: Date | null;
  endDate: Date | null;
  path: WizardPath;
  hasPet: boolean | null;
  privacyConsent: boolean;
  newsletter: boolean;
}

const initialUserData: UserData = {
  name: '',
  surname: '',
  email: '',
  city: '',
  province: '',
  country: '',
  ageRange: '',
  travelGroup: '',
  interests: [],
  beachPreference: '',
  sports: [],
  eventTypes: [],
  lifestyle: [],
  selectedDate: null,
  endDate: null,
  path: null,
  hasPet: null,
  privacyConsent: false,
  newsletter: false,
};

const TOTAL_STEPS = 8;

function getProgress(step: WizardStep): number {
  const map: Record<string, number> = {
    'welcome': 0,
    'events-date': 1, 'events-results': 1,
    'plan-date': 1,
    'plan-group': 2, 'plan-pet': 2, 'plan-interests': 2,
    'data-beach': 3, 'data-sports': 3, 'data-event-type': 3, 'data-lifestyle': 3,
    'data-age': 4,
    'data-name': 5, 'data-city': 5,
    'lead-capture': 6,
    'results': 7,
    'complete': 8,
  };
  return Math.round(((map[step] ?? 0) / TOTAL_STEPS) * 100);
}

export function useWizard() {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [userData, setUserData] = useState<UserData>(initialUserData);
  const [history, setHistory] = useState<WizardStep[]>([]);

  const goTo = useCallback((next: WizardStep) => {
    setHistory(h => [...h, step]);
    setStep(next);
  }, [step]);

  const goBack = useCallback(() => {
    setHistory(h => {
      const copy = [...h];
      const prev = copy.pop();
      if (prev) setStep(prev);
      return copy;
    });
  }, []);

  const updateData = useCallback((partial: Partial<UserData>) => {
    setUserData(d => ({ ...d, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setStep('welcome');
    setUserData(initialUserData);
    setHistory([]);
  }, []);

  return {
    step,
    userData,
    progress: getProgress(step),
    canGoBack: history.length > 0,
    goTo,
    goBack,
    updateData,
    reset,
  };
}
