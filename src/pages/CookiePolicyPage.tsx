import React from 'react';
import { BRAND_CONFIG } from '../config/brand';
import { LegalDocument } from '../components/legal/LegalDocument';
import type { LegalSection } from '../components/legal/LegalDocument';

/** Storage the app actually writes, kept in sync with the code. */
const STORAGE_TABLE = (
  <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
    <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[40rem]">
      <thead>
        <tr className="bg-zinc-100 dark:bg-zinc-850/60 text-zinc-600 dark:text-zinc-300">
          <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">
            Name
          </th>
          <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">
            Type
          </th>
          <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">
            What it does
          </th>
          <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">
            Lifetime
          </th>
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
        <tr>
          <td className="px-4 py-3 font-mono-code text-[11px] text-zinc-900 dark:text-zinc-100">jid-auth</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Local storage (essential)</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
            Holds your sign-in session so you stay logged in between visits and your refresh token can be rotated
            securely.
          </td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Until you sign out or clear it</td>
        </tr>
        <tr>
          <td className="px-4 py-3 font-mono-code text-[11px] text-zinc-900 dark:text-zinc-100">jid_campus_theme</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Local storage (functional)</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
            Remembers whether you chose light or dark mode, so the site does not flash on every page.
          </td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Until you clear it</td>
        </tr>
        <tr>
          <td className="px-4 py-3 font-mono-code text-[11px] text-zinc-900 dark:text-zinc-100">jid_cookie_consent</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Local storage (essential)</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
            Records the cookie choice you made and when you made it, so we stop asking and can evidence your consent.
          </td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">12 months, then we ask again</td>
        </tr>
      </tbody>
    </table>
  </div>
);

