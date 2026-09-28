import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, Clock, ShieldCheck } from 'lucide-react';
import { BRAND_CONFIG } from '../../config/brand';
import { NavLink } from '../../router/RouterProvider';
import type { ViewType } from '../../types';
import { PageHeader } from '../common/PageHeader';

export interface LegalSection {
  /** Anchor id. Keep it stable — the table of contents and deep links rely on it. */
  id: string;
  heading: string;
  /** Short label for the table of contents. Falls back to `heading`. */
  navLabel?: string;
  /** Paragraph copy. */
  body?: React.ReactNode;
  /** Bulleted list rendered under the copy. */
  bullets?: React.ReactNode[];
  /** Boxed annexes rendered after the bullets — tables, sub-clauses, notices. */
  blocks?: Array<{ label?: string; content: React.ReactNode }>;
}

export interface LegalDocumentProps {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  highlights?: string[];
  /** ISO `yyyy-mm-dd` date shown as the document's last-updated stamp. */
  lastUpdated: string;
  sections: LegalSection[];
  /** Sibling documents surfaced in the side rail. */
  related?: Array<{ to: ViewType; label: string; description: string }>;
}

/** Sticky offset that clears the fixed site navbar when jumping to an anchor. */
const SCROLL_MARGIN_CLASS = 'scroll-mt-28';

const formatDate = (iso: string): string => {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * Shared shell for the Terms, Privacy and Cookie documents.
 *
 * Every policy page is long-form prose, so this gives them one consistent
 * structure: masthead, a sticky table of contents with scroll-spy, numbered
 * sections that deep-link via `#anchor`, and a rail of sibling documents. Adding
 * a clause to a policy is a data change only — no layout work.
 */
export const LegalDocument: React.FC<LegalDocumentProps> = ({
  eyebrow,
  title,
  description,
  highlights,
  lastUpdated,
  sections,
  related = [],
}) => {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState(sections[0]?.id ?? '');

  const tocItems = useMemo(
    () => sections.map((section) => ({ id: section.id, label: section.navLabel ?? section.heading })),
    [sections]
  );

  // Scroll-spy: the section nearest the top of the viewport wins.
  useEffect(() => {
    if (tocItems.length === 0) return;

    const handleScroll = () => {
      const offset = 140;
      let current = tocItems[0].id;

      for (const item of tocItems) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) {
          current = item.id;
        }
      }

      // Pin the last section once the page is scrolled to the bottom, otherwise
      // short trailing sections can never become active.
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 80;
      if (atBottom) current = tocItems[tocItems.length - 1].id;

      setActiveId(current);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [tocItems]);

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        highlights={highlights}
        aside={
          <div className="flex justify-start lg:justify-end">
            <div className="inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-left">
                <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Last updated</div>
                <div className="text-xs font-bold text-zinc-900 dark:text-white">{formatDate(lastUpdated)}</div>
              </div>
            </div>
          </div>
        }
      />

      <section className="py-14 sm:py-20 bg-sand-50 dark:bg-charcoal-950 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            {/* Table of contents */}
            <nav aria-label="On this page" className="lg:col-span-4 lg:sticky lg:top-28">
              <div className="p-6 sm:p-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-4">On this page</div>

                <ol className="space-y-0.5 max-h-[46vh] lg:max-h-[55vh] overflow-y-auto pr-1">
                  {tocItems.map((item, index) => {
                    const isActive = activeId === item.id;
                    return (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          aria-current={isActive ? 'location' : undefined}
                          className={`group flex items-start gap-2.5 py-2 px-3 -mx-3 rounded-xl text-sm transition-colors ${
                            isActive
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-bold'
                              : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                        >
                          <span
                            className={`font-mono-code text-[11px] mt-0.5 shrink-0 ${
                              isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
                            }`}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="leading-snug">{item.label}</span>
                        </a>
                      </li>
                    );
                  })}
                </ol>

                {related.length > 0 && (
                  <div className="mt-6 pt-5 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-3">
                      Related documents
                    </div>
                    <ul className="space-y-1">
                      {related.map((doc) => (
                        <li key={doc.to}>
                          <NavLink
                            to={doc.to}
                            className="group flex items-center justify-between gap-2 py-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                          >
                            {doc.label}
                            <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </nav>

            {/* Document body */}
            <article className="lg:col-span-8">
              <div className="space-y-10 sm:space-y-12">
                {sections.map((section, index) => (
                  <motion.section
                    key={section.id}
                    id={section.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={
                      reduceMotion
                        ? { duration: 0.12 }
                        : { duration: 0.5, ease: [0.21, 1, 0.36, 1], delay: 0.05 }
                    }
                    className={SCROLL_MARGIN_CLASS}
                  >
                    <div className="flex items-start gap-4">
                      <span className="hidden sm:flex w-9 h-9 rounded-xl bg-zinc-950 dark:bg-zinc-800 text-white items-center justify-center shrink-0 font-mono-code text-xs font-bold">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-display text-xl sm:text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                          {section.heading}
                        </h2>

                        {section.body && (
                          <div className="mt-3 text-sm sm:text-[15px] text-zinc-600 dark:text-zinc-300 leading-relaxed space-y-3">
                            {section.body}
                          </div>
                        )}

                        {section.bullets && section.bullets.length > 0 && (
                          <ul className="mt-4 space-y-2.5">
                            {section.bullets.map((bullet, bulletIndex) => (
                              <li
                                key={bulletIndex}
                                className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-2" />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {section.blocks && section.blocks.length > 0 && (
                          <div className="mt-5 space-y-4">
                            {section.blocks.map((block, blockIndex) => (
                              <div
                                key={blockIndex}
                                className="p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl"
                              >
                                {block.label && (
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-3">
                                    {block.label}
                                  </div>
                                )}
                                <div className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed space-y-2">
                                  {block.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.section>
                ))}
              </div>

              <div className="mt-12 p-6 sm:p-7 rounded-3xl bg-zinc-950 dark:bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <div className="font-display text-base font-bold text-white">
                    Questions about this document?
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Reach the {BRAND_CONFIG.name} team through the contact page and we will explain anything here in
                    plain language.
                  </p>
                </div>
                <NavLink
                  to="contact"
                  className="shrink-0 inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all active:scale-[0.98]"
                >
                  Contact us
                </NavLink>
              </div>
            </article>
          </div>
        </div>
      </section>
    </>
  );
};
