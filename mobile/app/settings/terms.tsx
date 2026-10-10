/**
 * Terms & privacy.
 *
 * The mobile app carries the substantive rules so they are readable offline and
 * without a browser round-trip. The full legal documents (including the cookie
 * policy and the privacy annexes) live on the website; a deep link at the end
 * opens them in an in-app browser for anyone who wants the complete text.
 *
 * The wording here is condensed from `src/pages/TermsPage.tsx` and must stay
 * consistent with it â€” if the web copy changes materially, update this screen.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ExternalLink } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';

import { useTheme } from '@/providers/ThemeProvider';
import { BRAND } from '@/constants/brand';
import { radius, spacing, typography } from '@/constants/theme';
import { Screen, ScreenHeader, SectionHeader } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';

const LAST_UPDATED = '28 September 2026';

interface Section {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

const SECTIONS: Section[] = [
  {
    heading: 'Agreement to these terms',
    paragraphs: [
      `These terms form a binding agreement between you and ${BRAND.name} when you create an account, post a listing, or otherwise use the service. By using ${BRAND.name} you confirm that you accept them and our privacy and cookie policies.`,
      'If you do not accept these terms, do not use the service.',
    ],
  },
  {
    heading: 'About the service',
    paragraphs: [
      `${BRAND.name} is a marketplace and accommodation platform for ${BRAND.institution.name} (${BRAND.institution.shortName}), ${BRAND.institution.location}. Members list second-hand goods, publish rooms and bed spaces, search what others have posted, and message each other.`,
      `${BRAND.name} is not a letting agency, not an estate agent, not a bank, and not a party to any sale, tenancy or agreement between members.`,
    ],
  },
  {
    heading: 'Eligibility',
    paragraphs: [],
    bullets: [
      'You must be at least 16 to hold an account, and 18 to enter a binding rental agreement.',
      'Provide accurate information and keep it accurate. False identity details are grounds for removal.',
      'One account per person. Multiple accounts, or posting for someone else, are not allowed.',
      'You must own or control what you are selling.',
    ],
  },
  {
    heading: 'Accounts and security',
    paragraphs: [
      'You are responsible for what happens under your account. Keep your sign-in details private and tell us promptly if you think someone else has used your account.',
      'We may suspend or close an account where these terms have been breached, where a listing or message is fraudulent or unsafe, where we receive a credible complaint, or where the law requires it.',
    ],
  },
  {
    heading: 'Listings and content',
    paragraphs: [
      'Everything you post â€” titles, descriptions, photos, prices, conditions, availability, pickup spots â€” must be true. You confirm you own or control the goods or property, have the right to the photos, and are not listing anything stolen, counterfeit or unlawful.',
      `You keep ownership of your content and grant ${BRAND.name} a licence to host, store, resize and display it while it is on the service.`,
    ],
    bullets: [
      'Do not post contact details to dodge the messaging flow, and do not charge a fee to see a listing.',
      'Do not repost the same listing or use several accounts to promote one thing.',
      'Photos must be of the actual item or property.',
    ],
  },
  {
    heading: 'Accommodation listings',
    paragraphs: [
      'Rooms and bed spaces are advertised directly by landlords, caretakers, agents or outgoing tenants. Publishing is free; there is no inspection, viewing or booking fee charged on your behalf.',
      'A listing is an advertisement, not a tenancy. Before paying anything, see the room, confirm who you are dealing with, and get terms in writing.',
    ],
    bullets: [
      'State the yearly rent, water source, power setup, security and distance to the gate.',
      'Do not demand an inspection fee to show a room.',
      'Do not describe a property as verified unless it carries the JID verification mark.',
    ],
  },
  {
    heading: 'Prices, payment and counterparties',
    paragraphs: [
      `${BRAND.name} does not sell your goods, rent you a room, hold your money or act as escrow. Prices are set by the seller or landlord, and payment and the contract are between you and them. We are not a party to it and cannot reverse a payment.`,
    ],
  },
  {
    heading: 'Prohibited use',
    paragraphs: ['The following result in removal and usually suspension:'],
    bullets: [
      'Counterfeit, stolen, recalled or unsafe goods.',
      'A room or property you do not control, or a deposit for a property you cannot deliver.',
      'Harassment, threats, hate speech or illegal content.',
      'Spam, bulk messaging or unsolicited advertising.',
      'Scraping, bots, or evading moderation and bans.',
      'Posting another personâ€™s private information.',
    ],
  },
  {
    heading: 'Reviews and ratings',
    paragraphs: [
      'A review must describe a real interaction. You may not review yourself, review someone you have not dealt with, or use a review to pressure someone. Fabricated, deceptive or abusive reviews are removed and may lead to suspension.',
    ],
  },
  {
    heading: 'Visibility boosts',
    paragraphs: [
      'A boost lifts one of your own listings higher for a limited period. It is labelled promoted, never changes the price, and never places a listing ahead of a better or cheaper one. Where a boost requires watching an advert, that advert is shown to you and no one else.',
    ],
  },
  {
    heading: 'Moderation and enforcement',
    paragraphs: [
      'Anyone can report a listing, profile or message. Reports go to the moderation team, who may remove content, warn, suspend, or take no action. We act on credible reports of fraud, danger or illegality.',
    ],
  },
  {
    heading: 'Intellectual property',
    paragraphs: [
      `The ${BRAND.name} name, logo, layout, code and design belong to ${BRAND.name} or its licensors. Content you post stays yours, and you confirm you have the right to post it.`,
    ],
  },
  {
    heading: 'Disclaimers and liability',
    paragraphs: [
      'The service is provided as it is. To the fullest extent Nigerian law allows, we exclude implied warranties and do not warrant that any listing is accurate, that any member is who they claim to be, or that a transaction will succeed.',
      `We are not liable for losses from your dealings with another member. Where we are liable, our total liability is limited to what you actually paid us in the previous twelve months â€” which for most members is nothing, because ${BRAND.name} is free.`,
    ],
  },
  {
    heading: 'Governing law',
    paragraphs: [
      'These terms are governed by the laws of the Federal Republic of Nigeria. Nothing removes your right to raise a matter with the Nigeria Data Protection Commission.',
    ],
  },
  {
    heading: 'Contact',
    paragraphs: [
      'Questions about these terms, or a dispute you want raised, go through the contact page. Reports about a specific listing are better raised with the in-app report button.',
    ],
  },
];

export default function TermsScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const openFull = useCallback(() => {
    void WebBrowser.openBrowserAsync(`${BRAND.website}/terms`);
  }, []);

  const openPrivacy = useCallback(() => {
    void WebBrowser.openBrowserAsync(`${BRAND.website}/privacy`);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Terms & Privacy" fallback="/(tabs)" />

      <Screen gap={spacing.lg}>
        <View style={styles.intro}>
          <Text style={[typography.title, { color: colors.text }]}>
            The rules for using {BRAND.name}.
          </Text>
          <Text style={[typography.body, { color: colors.textMuted }]}>
            What you can expect from {BRAND.name}, what we expect from you, and what happens when
            something goes wrong. Written to be read, not skimmed past.
          </Text>
          <Text style={[typography.caption, { color: colors.textSubtle }]}>
            Last updated {LAST_UPDATED}
          </Text>
        </View>

        {SECTIONS.map((section) => (
          <View key={section.heading} style={styles.section}>
            <SectionHeader title={section.heading} />
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {section.paragraphs.map((paragraph, i) => (
                <Text
                  key={i}
                  style={[
                    typography.body,
                    { color: colors.textMuted, marginTop: i === 0 ? 0 : spacing.sm },
                  ]}
                >
                  {paragraph}
                </Text>
              ))}

              {section.bullets ? (
                <View style={styles.bullets}>
                  {section.bullets.map((bullet, i) => (
                    <View key={i} style={styles.bullet}>
                      <View style={[styles.bulletDot, { backgroundColor: colors.brand }]} />
                      <Text style={[typography.small, styles.bulletText, { color: colors.textMuted }]}>
                        {bullet}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))}

        <View
          style={[styles.fullCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Text style={[typography.bodyStrong, { color: colors.text }]}>
            Need the full documents?
          </Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            The complete terms, privacy policy and cookie policy are on the JID website.
          </Text>
          <Button
            label="Full terms online"
            icon={ExternalLink}
            variant="outline"
            onPress={openFull}
          />
          <Button label="Privacy policy" variant="ghost" onPress={openPrivacy} />
        </View>

        <Text style={[typography.caption, styles.footer, { color: colors.textSubtle }]}>
          {BRAND.fullName}
          {'\n'}
          {BRAND.website}
        </Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  intro: {
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.base,
    gap: spacing.sm,
  },
  bullets: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
  },
  fullCard: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.base,
    gap: spacing.sm,
  },
  footer: {
    textAlign: 'center',
  },
});