const SECTIONS: LegalSection[] = [
  {
    id: 'what-cookies-are',
    heading: 'What cookies and similar storage actually are',
    navLabel: 'What cookies are',
    body: (
      <>
        <p>
          A cookie is a small text file a website asks your browser to store. When you come back, the browser sends it
          back so the site can remember something about you.
        </p>
        <p>
          Modern browsers also offer <strong className="text-zinc-900 dark:text-white">local storage</strong> and{' '}
          <strong className="text-zinc-900 dark:text-white">session storage</strong>, which work the same way but hold
          slightly more. Because they behave so similarly to cookies, this policy and the Nigeria Data Protection Act
          treat all three the same way.
        </p>
      </>
    ),
  },
  {
    id: 'the-short-version',
    heading: 'The short version',
    body: (
      <p>
        {BRAND_CONFIG.name} does not run advertising cookies, does not embed third-party advertising trackers, and does
        not sell or share your browsing behaviour with ad networks. We also do not use third-party analytics in the
        sense that would let a company profile you across other websites.
      </p>
    ),
    bullets: [
      'No advertising or retargeting cookies.',
      'No cross-site behavioural tracking or data brokers.',
      'No consent-management platform quietly loading scripts before you agree.',
      'The only things stored are what keeps you signed in, what keeps your theme, and the record of the cookie choice you made.',
    ],
  },
  {
    id: 'what-we-store',
    heading: 'Everything we store, in one table',
    body: (
      <>
        <p>
          This is the complete list. If a technology is not in this table, {BRAND_CONFIG.name} did not add it.
        </p>
      </>
    ),
    blocks: [{ label: 'Table 1 — Storage used by this site', content: STORAGE_TABLE }],
  },
  {
    id: 'essential-storage',
    heading: 'Strictly necessary storage',
    body: (
      <p>
        Your sign-in session (<span className="font-mono-code text-[13px]">jid-auth</span>) and your cookie choice (
        <span className="font-mono-code text-[13px]">jid_cookie_consent</span>) are strictly necessary. They are not
        optional and they are not switched off when you choose &ldquo;Essential only&rdquo;, because without them you
        cannot stay signed in and we would keep asking you the same question on every single page.
      </p>
    ),
  },
  {
    id: 'functional-storage',
    heading: 'Functional storage',
    body: (
      <p>
        Your light or dark mode preference (<span className="font-mono-code text-[13px]">jid_campus_theme</span>) is
        functional. It is a display choice only, it never leaves your device, and it is not linked to your identity.
        Choosing &ldquo;Essential only&rdquo; does not disable it &mdash; turning off dark mode would be a strange
        punishment for a privacy decision.
      </p>
    ),
  },
  {
    id: 'analytics',
    heading: 'Analytics',
    body: (
      <p>
        {BRAND_CONFIG.name} does not use advertising or analytics cookies, and it does not embed third-party analytics
        scripts. Nothing on this site builds a profile of you across other websites you visit.
      </p>
    ),
    bullets: [
      'Clicking &ldquo;Accept all&rdquo; does not switch on any tracker, because there is nothing to switch on.',
      'We still count, server-side, how many accounts and listings exist so the team can see the product working. That is aggregate business data, not a cookie about you.',
    ],
  },
  {
    id: 'third-party',
    heading: 'Cookies set by the services we use',
    body: (
      <p>
        We use a small number of infrastructure providers. Where one of them sets cookies or similar storage in your
        browser, that storage is theirs and is governed by their own policy as well as this one.
      </p>
    ),
    bullets: [
      'Authentication and database — Supabase. Keeps you signed in and enforces the access rules that stop one student reading another student’s messages or listings.',
      'Image hosting — Cloudinary. Serves the photos you upload. Images are addressed directly and are not used to build a behavioural profile.',
      'Contact form delivery — Formspree. Receives the name, email and message you type into the contact form so the team can reply.',
      'Messaging hand-off — if you follow a phone or WhatsApp link from a listing, you leave {BRAND_CONFIG.name} and that app applies its own rules.',
    ],
  },
  {
    id: 'your-controls',
    heading: 'How to control or withdraw your choice',
    body: (
      <>
        <p>
          You can change your mind at any time. Use the{' '}
          <strong className="text-zinc-900 dark:text-white">Cookie settings</strong> link in the footer of every page
          and the choice panel will reopen with your current selection.
        </p>
        <p>
          Withdrawing consent is as easy as giving it, and withdrawing it never removes the processing that happened
          lawfully before you withdrew.
        </p>
      </>
    ),
  },
  {
    id: 'clearing-storage',
    heading: 'Clearing cookies and site data in your browser',
    body: (
      <>
        <p>
          Browsers let you delete stored data yourself. Clearing it does not delete your {BRAND_CONFIG.name} account
          or your listings &mdash; it only signs you out and resets your theme until you set it again.
        </p>
      </>
    ),
    bullets: [
      'Chrome and Edge — the padlock or tune icon at the left of the address bar, then Cookies and site data, then Manage on this site.',
      'Safari — Settings, Privacy, Manage Website Data, then search for the site name and remove it.',
      'Firefox — the shield icon, then Clear cookies and site data.',
      'On a phone, use your browser’s settings screen and look for something like Cookies, Site data or Privacy.',
    ],
  },
  {
    id: 'do-not-track',
    heading: 'Do Not Track',
    body: (
      <p>
        Because {BRAND_CONFIG.name} does not track you across websites, there is nothing for a Do Not Track signal to
        switch off. We honour it in the sense that we never build cross-site profiles in the first place. We do not
        read or store the signal itself, because storing it would be storing data for no purpose.
      </p>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    body: (
      <p>
        If this policy changes materially — for example if a new technology is added, or a provider changes what it
        does — we will update the date at the top of this page and, for significant changes, ask you again through the
        cookie banner rather than assuming your old choice still applies.
      </p>
    ),
  },
  {
    id: 'contact',
    heading: 'How to contact us about cookies',
    body: (
      <p>
        Questions about this policy, or about how a specific technology is used, go to the same team as every other
        question about {BRAND_CONFIG.name}. Use the contact page and choose the reason that fits; we will answer in
        writing and explain it plainly.
      </p>
    ),
  },
];

/** /cookies — what the site stores in your browser and how to control it. */
export const CookiePolicyPage: React.FC = () => (
  <LegalDocument
    eyebrow="Cookie policy"
    title="What this site stores in your browser, and why."
    description={`A plain-language account of every cookie and piece of local storage used by ${BRAND_CONFIG.name}. Short version: no advertising cookies, no cross-site tracking, and nothing that follows you around the internet.`}
    highlights={['No advertising cookies', 'No cross-site tracking', 'Change your mind any time']}
    lastUpdated="2026-09-28"
    sections={SECTIONS}
    related={[
      { to: 'privacy', label: 'Privacy policy', description: 'What we collect about you and your rights.' },
      { to: 'terms', label: 'Terms & Conditions', description: 'The rules of using JID.' },
    ]}
  />
);
