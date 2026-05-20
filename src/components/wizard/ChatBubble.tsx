import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface ChatBubbleProps {
  children: ReactNode;
  isBot?: boolean;
  delay?: number;
}

export function ChatBubble({ children, isBot = true, delay = 0 }: ChatBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-3`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isBot
            ? 'bg-card text-card-foreground rounded-tl-sm border border-border'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        }`}
      >
        {children}
      </div>
    </motion.div>
  );
}
