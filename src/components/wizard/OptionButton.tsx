import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface OptionButtonProps {
  label: string;
  description?: string;
  onClick: () => void;
  delay?: number;
}

export function OptionButton({ label, description, onClick, delay = 0 }: OptionButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      <Button
        variant="outline"
        onClick={onClick}
        className="w-full justify-start text-left h-auto py-3 px-4 border-border hover:bg-ocean-light hover:border-primary transition-all"
      >
        <div>
          <div className="font-medium text-sm">{label}</div>
          {description && (
            <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
          )}
        </div>
      </Button>
    </motion.div>
  );
}
