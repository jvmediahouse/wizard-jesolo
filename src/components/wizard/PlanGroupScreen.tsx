import { useTranslation } from 'react-i18next';
import { ChatBubble } from './ChatBubble';
import { OptionButton } from './OptionButton';

interface PlanGroupScreenProps {
  onSelect: (group: string) => void;
}

export function PlanGroupScreen({ onSelect }: PlanGroupScreenProps) {
  const { t } = useTranslation();

  const options = [
    { key: 'solo', label: t('planGroup.solo') },
    { key: 'couple', label: t('planGroup.couple') },
    { key: 'friends', label: t('planGroup.friends') },
    { key: 'familyKids', label: t('planGroup.familyKids') },
  ];

  return (
    <div className="space-y-3">
      <ChatBubble>{t('planGroup.title')}</ChatBubble>
      <div className="space-y-2 mt-2">
        {options.map((o, i) => (
          <OptionButton key={o.key} label={o.label} onClick={() => onSelect(o.key)} delay={0.1 + i * 0.05} />
        ))}
      </div>
    </div>
  );
}
