/**
 * Theme provider.
 *
 * Resolves the light/dark token set and exposes it plus the scheme setter to
 * the whole app. Screens never import `theme.ts` directly — they pull from
 * `useTheme()` so a scheme switch repaints them instantly.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, type Theme } from '@/constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Persisted so the chosen scheme survives a restart. */
const STORAGE_KEY = 'jid.theme.preference';

const isPreference = (value: string | null): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

export interface ThemeModeValue {
  /** True when the *resolved* scheme is dark, regardless of preference. */
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Jumps to the opposite of whatever is currently showing. */
  toggle: () => void;
}

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeModeValue;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialPreference = 'system',
}: {
  children: React.ReactNode;
  initialPreference?: ThemePreference;
}) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);

  // Restore the persisted choice once on mount. A read failure is not fatal:
  // the app just starts on the caller's `initialPreference` (system by default).
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (active && isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => {
        // Ignore: fall back to the default preference.
      });
    return () => {
      active = false;
    };
  }, []);

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Non-fatal: the in-memory preference still applies for this session.
    });
  }, []);

  // Convenience for the appearance toggle in Settings: jumps to the opposite of
  // whatever is currently showing.
  const toggle = useCallback(() => {
    setPreferenceState((current) => {
      const resolvedDark = current === 'system' ? systemScheme === 'dark' : current === 'dark';
      return resolvedDark ? 'light' : 'dark';
    });
  }, [systemScheme]);

  const theme = isDark ? darkTheme : lightTheme;

  const mode = useMemo<ThemeModeValue>(
    () => ({ isDark, preference, setPreference, toggle }),
    [isDark, preference, setPreference, toggle],
  );

  return (
    <ThemeContext.Provider value={{ theme, mode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * The resolved token set for the current colour scheme.
 *
 * This is what ~every screen wants, so it is the primary hook. Reading tokens
 * (rather than importing `theme.ts`) is what lets a scheme change repaint the
 * whole tree instantly.
 */
export function useTheme(): Theme {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside <ThemeProvider>.');
  }
  return context.theme;
}

/** Only the scheme controls — used by the Settings appearance screen. */
export function useThemeMode(): ThemeModeValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used inside <ThemeProvider>.');
  }
  return context.mode;
}