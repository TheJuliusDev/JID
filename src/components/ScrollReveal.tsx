import React from 'react';
import { motion } from 'motion/react';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  yOffset?: number;
  duration?: number;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  delay = 0,
  className = '',
  yOffset = 22,
  duration = 0.55,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration,
        delay,
        ease: [0.21, 1, 0.36, 1], // Refined smooth ease-out for subtle entrance
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
