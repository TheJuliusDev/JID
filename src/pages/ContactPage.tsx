import React from 'react';
import {
  Building2,
  Clock,
  LifeBuoy,
  Mail,
  MessageCircle,
  Phone,
  Send,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { ACTIVE_CONTACT_CHANNELS, ACTIVE_SOCIALS, BRAND_CONFIG } from '../config/brand';
import { ContactForm } from '../components/contact/ContactForm';
import { PageHeader } from '../components/common/PageHeader';
import { ScrollReveal } from '../components/ScrollReveal';
import { NavLink } from '../router/RouterProvider';

const REASONS = [
  {
    icon: ShieldAlert,
    title: 'Report a listing',
    body: 'A scam, a counterfeit, wrong information or something unsafe. Reports go straight to moderation.',
  },
  {
    icon: Building2,
    title: 'Accommodation question',
    body: 'Ask about a specific lodge, area or room type, or tell us about a property that is missing.',
  },
  {
    icon: Store,
    title: 'Selling on JID',
    body: 'Questions about posting, boosts, your storefront or how buyers find your listings.',
  },
  {
    icon: LifeBuoy,
    title: 'Account support',
    body: 'Sign-in trouble, a wrong profile detail, or help with messages and saved items.',
  },
] as const;

const CHANNEL_ICONS = { email: Mail, phone: Phone, whatsapp: MessageCircle } as const;

const channelHref = (kind: string, value: string) => {
  if (kind === 'email') return `mailto:${value}`;
  if (kind === 'whatsapp') return `https://wa.me/${value.replace(/[^\d]/g, '')}`;
  return `tel:${value.replace(/[^\d+]/g, '')}`;
};

/** /contact — who to talk to, why, and a form that really sends. */
export const ContactPage: React.FC = () => {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Talk to the people who run JID."
        description="Questions about a listing, a lodge, your account, or selling on JID — send them here and it lands in the same inbox the team reads."
        highlights={['Mon – Sat', 'Replies within one working day', 'Reports are prioritised']}
      />

      <section className="py-14 sm:py-20 bg-sand-50 dark:bg-charcoal-950 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* LEFT — context and channels */}
            <div className="lg:col-span-5 space-y-6">
              <ScrollReveal>
                <div className="bg-zinc-950 dark:bg-zinc-900 text-white rounded-3xl p-6 sm:p-7 relative overflow-hidden">
                  <div className="absolute -top-20 -right-12 w-56 h-56 bg-emerald-600/20 blur-3xl rounded-full pointer-events-none" />
                  <div className="relative z-10">
                    <h2 className="font-display text-xl font-black text-white mb-2">Why contact {BRAND_CONFIG.name}</h2>
                    <p className="text-sm text-zinc-400 leading-relaxed">
                      Every account, listing and lodge on {BRAND_CONFIG.name} is created by a real person on or around
                      campus. When something is wrong, telling us is the fastest way to get it fixed.
                    </p>
                  </div>
                </div>
              </ScrollReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {REASONS.map((reason, index) => {
                  const Icon = reason.icon;
                  return (
                    <ScrollReveal key={reason.title} delay={0.05 * index}>
                      <div className="h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                          <Icon className="w-4 h-4" />
                        </div>
                        <h3 className="font-display text-sm font-bold text-zinc-950 dark:text-white mb-1">
                          {reason.title}
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{reason.body}</p>
                      </div>
                    </ScrollReveal>
                  );
                })}
              </div>

              {/* Direct channels — only rendered once they are genuinely live */}
              <ScrollReveal delay={0.1}>
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300">
                      Direct channels
                    </h3>
                  </div>

                  {ACTIVE_CONTACT_CHANNELS.length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      The form on this page is the fastest way to reach us — it is monitored during working hours and
                      every message is read by a person.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {ACTIVE_CONTACT_CHANNELS.map((channel) => {
                        const Icon = CHANNEL_ICONS[channel.kind];
                        return (
                          <li key={channel.kind}>
                            <a
                              href={channelHref(channel.kind, channel.value)}
                              className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            >
                              <Icon className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="text-zinc-500 dark:text-zinc-500 text-xs w-16 shrink-0">
                                {channel.label}
                              </span>
                              <span className="font-medium break-all">{channel.value}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <Clock className="w-3.5 h-3.5" />
                    {BRAND_CONFIG.institution.location}
                  </div>

                  {ACTIVE_SOCIALS.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                      {ACTIVE_SOCIALS.map((social) => (
                        <a
                          key={social.label}
                          href={social.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          {social.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollReveal>
            </div>

            {/* RIGHT — the form */}
            <div className="lg:col-span-7">
              <ScrollReveal delay={0.08}>
                <ContactForm />
              </ScrollReveal>

              <div className="mt-6 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                Looking for a lodge or an item instead?{' '}
                <NavLink to="accommodation" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                  Browse accommodation
                </NavLink>{' '}
                or{' '}
                <NavLink to="marketplace" className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                  the marketplace
                </NavLink>
                .
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};
