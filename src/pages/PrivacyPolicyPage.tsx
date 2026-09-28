import React from 'react';
import { BRAND_CONFIG } from '../config/brand';
import { NavLink } from '../router/RouterProvider';
import { LegalDocument } from '../components/legal/LegalDocument';
import type { LegalSection } from '../components/legal/LegalDocument';

const LAWFUL_BASIS_TABLE = (
  <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
    <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[34rem]">
      <thead>
        <tr className="bg-zinc-100 dark:bg-zinc-850/60 text-zinc-600 dark:text-zinc-300">
          <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">
            What we do with your data
          </th>
          <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider text-[10px]">
            Why, under the NDPA 2023
          </th>
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
        <tr>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Create and keep your account</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
            Contract — you cannot use JID without an account
          </td>
        </tr>
        <tr>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Show, search and rank your listings</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Contract</td>
        </tr>
        <tr>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Deliver messages between buyers and sellers</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Contract</td>
        </tr>
        <tr>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Moderate listings, reviews and reports</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
            Legitimate interests — keeping a safe marketplace
          </td>
        </tr>
        <tr>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Investigate abuse, fraud and reports</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Legitimate interests and legal obligation</td>
        </tr>
        <tr>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Reply to your contact form message</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Consent and pre-contractual steps</td>
        </tr>
        <tr>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Remember your cookie and theme choices</td>
          <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">Consent and legitimate interests</td>
        </tr>
      </tbody>
    </table>
  </div>
);

