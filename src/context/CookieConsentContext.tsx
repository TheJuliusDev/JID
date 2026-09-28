import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Stored alongside the Supabase session and the theme preference. */
export const COOKIE_CONSENT_STORAGE_KEY = 'jid_cookie_consent';

/** Re-ask after a year so an old decision cannot be relied on forever. */
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export type CookieChoice = 'all' | 'essential';

interface StoredConsent {
  choice: CookieChoice;
  decidedAt: number;
}

interface CookieConsentValue {
  /** The visitor's stored choice, or `null` if they have not decided (or it expired). */
  choice: CookieChoice | null;
  /** True once a valid, unexpired choice exists. */
  hasDecided: boolean;
  /** True while the notice is on screen. */
  isBannerOpen: boolean;
  /** Persist a choice and close the notice. */
  saveChoice: (choice: CookieChoice) => void;
  /** Reopen the notice so the choice can be changed. Wired to the footer link. */
  openBanner: () => void;
  /** Hide the notice for this visit without recording a decision. */
  dismissForSession: () => void;
}

const CookieConsentContext = createContext<CookieConsentValue | null>(null);

const isCookieChoice = (value: unknown): value is CookieChoice => value === 'all' || value === 'essential';

/**
 * Read the stored record, discarding anything malformed or older than the
 * consent lifetime. Storage can throw outright in private modes, so every
 * access is guarded and simply treated as "no decision yet".
 */
const readStoredChoice = (): CookieChoice | null => {
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (!parsed || !isCookieChoice(parsed.choice) || typeof parsed.decidedAt !== 'number') return null;
    if (Date.now() - parsed.decidedAt > CONSENT_MAX_AGE_MS) return null;

    return parsed.choice;
  } catch {
    return null;
  }
};

const writeStoredChoice = (choice: CookieChoice): void => {
  try {
    const record: StoredConsent = { choice, decidedAt: Date.now() };
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable (private mode, disabled cookies). The choice still
    // applies for this visit; it just will not be remembered next time.
  }
};

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The notice reopens on every visit until the visitor actually decides, so
  // this is read synchronously during the first render: the app is client-only
  // (no hydration), and doing it in an effect would pop the notice in a frame
  // late and shift the page under the reader.
  const [choice, setChoice] = useState<CookieChoice | null>(readStoredChoice);
  const [isBannerOpen, setIsBannerOpen] = useState(() => readStoredChoice() === null);

  // Keep two open tabs in step, so a choice made in one applies in the other.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== COOKIE_CONSENT_STORAGE_KEY) return;
      const stored = readStoredChoice();
      setChoice(stored);
      setIsBannerOpen(stored === null);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const saveChoice = useCallback((next: CookieChoice) => {
    writeStoredChoice(next);
    setChoice(next);
    setIsBannerOpen(false);
  }, []);

  const openBanner = useCallback(() => setIsBannerOpen(true), []);

  const dismissForSession = useCallback(() => setIsBannerOpen(false), []);

  const value = useMemo<CookieConsentValue>(
    () => ({
      choice,
      hasDecided: choice !== null,
      isBannerOpen,
      saveChoice,
      openBanner,
      dismissForSession,
    }),
    [choice, isBannerOpen, saveChoice, openBanner, dismissForSession]
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = (): CookieConsentValue => {
  const context = useContext(CookieConsentContext);
  if (!context) throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  return context;
};
