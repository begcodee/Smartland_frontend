'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  theme: ThemeMode;
  systemTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
};

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  enableSystem?: boolean;
  attribute?: 'class' | 'data-theme';
  storageKey?: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  enableSystem = true,
  attribute = 'class',
  storageKey = 'theme',
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const initialSystem = readSystemTheme();
    setSystemTheme(initialSystem);

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeState(stored);
      }
    } catch {
      // ignore storage access issues
    }
  }, [storageKey]);

  useEffect(() => {
    if (!mounted) return;
    if (!enableSystem || typeof window === 'undefined') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
    update();

    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [mounted, enableSystem]);

  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;

    const resolved: ResolvedTheme =
      theme === 'system' ? (enableSystem ? systemTheme : 'light') : theme;

    const root = document.documentElement;
    if (attribute === 'class') {
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
    } else {
      root.setAttribute(attribute, resolved);
    }

    root.style.colorScheme = resolved;

    try {
      localStorage.setItem(storageKey, theme);
    } catch {
      // ignore storage access issues
    }
  }, [attribute, mounted, theme, systemTheme, enableSystem, storageKey]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      systemTheme,
      setTheme: setThemeState,
    }),
    [theme, systemTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