const SECTIONS: LegalSection[] = [
  {
    id: 'who-we-are',
    heading: 'Who we are',
    body: (
      <p>
        {BRAND_CONFIG.name} ({BRAND_CONFIG.fullName}) is a student marketplace and accommodation platform for{' '}
        {BRAND_CONFIG.institution.name}, {BRAND_CONFIG.institution.location}. For the purposes of the Nigeria Data
        Protection Act 2023, {BRAND_CONFIG.name} is the <strong className="text-zinc-900 dark:text-white">data
        controller</strong> of the personal data described in this policy: we decide why it is collected and how it is
        used. Our infrastructure providers act on our instructions as data processors.
      </p>
    ),
  },
  {
    id: 'what-we-collect',
    heading: 'What we collect',
    body: (
      <p>
        We collect only what the service genuinely needs. It falls into four groups, and the biggest group is what you
        choose to publish about yourself.
      </p>
    ),
    bullets: [
      'Account details you give us — email address, a username, your display name, and optionally your department, level, hall or area and a short bio.',
      'Content you publish — listings, item photos, prices, pickup spots, property details, reviews, and the messages you send to other students.',
      'Contact details you choose to reveal on a listing — a phone number or WhatsApp number, which you can add or remove at any time.',
      'Technical data that is unavoidable to run the site — the IP address and device used when you sign in, security and abuse logs, and the browser storage described in our cookie policy.',
    ],
  },
  {
    id: 'what-we-do-not-collect',
    heading: 'What we do not collect',
    body: (
      <>
        <p>There are some things a platform is often assumed to collect. {BRAND_CONFIG.name} does not:</p>
      </>
    ),
    bullets: [
      'We do not track you across other websites and build an advertising profile.',
      'We do not run advertising cookies or hand your data to ad networks.',
      'We do not buy or receive third-party marketing data about you.',
      'We do not sell your data to anyone, ever, for money or otherwise.',
    ],
  },
  {
    id: 'how-we-use-it',
    heading: 'Why we use your data, and our lawful bases',
    body: (
      <p>
        The NDPA requires us to have a valid reason — a lawful basis — for every piece of personal data we process.
        Ours are the bases in the table below. Where we rely on consent, you may withdraw it at any time and the
        processing stops.
      </p>
    ),
    blocks: [{ label: 'Table 1 — Lawful basis for each use', content: LAWFUL_BASIS_TABLE }],
  },
  {
    id: 'cookies',
    heading: 'Cookies and similar storage',
    body: (
      <p>
        We store a small amount of data in your browser to keep you signed in, remember your theme, and record your
        cookie choice. We do not use advertising cookies or third-party tracking. The full list, with names and
        lifetimes, is in the{' '}
        <NavLink
          to="cookies"
          className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          cookie policy
        </NavLink>
        , and you can change your choice at any time using the Cookie settings link in the footer.
      </p>
    ),
  },
  {
    id: 'sharing',
    heading: 'Who we share your data with',
    body: (
      <p>
        We share personal data only where it is necessary, and only with providers we have bound to our instructions.
      </p>
    ),
    bullets: [
      'Supabase — authentication and the database. Access rules are enforced here, so one student cannot read another student’s private messages or drafts.',
      'Cloudinary — image hosting for the photos attached to listings.',
      'Formspree — delivers the contact form message to our inbox.',
      'Our moderators — the minimum listing or profile information needed to review a report.',
      'Law enforcement or a court — where we are legally required to disclose, or where there is an immediate risk to someone’s safety.',
      'A successor, if JID is sold or transferred, in which case this policy continues to apply to you.',
    ],
  },
  {
    id: 'international-transfers',
    heading: 'Storage location and international transfers',
    body: (
      <p>
        {BRAND_CONFIG.name} is built and operated from Nigeria, but the providers above process data on servers that
        may be located outside Nigeria. Where your personal data leaves Nigeria we rely on the lawful bases in this
        policy together with appropriate safeguards, which include standard contractual clauses with the provider and
        minimising what is transferred. We do not transfer data to any country for advertising purposes, because we do
        do advertising.
      </p>
    ),
  },
  {
    id: 'retention',
    heading: 'How long we keep your data',
    body: (
      <>
        <p>
          We keep personal data only for as long as we need it, and then delete or anonymise it. The practical periods
          are:
        </p>
      </>
    ),
    bullets: [
      'Account and profile data — for as long as your account is open, then deleted within a reasonable period after you close it, save for what we must keep to settle a dispute.',
      'Listings and reviews — for as long as the listing is live, plus a moderation retention period so that a reported item can still be reviewed.',
      'Messages — for as long as your account is open, so you have a record of what was agreed.',
      'Security and abuse logs — for a limited period, then deleted, unless they are needed for an investigation.',
      'Cookie and theme preferences — until you clear them, or 12 months for the cookie choice, after which we ask again.',
    ],
  },
  {
    id: 'your-rights',
    heading: 'Your rights under the NDPA',
    body: (
      <p>
        The Nigeria Data Protection Act 2023 gives you rights over your personal data. You do not need to cite the Act
        to exercise them — just ask.
      </p>
    ),
    bullets: [
      'Right of access — ask for a copy of the personal data we hold about you.',
      'Right of rectification — have inaccurate or incomplete data corrected.',
      'Right of erasure — have your data deleted in the situations the Act allows, where it is not needed for a legitimate purpose any more.',
      'Right to restrict processing — ask us to pause how we use your data while a dispute about accuracy or your rights is resolved.',
      'Right to data portability — receive your data in a structured, commonly used, machine-readable format.',
      'Right to object — object to processing based on legitimate interests, and to direct marketing at any time.',
      'Right to withdraw consent — withdraw it at any time, where our basis is consent, without affecting processing that was already lawful.',
      'Right to complain — complain to the Nigeria Data Protection Commission if you believe we have not handled your data properly.',
    ],
  },
  {
    id: 'automated-decisions',
    heading: 'Automated decisions and profiling',
    body: (
      <p>
        {BRAND_CONFIG.name} does not use automated decision-making that produces legal or similarly significant effects
        about you. Search results are ordered by relevance and freshness. Boosted listings are paid placements and are
        labelled as such. Nobody is scored, refused an account, banned or priced differently by an algorithm.
      </p>
    ),
  },
  {
    id: 'security',
    heading: 'How we protect your data',
    body: (
      <>
        <p>
          Reasonable technical and organisational measures, and the limits of them. We encrypt traffic to the site,
          store sessions so that they expire and refresh rather than sitting forever, and enforce access rules in the
          database so that a query cannot return another student’s private data.
        </p>
        <p>
          No system is perfect. If a breach affects your personal data and is likely to result in a risk to your rights
          and freedoms, we will notify you and the Nigeria Data Protection Commission as the Act requires.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    heading: 'Children and minors',
    body: (
      <p>
        {BRAND_CONFIG.name} is built for students, and most of our users are adults. We do not knowingly collect data
        from anyone under 16. If you are under 16, do not create an account — ask a parent or guardian to contact us
        instead. If we discover that an account belongs to someone under 16, we will delete it and the data attached to
        it.
      </p>
    ),
  },
  {
    id: 'changes',
    heading: 'Changes to this policy',
    body: (
      <p>
        If this policy changes materially we will update the date at the top of this page. Where a change affects how
        or why we use your data, we will tell you directly — through the cookie banner or by writing to the email
        address on your account — before the change takes effect.
      </p>
    ),
  },
  {
    id: 'contact',
    heading: 'How to exercise your rights or complain',
    body: (
      <>
        <p>
          Use the{' '}
          <NavLink
            to="contact"
            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            contact page
          </NavLink>{' '}
          and say which right you want to exercise. We will respond in writing within the period the Act allows, and we
          will not charge you for making a request. We may ask for enough information to verify it is really you
          making the request, and we will tell you if we are slow or if we need more time.
        </p>
        <p>
          If you are not satisfied with how we have handled your data, you may lodge a complaint with the Nigeria Data
          Protection Commission.
        </p>
      </>
    ),
  },
];

/** /privacy — what we collect, why, who sees it, and your rights under the NDPA. */
export const PrivacyPolicyPage: React.FC = () => (
  <LegalDocument
    eyebrow="Privacy policy"
    title="Your data, in plain language."
    description={`How ${BRAND_CONFIG.name} collects personal data, why it is needed, who it is shared with, and what the Nigeria Data Protection Act 2023 lets you do about it. No fine print, no surprises.`}
    highlights={['No ad tracking', 'No selling your data', 'Rights you can actually use']}
    lastUpdated="2026-09-28"
    sections={SECTIONS}
    related={[
      { to: 'cookies', label: 'Cookie policy', description: 'Everything stored in your browser.' },
      { to: 'terms', label: 'Terms & Conditions', description: 'The rules of using JID.' },
    ]}
  />
);
