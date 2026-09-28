import React from 'react';
import { BRAND_CONFIG } from '../config/brand';
import { NavLink } from '../router/RouterProvider';
import { LegalDocument } from '../components/legal/LegalDocument';
import type { LegalSection } from '../components/legal/LegalDocument';

const SECTIONS: LegalSection[] = [
  {
    id: 'agreement',
    heading: 'Agreement to these terms',
    body: (
      <>
        <p>
          These Terms & Conditions form a binding agreement between you and {BRAND_CONFIG.name} when you create an
          account, post a listing, or otherwise use the service. By using {BRAND_CONFIG.name} you confirm that you have
          read, understood and accepted them, together with our{' '}
          <NavLink
            to="privacy"
            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            privacy policy
          </NavLink>{' '}
          and{' '}
          <NavLink
            to="cookies"
            className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            cookie policy
          </NavLink>
          .
        </p>
        <p>
          If you do not accept these terms, do not use the service. If you use it on behalf of an organisation, you
          confirm you are authorised to bind that organisation.
        </p>
      </>
    ),
  },
  {
    id: 'about-the-service',
    heading: 'About the service',
    body: (
      <>
        <p>
          {BRAND_CONFIG.name} is a marketplace and accommodation platform for{' '}
          {BRAND_CONFIG.institution.name} ({BRAND_CONFIG.institution.shortName}),{' '}
          {BRAND_CONFIG.institution.location}. Members can list second-hand goods, publish rooms and bed spaces, search
          what others have posted, and message each other.
        </p>
        <p>
          {BRAND_CONFIG.name} is operated for the campus community. It is not a letting agency, not an estate agent,
          not a bank, and not a party to any sale, tenancy or agreement that happens between members.
        </p>
      </>
    ),
  },
  {
    id: 'eligibility',
    heading: 'Eligibility',
    bullets: [
      'You must be at least 16 years old to hold an account, and at least 18 to enter into a binding contract such as a rental agreement.',
      'You must provide accurate information and keep it accurate. False identity details are grounds for removal.',
      'One account per person. Operating multiple accounts, or posting on behalf of another person, is not allowed.',
      'You must be legally able to enter into the transaction you are offering, and you must actually own or control what you are selling.',
      'You may not use the service if doing so would breach Nigerian law, or if you have been banned from the service.',
    ],
  },
  {
    id: 'accounts',
    heading: 'Accounts, security and what we can suspend',
    body: (
      <>
        <p>
          You are responsible for what happens under your account. Keep your sign-in details to yourself, and tell us
          promptly if you think someone else has used your account.
        </p>
        <p>
          We may suspend, limit or close an account where we reasonably believe these terms have been breached, where
          a listing or message is fraudulent or unsafe, where we receive a credible complaint, or where the law
          requires it. Where it is proportionate to do so, we will tell you why and give you a chance to respond.
        </p>
      </>
    ),
  },
  {
    id: 'listings',
    heading: 'Listings and content you post',
    body: (
      <>
        <p>
          Everything you post — titles, descriptions, photos, prices, conditions, availability, pickup spots — must be
          true. You are telling a real buyer or tenant something they may rely on. In particular you confirm that you
          own or control the goods or property you have listed, that you have the right to post the photos, and that
          you are not listing anything stolen, counterfeit or otherwise unlawful.
        </p>
        <p>
          You keep ownership of what you post. You grant {BRAND_CONFIG.name} a worldwide, non-exclusive, royalty-free
          licence to host, store, resize, display and show your content to the people who use the service, for as long
          as the content is on the service. Without that licence we could not show anyone your listing.
        </p>
      </>
    ),
    bullets: [
      'Do not post contact details in the description to dodge the messaging flow, and do not ask anyone to pay a fee to see a listing.',
      'Do not post the same listing repeatedly, and do not use several accounts to promote one thing.',
      'Photos must be of the actual item or property. Stock images and images you do not have the right to use are not allowed.',
      'Prices must be genuine. Bait pricing with the real price revealed only in person is not allowed.',
    ],
  },
  {
    id: 'accommodation',
    heading: 'Accommodation listings',
    body: (
      <>
        <p>
          Rooms, flats, studios and bed spaces posted on {BRAND_CONFIG.name} are advertised directly by landlords,
          caretakers, agents or outgoing tenants. Publishing a listing costs nothing and we do not charge an
          inspection fee, a viewing fee or a booking fee on your behalf.
        </p>
        <p>
          A listing is an advertisement, not a tenancy. No tenancy exists between you and a landlord until you and the
          landlord sign a proper agreement. Before you pay anything, you should see the room, confirm who you are
          dealing with, and get terms in writing — rent, duration, utilities, notice period and who pays for repairs.
        </p>
      </>
    ),
    bullets: [
      'State the yearly rent, the water source, the power setup, the security and the distance to the gate.',
      'Do not demand an inspection or application fee in exchange for showing a room.',
      'Do not describe a property as verified unless it carries the verification mark applied by the JID team.',
      'Students should meet in daylight, at a known campus location, and should not send money to an account they cannot trace.',
    ],
  },
  {
    id: 'transactions',
    heading: 'Prices, payment and who your counterparty is',
    body: (
      <>
        <p>
          {BRAND_CONFIG.name} does not sell your goods, does not rent you a room, does not hold your money and does not
          act as escrow. Prices are set by the seller or landlord. Payment happens directly between you and them, and
          the contract is between you and them. We are not a party to it.
        </p>
        <p>
          Because no money passes through us, we cannot reverse a payment, cancel a sale, or compel anyone to hand
          over an item. If a transaction goes wrong, deal with it directly with the other member, and report it to us
          so we can act on the account.
        </p>
      </>
    ),
  },
  {
    id: 'prohibited-use',
    heading: 'Prohibited use',
    body: (
      <p>
        The following are not allowed and will result in removal of the content and usually suspension of the account:
      </p>
    ),
    bullets: [
      'Posting counterfeit, stolen, recalled or unsafe goods.',
      'Posting a room or property you do not control, or taking a booking deposit for a property you cannot deliver.',
      'Harassment, threats, hate speech, or content that targets a person because of who they are.',
      'Sexual, violent or otherwise illegal content, and anything involving minors.',
      'Spam, bulk messaging, unsolicited advertising, or recruitment or fundraising you have not been asked to do.',
      'Scraping, copying, mirroring or reverse engineering the service, or using bots to post or message.',
      'Circumventing moderation, or opening a new account after being banned.',
      'Posting another person’s private information, or content you do not have the right to post.',
    ],
  },
  {
    id: 'reviews',
    heading: 'Reviews and ratings',
    body: (
      <>
        <p>
          Reviews help other students trade safely, so the rules are strict. A review must describe a real interaction
          you actually had. You may not review yourself, review a person you have not dealt with, use a review to
          pressure someone into a refund, or post anything defamatory, offensive or about a person’s private life.
        </p>
        <p>
          A review that turns out to be fabricated, deceptive or abusive is removed and may lead to suspension. We may
          remove a review that is accurate but unlawful, and we will explain why where we can.
        </p>
      </>
    ),
  },
  {
    id: 'boosts',
    heading: 'Visibility boosts',
    body: (
      <>
        <p>
          A boost lifts one of your own listings higher in search and in category views for a limited period. It is
          labelled as promoted, it never changes the price, and it never places a competitor’s listing ahead of a
          better or cheaper one.
        </p>
        <p>
          Boosts are earned or purchased for the period stated at the time. Where a boost requires you to watch a
          short advert to unlock it, that is an advertising exchange: you give us your attention in return for the
          boost, and the advert is shown to you and not to anyone else.
        </p>
      </>
    ),
  },
  {
    id: 'moderation',
    heading: 'Moderation, reports and enforcement',
    body: (
      <>
        <p>
          Anyone can report a listing, a profile or a message. Reports go to the moderation team, who may remove the
          content, warn the account, suspend it, or take no action. We will act on credible reports of fraud, danger or
          illegality.
        </p>
        <p>
          We may remove content that breaks these terms even where it is not illegal, and we may remove content that
          we cannot verify. We are not obliged to give reasons for every action, and we may act on a report without
          discussing it with the reporter.
        </p>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    heading: 'Intellectual property',
    body: (
      <>
        <p>
          The {BRAND_CONFIG.name} name, logo, layout, code, and design of the service belong to {BRAND_CONFIG.name} or
          its licensors. You may not copy, reproduce or republish them without written permission.
        </p>
        <p>
          Content you post stays yours. You confirm that you have the right to post it and that posting it does not
          infringe anybody else’s rights, and you agree to cover a claim that it does. Anyone who believes their work
          has been used wrongly on the service should contact us so we can look at it.
        </p>
      </>
    ),
  },
  {
    id: 'liability',
    heading: 'Disclaimers and limits of liability',
    body: (
      <>
        <p>
          The service is provided as it is. To the fullest extent Nigerian law allows, we exclude all implied
          warranties of quality, fitness, merchantability and non-infringement. We do not warrant that the service will
          be uninterrupted, that any listing is accurate, that any member is who they claim to be, or that any
          transaction will be successful.
        </p>
        <p>
          Nothing in these terms excludes or limits liability for death or personal injury caused by negligence, for
          fraud or fraudulent misrepresentation, or for anything else that cannot lawfully be excluded.
        </p>
        <p>
          Subject to that, we are not liable for loss arising from your dealings with another member, including a
          failed sale, a property that turned out to be unavailable, lost money, or being blocked from a transaction.
          Where we are liable, our total liability to you for any claim is limited to the amount you actually paid us in
          the twelve months before the claim — which for most members is nothing, because using {BRAND_CONFIG.name} is
          free.
        </p>
      </>
    ),
  },
  {
    id: 'indemnity',
    heading: 'Your responsibility for our losses',
    body: (
      <p>
        You agree to indemnify {BRAND_CONFIG.name} against claims, losses and reasonable costs arising from content you
        post, from your use of the service in breach of these terms, or from any misrepresentation you make about a
        goods, a room or your identity.
      </p>
    ),
  },
  {
    id: 'third-parties',
    heading: 'Third-party services and links',
    body: (
      <p>
        The service relies on third-party infrastructure, including authentication, database, image hosting and contact
        form delivery. Your use of the service depends on those providers working; we do not control them and we are
        not responsible for their availability or their own acts and omissions.
      </p>
    ),
    bullets: [
      'Links in a listing, a message or a review to a website, a phone number or a messaging app are outside our control. Do not follow a link you do not trust.',
      'We are not responsible for the content, products or services of any third-party site or app.',
      'Contacting a seller by phone or messaging app means you are no longer using our messaging, and the records we hold are limited to what happened on {BRAND_CONFIG.name}.',
    ],
  },
  {
    id: 'changes',
    heading: 'Changes to these terms',
    body: (
      <p>
        We may update these terms to reflect changes in the service or the law. The date at the top of this page shows
        when they last changed. If a change materially reduces your rights, we will give you reasonable notice through
        the site or by email before it takes effect. Continuing to use the service after that means you accept the
        updated terms.
      </p>
    ),
  },
  {
    id: 'law',
    heading: 'Governing law and disputes',
    body: (
      <>
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Nigeria have
          jurisdiction over any dispute arising from them. Nothing in these terms removes your right to raise a matter
          with the Nigeria Data Protection Commission, or any other regulator, about the way your personal data has been
          handled.
        </p>
        <p>
          Before starting proceedings, please talk to us. Most complaints are a misunderstanding and are resolved
          faster by a message than by a court.
        </p>
      </>
    ),
  },
  {
    id: 'contact',
    heading: 'How to contact us',
    body: (
      <p>
        Questions about these terms, a listing you believe breaches them, or a dispute you want raised, all go through
        the contact page. Reports about a specific listing or profile are better raised with the in-app report button,
        because that attaches the listing to the report automatically.
      </p>
    ),
  },
];

/** /terms — the rules that govern using JID. */
export const TermsPage: React.FC = () => (
  <LegalDocument
    eyebrow="Terms & Conditions"
    title="The rules for using JID."
    description={`What you can expect from ${BRAND_CONFIG.name}, what we expect from you, and what happens when something goes wrong. Written to be read, not to be skimmed past.`}
    highlights={['Free to join', 'Free to list', 'You keep your data']}
    lastUpdated="2026-09-28"
    sections={SECTIONS}
    related={[
      { to: 'privacy', label: 'Privacy policy', description: 'What we collect about you and your rights.' },
      { to: 'cookies', label: 'Cookie policy', description: 'Everything stored in your browser.' },
    ]}
  />
);
