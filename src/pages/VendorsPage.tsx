import React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Camera,
  MessageCircle,
  Package,
  PlusCircle,
  Settings2,
  Store,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { ScrollReveal } from '../components/ScrollReveal';
import { NavLink } from '../router/RouterProvider';

interface VendorsPageProps {
  onOpenCreateListing: () => void;
  onOpenAuth: () => void;
  isAuthenticated: boolean;
}

const CAPABILITIES = [
  {
    icon: Users,
    title: 'Create a vendor profile',
    body: 'A public storefront with your name, what you sell and reviews from past buyers — so customers know who they are dealing with before they message you.',
  },
  {
    icon: Package,
    title: 'List products or rooms',
    body: 'Upload photos, set a naira price, describe the condition or the space, and pick a campus pickup spot or the area your lodge is in.',
  },
  {
    icon: Users,
    title: 'Reach students and other buyers',
    body: 'Your listings are searchable and filtered by category, location and price, so the right people find them without you chasing DMs.',
  },
  {
    icon: Settings2,
    title: 'Manage all your listings',
    body: 'Edit details, pause a listing, mark something sold, or boost a single listing for 24 hours. Everything lives in one dashboard.',
  },
  {
    icon: MessageCircle,
    title: 'Connect with customers',
    body: 'Answer questions in-app or share your WhatsApp and phone. Deal terms, payment and handover stay between you and the buyer.',
  },
  {
    icon: BadgeCheck,
    title: 'Keep your reputation visible',
    body: 'Verified accounts and public ratings mean repeat customers can find you again, and a bad report does not quietly disappear.',
  },
] as const;

const STEPS = [
  {
    icon: Camera,
    title: 'Create your profile',
    body: 'Sign up with any email, add what you sell and where you operate. It takes about a minute.',
  },
  {
    icon: PlusCircle,
    title: 'Post your first listing',
    body: 'Add photos, a price and a description. You can list an item, a book of past questions, or a lodge.',
  },
  {
    icon: MessageCircle,
    title: 'Talk to buyers',
    body: 'Respond to enquiries, agree on a handover spot on campus, and complete the sale directly.',
  },
] as const;

const AUDIENCES = [
  { icon: Package, label: 'Students clearing out a room' },
  { icon: Store, label: 'Campus vendors and shop owners' },
  { icon: Building2, label: 'Landlords, caretakers and agents' },
  { icon: Users, label: 'Resellers and alumni buying or selling' },
] as const;

/** /vendors — everything a seller needs to know, in one short page. */
export const VendorsPage: React.FC<VendorsPageProps> = ({ onOpenCreateListing, onOpenAuth, isAuthenticated }) => {
  const startSelling = () => {
    if (isAuthenticated) onOpenCreateListing();
    else onOpenAuth();
  };

  return (
    <>
      <PageHeader
        eyebrow="Sell on JID"
        title={<>Anyone can sell on JID.</>}
        description={
          <>
            JID is not limited to students. If you have something to sell or a space to fill, create a profile, post a
            listing, and get in front of the people on campus looking for exactly that. There is no fee to list, no
            commission on a sale, and no paid placement.
          </>
        }
        highlights={['No listing fees', 'No sales commission', 'Free optional visibility boost']}
        tone="emerald"
        aside={
          <div className="bg-zinc-950 dark:bg-zinc-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden">
            <div className="absolute -top-16 -right-10 w-56 h-56 bg-emerald-600/20 blur-3xl rounded-full pointer-events-none" />
            <div className="relative z-10">
              <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-2">
                Ready when you are
              </div>
              <h2 className="font-display text-2xl font-black text-white mb-2">Start selling on JID</h2>
              <p className="text-xs text-zinc-400 leading-relaxed mb-5">
                {isAuthenticated
                  ? 'Post an item or a lodge in under a minute.'
                  : 'Create a free account first — it takes a minute and unlocks posting, messaging and reviews.'}
              </p>
              <button
                onClick={startSelling}
                className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98] cursor-pointer"
              >
                {isAuthenticated ? 'Post a listing' : 'Create a free account'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        }
      />

      {/* What vendors can do */}
      <section className="py-16 sm:py-20 bg-sand-50 dark:bg-charcoal-950 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
                What you get as a seller
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Everything below is included on a free account, whether you sell one textbook or fifty items a week.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CAPABILITIES.map((item, index) => {
              const Icon = item.icon;
              return (
                <ScrollReveal key={item.title} delay={0.05 * (index % 3)}>
                  <div className="h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 hover:border-emerald-300 dark:hover:border-emerald-800 hover:shadow-md transition-all">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white mb-1.5">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{item.body}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-20 bg-white dark:bg-charcoal-900 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="max-w-2xl mb-10">
              <h2 className="font-display text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
                Selling on JID takes three steps
              </h2>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <ScrollReveal key={step.title} delay={0.06 * index}>
                  <div className="relative h-full bg-sand-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-zinc-950 dark:bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="font-mono-code text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        STEP 0{index + 1}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-zinc-950 dark:text-white mb-1.5">
                      {step.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">{step.body}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Who this is for + closing CTA */}
      <section className="py-16 sm:py-20 bg-sand-50 dark:bg-charcoal-950 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-5">
              <ScrollReveal>
                <h2 className="font-display text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
                  Built for every kind of seller
                </h2>
                <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  You do not need to be a student to sell on JID — and you do not need to be an agent to list a lodge.
                </p>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AUDIENCES.map((audience, index) => {
                const Icon = audience.icon;
                return (
                  <ScrollReveal key={audience.label} delay={0.05 * index}>
                    <div className="flex items-center gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                      <Icon className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{audience.label}</span>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>

          <ScrollReveal delay={0.12}>
            <div className="mt-12 bg-zinc-950 dark:bg-zinc-900 text-white rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[240px] bg-emerald-600/10 blur-[110px] rounded-full pointer-events-none" />
              <div className="relative z-10">
                <h2 className="font-display text-2xl sm:text-4xl font-black text-white tracking-tight">
                  Start selling on JID
                </h2>
                <p className="mt-3 text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
                  Create a profile, post your first listing, and start talking to buyers today. Free to join, free to
                  list.
                </p>
                <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={startSelling}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-4 rounded-2xl text-sm shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Store className="w-4 h-4" />
                    {isAuthenticated ? 'Post your first listing' : 'Create a free account'}
                  </button>
                  <NavLink
                    to="marketplace"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold px-6 py-4 rounded-2xl text-sm transition-all active:scale-[0.98]"
                  >
                    See what others are selling
                  </NavLink>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </>
  );
};
