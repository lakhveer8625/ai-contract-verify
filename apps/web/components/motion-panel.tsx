'use client';

import { motion } from 'framer-motion';

export function MotionPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: 'easeOut' }} className={className}>
      {children}
    </motion.div>
  );
}
