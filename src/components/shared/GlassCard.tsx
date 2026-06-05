import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  className, 
  hoverable = false,
  ...props 
}) => {
  return (
    <motion.div
      whileHover={hoverable ? { y: -4, scale: 1.01 } : undefined}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-300",
        "border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/[0.03]",
        "shadow-[0_8px_32px_0_rgba(31,41,55,0.05)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]",
        className
      )}
      {...props}
    >
      {/* --- Subtle Inner Gradient --- */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-100/50 dark:from-white/[0.05] to-transparent pointer-events-none" />
      
      <div className="relative z-10 p-5">
        {children}
      </div>
    </motion.div>
  );
};
