import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatBubble } from './ChatBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { UserData } from '@/hooks/useWizard';

interface LeadCaptureScreenProps {
  userData: UserData;
  onUpdateData: (partial: Partial<UserData>) => void;
  onComplete: () => void;
}

export function LeadCaptureScreen({ userData, onUpdateData, onComplete }: LeadCaptureScreenProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = userData.email.trim() && userData.privacyConsent;

  const handleSubmit = () => {
    if (!userData.privacyConsent) {
      setError(t('leadCapture.privacyRequired'));
      return;
    }
    setLoading(true);
    setError('');
    // Simulate brief processing then go to results
    setTimeout(() => {
      setLoading(false);
      onComplete();
    }, 300);
  };

  return (
    <div className="space-y-3">
      <ChatBubble>
        <p className="font-semibold mb-1">{t('leadCapture.title')}</p>
        <p>{t('leadCapture.subtitle')}</p>
      </ChatBubble>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-4 mt-2">
        <Input
          type="email"
          placeholder={t('leadCapture.emailPlaceholder')}
          value={userData.email}
          onChange={e => onUpdateData({ email: e.target.value })}
        />

        <div className="flex items-start gap-2">
          <Checkbox
            id="privacy"
            checked={userData.privacyConsent}
            onCheckedChange={checked => onUpdateData({ privacyConsent: !!checked })}
          />
          <Label htmlFor="privacy" className="text-xs leading-tight cursor-pointer">
            {t('leadCapture.privacy')} *
          </Label>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="newsletter"
            checked={userData.newsletter}
            onCheckedChange={checked => onUpdateData({ newsletter: !!checked })}
          />
          <Label htmlFor="newsletter" className="text-xs leading-tight cursor-pointer">
            {t('leadCapture.newsletter')}
          </Label>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={!canSubmit || loading} className="w-full">
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />{t('leadCapture.submitting')}</>
          ) : (
            t('leadCapture.submit')
          )}
        </Button>
      </motion.div>
    </div>
  );
}
