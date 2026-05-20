import { useTranslation } from 'react-i18next';
import { ChatBubble } from './ChatBubble';
import { OptionButton } from './OptionButton';

interface PlanPetScreenProps {
  onSelect: (hasPet: boolean) => void;
}

export function PlanPetScreen({ onSelect }: PlanPetScreenProps) {
  const { t } = useTranslation();

  const options = [
    { key: true, label: t('planPet.yes') },
    { key: false, label: t('planPet.no') },
  ];

  return (
    <div className="space-y-3">
      <ChatBubble>{t('planPet.title')}</ChatBubble>
      <div className="space-y-2 mt-2">
        {options.map((o, i) => (
          <OptionButton
            key={String(o.key)}
            label={o.label}
            onClick={() => onSelect(o.key)}
            delay={0.1 + i * 0.05}
          />
        ))}
      </div>
    </div>
  );
}