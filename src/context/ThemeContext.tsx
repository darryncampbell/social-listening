'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('auto');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [mounted, setMounted] = useState(false);

  // Get system preference
  const getSystemTheme = (): ResolvedTheme => {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // Resolve the actual theme based on mode
  const resolveTheme = (themeMode: ThemeMode): ResolvedTheme => {
    if (themeMode === 'auto') {
      return getSystemTheme();
    }
    return themeMode;
  };

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('theme-mode') as ThemeMode | null;
    if (stored && ['light', 'dark', 'auto'].includes(stored)) {
      setModeState(stored);
      setResolvedTheme(resolveTheme(stored));
    } else {
      setResolvedTheme(resolveTheme('auto'));
    }
    setMounted(true);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted) return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (mode === 'auto') {
        setResolvedTheme(getSystemTheme());
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mode, mounted]);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme, mounted]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    setResolvedTheme(resolveTheme(newMode));
    localStorage.setItem('theme-mode', newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Default values for when context is not available
const defaultTheme: ThemeContextType = {
  mode: 'auto',
  resolvedTheme: 'dark',
  setMode: () => {},
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  // Return defaults if context is not available (e.g., in error boundaries)
  if (context === null) {
    return defaultTheme;
  }
  return context;
}
