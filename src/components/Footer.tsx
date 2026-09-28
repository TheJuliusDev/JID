import React from 'react';
import { Cookie, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import { ACTIVE_CONTACT_CHANNELS, ACTIVE_SOCIALS, BRAND_CONFIG } from '../config/brand';
import { useCookieConsent } from '../context/CookieConsentContext';
import { NavLink } from '../router/RouterProvider';
import type { ViewType } from '../types';

interface FooterProps {
  /** Opens the "post a listing" flow (auth-gated by the caller). */
  onOpenCreate: () => void;
}

const EXPLORE: Array<{ to: ViewType; label: string }> = [
  { to: 'home', label: 'Home' },
  { to: 'marketplace', label: 'Marketplace' },
  { to: 'accommodation', label: 'Accommodation' },
  { to: 'vendors', label: 'Vendors' },
];

const COMPANY: Array<{ to: ViewType; label: string }> = [
  { to: 'about', label: 'About JID' },
  { to: 'contact', label: 'Contact' },
];

const ACCOUNT: Array<{ to: ViewType; label: string }> = [
  { to: 'login', label: 'Log in' },
  { to: 'signup', label: 'Sign up' },
];

const LEGAL: Array<{ to: ViewType; label: string }> = [
  { to: 'terms', label: 'Terms & Conditions' },
  { to: 'privacy', label: 'Privacy Policy' },
  { to: 'cookies', label: 'Cookie Policy' },
];

const CHANNEL_ICONS = { email: Mail, phone: Phone, whatsapp: MessageCircle } as const;

const channelHref = (kind: string, value: string) => {
  if (kind === 'email') return `mailto:${value}`;
  if (kind === 'whatsapp') return `https://wa.me/${value.replace(/[^\d]/g, '')}`;
  return `tel:${value.replace(/[^\d+]/g, '')}`;
};

const LinkColumn: React.FC<{ heading: string; links: Array<{ to: ViewType; label: string }> }> = ({
  heading,
  links,
}) => (
  <div>
    <div className="text-zinc-200 uppercase font-bold tracking-wider text-[11px] mb-3">{heading}</div>
    <ul className="space-y-1.5">
      {links.map((link) => (
        <li key={link.to}>
          <NavLink
            to={link.to}
            className="text-sm text-zinc-400 hover:text-white transition-colors block py-0.5"
          >
            {link.label}
          </NavLink>
        </li>
      ))}
    </ul>
  </div>
);

/** Site-wide footer. Shown on every page; deliberately short. */
export const Footer: React.FC<FooterProps> = ({ onOpenCreate }) => {
  const { openBanner } = useCookieConsent();

  return (
    <footer className="bg-zinc-950 text-zinc-400 border-t border-zinc-900 pt-14 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-8 pb-10">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <img
                src="/apple-touch-icon.png"
                alt=""
                draggable={false}
                className="w-8 h-8 rounded-xl object-cover"
              />
              <span className="font-display text-2xl font-black tracking-tight text-white">{BRAND_CONFIG.name}</span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono-code">
                {BRAND_CONFIG.institution.shortName}
              </span>
            </div>

            <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
              {BRAND_CONFIG.tagline} A marketplace and accommodation platform for{' '}
              {BRAND_CONFIG.institution.name}, {BRAND_CONFIG.institution.location}.
            </p>

            <button
              onClick={onOpenCreate}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-400 transition-colors cursor-pointer"
            >
              + Post an item or lodge
            </button>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Built for {BRAND_CONFIG.institution.sobriquet} students.</span>
            </div>
          </div>

          <div className="lg:col-span-2">
            <LinkColumn heading="Explore" links={EXPLORE} />
          </div>

          <div className="lg:col-span-2">
            <LinkColumn heading="JID" links={COMPANY} />
          </div>

          <div className="lg:col-span-2">
            <LinkColumn heading="Legal" links={LEGAL} />

            <button
              type="button"
              onClick={openBanner}
              className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <Cookie className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              Cookie settings
            </button>
          </div>

          <div className="lg:col-span-2">
            <LinkColumn heading="Account" links={ACCOUNT} />

            {ACTIVE_CONTACT_CHANNELS.length > 0 && (
              <ul className="mt-5 space-y-1.5">
                {ACTIVE_CONTACT_CHANNELS.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel.kind];
                  return (
                    <li key={channel.kind}>
                      <a
                        href={channelHref(channel.kind, channel.value)}
                        className="text-sm text-zinc-400 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <Icon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="break-all">{channel.value}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}

            {ACTIVE_SOCIALS.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {ACTIVE_SOCIALS.map((social) => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} {BRAND_CONFIG.name}. All rights reserved.
          </div>
          <div className="flex items-center gap-2">
            <span>{BRAND_CONFIG.institution.location}</span>
            <span>&bull;</span>
            <span className="text-emerald-500 font-medium">{BRAND_CONFIG.institution.sobriquet}</span>
          </div>
        </div>

        <div className="mt-3 text-right">
          <p className="text-[11px] text-zinc-600">
            Developed by{' '}
            <a
              href="https://thejuliusdevofficial.vercel.app"
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2 decoration-zinc-700 dark:decoration-zinc-600 hover:text-emerald-400 hover:decoration-emerald-500 transition-colors"
            >
              thejuliusdev
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};
