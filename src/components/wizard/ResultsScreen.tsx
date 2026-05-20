import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';
import type { UserData } from '@/hooks/useWizard';
import { generatePdf, type VacationPlan } from '@/lib/pdfGenerator';
import { supabase } from '@/integrations/supabase/client';
import { PlanPreview } from '@/components/wizard/PlanPreview';

interface ResultsScreenProps {
  userData: UserData;
}

function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return null;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  }
  if (Number.isNaN(value.getTime())) return null;
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function ResultsScreen({ userData }: ResultsScreenProps) {
  const { t, i18n } = useTranslation();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [plan, setPlan] = useState<VacationPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);
  const emailsSentRef = useRef(false);

  const locale = i18n.language.split('-')[0].toLowerCase();
  const accommodationUrl = {
    it: 'https://jesolo.it/dove-dormire/',
    en: 'https://jesolo.it/en/dove-dormire/',
    de: 'https://jesolo.it/de/dove-dormire/',
  }[locale] ?? 'https://jesolo.it/dove-dormire/';

  const infoPointUrl = {
    it: 'https://jesolo.it/info-point/',
    en: 'https://jesolo.it/en/info-point/',
    de: 'https://jesolo.it/de/info-point/',
  }[locale] ?? 'https://jesolo.it/info-point/';

  const saveSubmissionInBackground = (generatedPlan: VacationPlan | null) => {
    void supabase.from('wizard_submissions').insert({
      name: userData.name || null,
      surname: userData.surname || null,
      email: userData.email || null,
      city: userData.city || null,
      province: userData.province || null,
      country: userData.country || null,
      age_range: userData.ageRange || null,
      path: userData.path,
      travel_group: userData.travelGroup || null,
      interests: userData.interests?.length ? userData.interests : null,
      beach_preference: userData.beachPreference || null,
      sports: userData.sports?.length ? userData.sports : null,
      event_types: userData.eventTypes?.length ? userData.eventTypes : null,
      selected_date: formatDateOnly(userData.selectedDate),
      end_date: formatDateOnly(userData.endDate),
      has_pet: userData.hasPet,
      privacy_consent: userData.privacyConsent,
      newsletter: userData.newsletter,
      generated_plan: generatedPlan as never,
    }).then(({ error: insertErr }) => {
      if (insertErr) console.error('Submission save failed:', insertErr);
    }, (insertErr) => {
      console.error('Submission save failed:', insertErr);
    });
  };

  const sendEmailsInBackground = (generatedPlan: VacationPlan | null) => {
    if (emailsSentRef.current) return;
    emailsSentRef.current = true;
    try {
      const blob = generatePdf(userData, generatedPlan, i18n.language);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const pdfBase64 = result.includes(',') ? result.split(',')[1] : result;
        void supabase.functions.invoke('send-wizard-emails', {
          body: {
            userData: {
              ...userData,
              selectedDate: formatDateOnly(userData.selectedDate),
              endDate: formatDateOnly(userData.endDate),
            },
            language: i18n.language,
            pdfBase64,
            planTitle: generatedPlan?.title ?? null,
          },
        }).then(({ error: fnErr }) => {
          if (fnErr) console.error('Email send failed:', fnErr);
        }, (fnErr) => console.error('Email send failed:', fnErr));
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error('Email prep failed:', e);
    }
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      setPlanLoading(true);
      setPlanError(null);
      try {
        const payload = {
          ...userData,
          selectedDate: formatDateOnly(userData.selectedDate),
          endDate: formatDateOnly(userData.endDate),
        };
        const { data, error } = await supabase.functions.invoke('generate-vacation-plan', {
          body: { userData: payload, language: i18n.language },
        });
        if (cancel) return;
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const generatedPlan = data?.plan ?? null;
        setPlan(generatedPlan);

        queueMicrotask(() => saveSubmissionInBackground(generatedPlan));
        queueMicrotask(() => sendEmailsInBackground(generatedPlan));
      } catch (e) {
        if (!cancel) setPlanError(e instanceof Error ? e.message : 'Errore');
      } finally {
        if (!cancel) setPlanLoading(false);
      }
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = () => {
    setPdfLoading(true);
    try {
      const blob = generatePdf(userData, plan, i18n.language);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch {
      // silent
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-primary mb-1">
          {plan?.title || t('results.title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('results.subtitle')}</p>
      </motion.div>

      {planLoading && (
        <Card className="border-border">
          <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t('results.loadingPlan')}</p>
          </CardContent>
        </Card>
      )}

      {planError && !planLoading && (
        <Card className="border-destructive/30">
          <CardContent className="py-4 text-sm text-destructive">{planError}</CardContent>
        </Card>
      )}

      {plan && !planLoading && (
        <PlanPreview plan={plan} sports={userData.sports} lifestyle={userData.lifestyle} hasPet={userData.hasPet} interests={userData.interests} />
      )}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}>
        <a href={accommodationUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="w-full gap-2 border-primary/40 hover:bg-primary/5">
            <ExternalLink className="h-4 w-4" />
            {t('results.accommodation')}
          </Button>
        </a>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.47 }}>
        <a href={infoPointUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="w-full gap-2 border-primary/40 hover:bg-primary/5">
            <ExternalLink className="h-4 w-4" />
            {t('results.infoPoint')}
          </Button>
        </a>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        {pdfUrl ? (
          <a href={pdfUrl} download="jesolo-vacation-plan.pdf">
            <Button className="w-full gap-2">
              <Download className="h-4 w-4" />
              {t('results.downloadPdf')}
            </Button>
          </a>
        ) : (
          <Button onClick={handleDownload} disabled={pdfLoading || planLoading} className="w-full gap-2">
            {pdfLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t('results.generating')}</>
            ) : (
              <><FileText className="h-4 w-4" />{t('results.generatePdf')}</>
            )}
          </Button>
        )}
      </motion.div>
    </div>
  );
}
