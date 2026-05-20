import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WizardHeaderProps {
  progress: number;
  canGoBack: boolean;
  onBack: () => void;
  compact?: boolean;
}

const languages = [
  { code: 'it', label: '🇮🇹 Italiano' },
  { code: 'en', label: '🇬🇧 English' },
  { code: 'de', label: '🇩🇪 Deutsch' },
];

export function WizardHeader({ progress, canGoBack, onBack, compact = false }: WizardHeaderProps) {
  const { i18n } = useTranslation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className={`flex items-center justify-between px-4 ${compact ? 'py-2' : 'py-3'}`}>
        <div className="flex items-center gap-2">
          {canGoBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <img
            src="https://jesolo.it/wp-content/uploads/2024/03/logo-jesolo.png"
            alt="Jesolo"
            className={`w-auto object-contain ${compact ? 'h-7 max-w-[112px]' : 'h-9 max-w-[144px]'}`}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className={`gap-1.5 text-xs ${compact ? 'h-8 px-2.5' : ''}`}>
              <Globe className="h-3.5 w-3.5" />
              {i18n.language.toUpperCase()}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {languages.map(lang => (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => i18n.changeLanguage(lang.code)}
                className={i18n.language === lang.code ? 'bg-muted' : ''}
              >
                {lang.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {progress > 0 && (
        <Progress value={progress} className="h-1 rounded-none" />
      )}
    </header>
  );
}
