import React from 'react';
import { ShieldCheck, Sparkles, Check, AlertCircle } from 'lucide-react';
import { ScrollReveal } from './ScrollReveal';
import { motion } from 'motion/react';

export const SocialProofSection: React.FC = () => {
  return (
    <section className="py-20 sm:py-24 bg-white dark:bg-[#0E0F15] border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Statement Banner */}
        <ScrollReveal>
          <div className="bg-zinc-950 dark:bg-zinc-900 text-white rounded-3xl border border-zinc-900 dark:border-zinc-800 p-8 sm:p-14 shadow-xl mb-12 relative overflow-hidden transition-colors">
            <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-950/80 border border-orange-800/80 text-orange-400 text-xs font-semibold mb-4">
              <span>DECLARATION OF PURPOSE</span>
            </div>

            <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-6">
              Built for OAU students.
            </h2>

            <p className="text-base sm:text-xl text-zinc-300 leading-relaxed max-w-3xl font-light">
              We are not building another generic classifieds site. Every single interaction of JID is designed around how student life actually happens in Ile-Ife: the halls of residence, off-campus lodges in Asherifa, daily commutes from Mayfair, and daylight handovers at the campus center.
            </p>

            <div className="mt-8 pt-6 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-zinc-300 font-medium">Independent Student Platform</span>
              </span>
              <span>Great Ife &bull; Ile-Ife, Osun State</span>
            </div>

          </div>
        </ScrollReveal>

        {/* The Campus Reality Grid: WhatsApp vs JID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Old Way */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, ease: [0.21, 1, 0.36, 1] }}
            className="bg-zinc-50/80 dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8 transition-colors"
          >
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold uppercase tracking-wider mb-4">
                <AlertCircle className="w-4 h-4" />
                <span>The Current Campus Friction</span>
              </div>

              <h3 className="font-display text-xl font-bold text-zinc-900 dark:text-white mb-4">
                What students deal with every semester
              </h3>

              <ul className="space-y-3.5 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-600 dark:text-rose-400 font-bold mt-0.5">&times;</span>
                  <span>Scrolling through 80+ WhatsApp statuses hoping to find a working mini-fridge or textbook.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-600 dark:text-rose-400 font-bold mt-0.5">&times;</span>
                  <span>Paying ₦5,000 to ₦10,000 non-refundable "inspection form" fees to agents just to see a single room in Asherifa.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-600 dark:text-rose-400 font-bold mt-0.5">&times;</span>
                  <span>"DM for price" games that waste hours of your precious study time.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-rose-600 dark:text-rose-400 font-bold mt-0.5">&times;</span>
                  <span>Trying to verify whether an online seller is actually an OAU student or a stranger off-campus.</span>
                </li>
              </ul>
            </motion.div>

            {/* The JID Way */}
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: 0.12, ease: [0.21, 1, 0.36, 1] }}
              className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8 shadow-md transition-colors"
            >
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
                <ShieldCheck className="w-4 h-4" />
                <span>The JID Standard</span>
              </div>

              <h3 className="font-display text-xl font-bold text-zinc-950 dark:text-white mb-4">
                How campus commerce should work
              </h3>

              <ul className="space-y-3.5 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Searchable directory of student items with actual specs, condition, and price in ₦.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Direct student-to-student housing listings with zero "agent form fee" extortion.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Transparent details on water (borehole), power supply, and bike distance to campus gate.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>Safe daylight meetups in recognized campus spots like SUB, Hezekiah Library, and Hall quadrangles.</span>
                </li>
              </ul>
            </motion.div>

          </div>

      </div>
    </section>
  );
};
