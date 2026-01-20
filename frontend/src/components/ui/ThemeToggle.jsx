import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';

const ThemeToggle = () => {
  const { isDark, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="relative group p-2.5 rounded-xl bg-gray-100 dark:bg-dark-surface border-2 border-gray-200 dark:border-dark-border hover:border-primary-500 dark:hover:border-primary-500 transition-all duration-300 overflow-hidden"
      aria-label="Toggle theme"
    >
      {/* Robot Head Container - Centered */}
      <div className="relative w-7 h-7 flex items-center justify-center">
        {/* Light Mode - Sun Robot */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            isDark ? 'opacity-0 rotate-180 scale-0' : 'opacity-100 rotate-0 scale-100'
          }`}
        >
          <Sun className="w-5 h-5 text-amber-500" />
          {/* Sun rays indicator */}
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
        </div>

        {/* Dark Mode - Moon Robot */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
            isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-180 scale-0'
          }`}
        >
          <Moon className="w-5 h-5 text-blue-400" />
          {/* Stars indicator */}
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-300 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/0 via-primary-500/10 to-primary-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
    </button>
  );
};

export default ThemeToggle;