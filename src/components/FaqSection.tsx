import React, { useState } from 'react';
import { ChevronDown, HelpCircle, MessageCircle, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScrollReveal } from './ScrollReveal';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-free',
    category: 'Pricing & Fees',
    question: 'Is JID free to use for OAU students?',
    answer: 'Yes, JID is 100% free for all Great Ife students. Browsing listings, posting items for sale, and discovering student accommodation come with zero platform fees and zero commission cuts. You keep 100% of your selling price.',
  },
  {
    id: 'faq-verification',
    category: 'Safety & Trust',
    question: 'How do I verify that a buyer or seller is genuinely an OAU student?',
    answer: 'Every registered account on JID is linked to verified student credentials. Profiles prominently display the student’s department, academic level, and campus residence (e.g. Fajuyi, Awo, Moremi, Mozambique, or off-campus area). Anonymous profiles and unverified external phone numbers are not permitted on the platform.',
  },
  {
    id: 'faq-handovers',
    category: 'Meetup Locations',
    question: 'Where are safe meetup spots for item handovers?',
    answer: 'All trades are designed for in-person handovers during daylight hours at recognized campus landmarks: the Students’ Union Building (SUB), Hezekiah Oluwasanmi Library, Faculty quadrangles, or Hall common areas. We strictly discourage meeting unfamiliar buyers late at night or outside campus gates.',
  },
  {
    id: 'faq-housing-agents',
    category: 'Accommodation',
    question: 'How does accommodation discovery work without agent fees?',
    answer: 'Off-campus lodges in Asherifa, Mayfair, Damico, Ede Road, and AP are listed directly by graduating stalites transferring their tenancy, students seeking flatmates, or verified property managers. You see the true annual rent, borehole status, power supply setup, and bike distance upfront—without paying ₦5,000 to ₦10,000 non-refundable "inspection form" fees to middlemen.',
  },
  {
    id: 'faq-freshers-stalites',
    category: 'Eligibility',
    question: 'Can freshers and stalites both use JID?',
    answer: 'Yes. Freshers finding accommodation and basic dorm essentials (mattresses, reading lamps, cookware) and stalites upgrading laptops, selling textbooks, or subletting rooms can all participate freely.',
  },
  {
    id: 'faq-boost-system',
    category: 'Boost & Monetization',
    question: 'How does the Rewarded Ad Boost system work?',
    answer: 'Boosting your listing on JID is 100% free and voluntary. When you want more buyer visibility, simply choose to watch 5 short sponsor messages. Once completed, your item receives an active 24-hour top-tier featured badge and enhanced search placement without paying any money.',
  },
];

interface FaqSectionProps {
  onExploreMarketplace: () => void;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ onExploreMarketplace }) => {
  const [openId, setOpenId] = useState<string | null>('faq-free');

  const toggleItem = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section id="faq-section" className="py-20 sm:py-28 bg-white dark:bg-charcoal-900 border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <ScrollReveal>
          <div className="text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-850/60 rounded-full text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-4">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>FREQUENTLY ASKED QUESTIONS</span>
            </div>

            <h2 className="font-display text-3xl sm:text-5xl font-black text-zinc-950 dark:text-white tracking-tight leading-tight mb-4">
              Common questions answered.
            </h2>

            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 max-w-xl mx-auto leading-relaxed">
              Everything you need to know about buying, selling, and finding student housing around Great Ife.
            </p>
          </div>
        </ScrollReveal>

        {/* Accordion List */}
        <div className="space-y-3.5">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openId === item.id;
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ 
                  duration: 0.45, 
                  delay: (index % 6) * 0.06, 
                  ease: [0.21, 1, 0.36, 1] 
                }}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isOpen 
                    ? 'border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-850/80 shadow-md' 
                    : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs'
                }`}
              >
                <button
                  id={`faq-btn-${item.id}`}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="w-full py-5 px-5 sm:px-6 text-left flex items-start justify-between gap-4 cursor-pointer select-none"
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${item.id}`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono-code mt-0.5 shrink-0">
                      0{index + 1}
                    </span>
                    <div>
                      <span className="text-[10px] font-semibold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider block mb-1">
                        {item.category}
                      </span>
                      <span className="font-display text-base sm:text-lg font-bold text-zinc-900 dark:text-white leading-snug">
                        {item.question}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 transition-transform duration-200 mt-1 ${
                      isOpen ? 'bg-zinc-950 dark:bg-emerald-600 text-white rotate-180' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-answer-${item.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 sm:px-6 pb-6 pt-1 text-sm sm:text-base text-zinc-600 dark:text-zinc-300 leading-relaxed border-t border-zinc-200/60 dark:border-zinc-800 mt-1">
                        <p className="pt-3">
                          {item.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Support banner */}
        <ScrollReveal delay={0.2}>
          <div className="mt-12 rounded-3xl bg-zinc-950 dark:bg-zinc-900 text-white p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl border border-zinc-900 dark:border-zinc-800">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-white mb-1">
                  Have another question about JID?
                </h3>
                <p className="text-xs sm:text-sm text-zinc-400">
                  Our student team is active on WhatsApp and happy to assist you anytime.
                </p>
              </div>
            </div>

            <button
              onClick={onExploreMarketplace}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 transition-colors cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </ScrollReveal>

      </div>
    </section>
  );
};
