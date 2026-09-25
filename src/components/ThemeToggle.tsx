import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../context/ThemeContext';

interface ThemeToggleProps {
  showLabel?: boolean;
  className?: string;
  id?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  showLabel = false, 
  className = '',
  id = 'theme-toggle-btn'
}) => {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <button
        id={id}
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to daylight theme' : 'Switch to late-night dark theme'}
        title={isDark ? 'Daylight Mode (Normal)' : 'Late-Night Mode (Dim & Eye-Safe)'}
        className={`relative inline-flex items-center h-8 sm:h-9 w-14 sm:w-16 rounded-full p-1 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 cursor-pointer select-none ${
          isDark
            ? 'bg-zinc-800 border border-zinc-700 focus:ring-offset-zinc-950'
            : 'bg-zinc-200 border border-zinc-300/80 focus:ring-offset-white'
        }`}
      >
        {/* Track Icons */}
        <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
          <Sun 
            className={`w-3.5 h-3.5 transition-opacity duration-200 ${
              isDark ? 'opacity-30 text-zinc-500' : 'opacity-90 text-amber-600'
            }`} 
          />
          <Moon 
            className={`w-3.5 h-3.5 transition-opacity duration-200 ${
              isDark ? 'opacity-90 text-emerald-400' : 'opacity-30 text-zinc-400'
            }`} 
          />
        </div>

        {/* Sliding Indicator Knob */}
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className={`flex items-center justify-center w-6 sm:w-7 h-6 sm:h-7 rounded-full shadow-md z-10 transition-colors ${
            isDark
              ? 'translate-x-6 sm:translate-x-7 bg-emerald-600 text-white'
              : 'translate-x-0 bg-white text-amber-500'
          }`}
        >
          {isDark ? (
            <Moon className="w-3.5 h-3.5 fill-current" />
          ) : (
            <Sun className="w-3.5 h-3.5 fill-current" />
          )}
        </motion.div>
      </button>

      {showLabel && (
        <span 
          onClick={toggleTheme}
          className="text-xs font-semibold cursor-pointer select-none text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          {isDark ? 'Late-Night Mode' : 'Daylight Mode'}
        </span>
      )}
    </div>
  );
};
