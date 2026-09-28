/**
 * Contact form submission via Formspree.
 *
 * The endpoint is a public, submit-only Formspree form URL supplied through the
 * environment (see `config/env.ts`). No API key or secret is required — and none
 * is ever shipped to the browser, because the contact form posts directly from
 * the client exactly as Formspree's HTML form does.
 *
 * Errors are deliberately normalised: the UI must never surface a raw provider
 * response to a visitor, only a boolean the Contact page can turn into its own
 * friendly copy.
 */

import { FORMSPREE_ENDPOINT, hasFormspreeConfig } from '../config/env';

export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactResult = { ok: true } | { ok: false; reason: 'not-configured' | 'invalid' | 'network' };

/** Substrings Formspree returns for the cases a visitor can actually fix. */
const isValidationRejection = (payload: unknown): boolean => {
  if (!payload || typeof payload !== 'object') return false;
  const errors = (payload as { errors?: Array<{ message?: string }> }).errors;
  if (!Array.isArray(errors)) return false;
  return errors.some((e) =>
    /required|invalid|verification|too many|spam|bot/i.test(String(e?.message ?? ''))
  );
};

export const isContactFormConfigured = (): boolean => hasFormspreeConfig;

export const sendContactMessage = async (input: ContactMessage): Promise<ContactResult> => {
  if (!hasFormspreeConfig) {
    console.error('[contact] FORMSPREE_ENDPOINT is not configured');
    return { ok: false, reason: 'not-configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const body = new FormData();
    body.append('name', input.name.trim());
    body.append('email', input.email.trim());
    body.append('subject', input.subject.trim());
    body.append('message', input.message.trim());
    // Formspree renders this in the notification email; lets us spot the source.
    body.append('_subject', `JID contact — ${input.subject.trim()}`);

    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      body,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      console.error('[contact] submission rejected', response.status, payload);
      return { ok: false, reason: isValidationRejection(payload) ? 'invalid' : 'network' };
    }

    return { ok: true };
  } catch (err) {
    console.error('[contact] submission failed', err);
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timeout);
  }
};
