import React, { useState } from 'react';
import { MapPin, Navigation, Compass, ArrowRight, BookOpen, Building, Bed, Bike, Compass as CompassIcon } from 'lucide-react';
import { CAMPUS_ECOSYSTEM_NODES } from '../data/mockData';
import { ScrollReveal } from './ScrollReveal';
import { motion, AnimatePresence } from 'motion/react';

export const CampusLifeSection: React.FC = () => {
  const [activeNodeId, setActiveNodeId] = useState<string>('sub');

  const selectedNode = CAMPUS_ECOSYSTEM_NODES.find(n => n.id === activeNodeId) || CAMPUS_ECOSYSTEM_NODES[0];

  return (
    <section id="campus-life" className="py-20 sm:py-28 bg-[#FAFAF9] dark:bg-[#090A0F] border-b border-zinc-200/80 dark:border-zinc-800/80 relative transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <ScrollReveal>
          <div className="max-w-3xl mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-850/60 text-orange-700 dark:text-orange-400 text-xs font-semibold mb-3">
              <CompassIcon className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>THE OAU TERRITORY &middot; ILE-IFE</span>
            </div>

            <h2 className="font-display text-3xl sm:text-5xl font-black text-zinc-950 dark:text-white tracking-tight leading-tight mb-4">
              Built around student life.
            </h2>

            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Built for OAU. Designed around how students actually move between campus halls and off-campus lodges.
            </p>
          </div>
        </ScrollReveal>

        {/* Visual Matrix Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
          {/* Left: Campus Zones Matrix Card */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, ease: [0.21, 1, 0.36, 1] }}
            className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 p-6 sm:p-8 shadow-sm"
          >
            
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Campus &amp; Lodges Matrix
                </span>
              </div>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Select zone to inspect activity
              </span>
            </div>

            {/* Interactive Campus Zone Nodes */}
            <div className="space-y-2.5 mb-6">
              {CAMPUS_ECOSYSTEM_NODES.map((node) => {
                const isActive = node.id === activeNodeId;
                return (
                  <button
                    key={node.id}
                    onClick={() => setActiveNodeId(node.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start justify-between cursor-pointer ${
                      isActive
                        ? 'bg-zinc-950 dark:bg-orange-600 text-white border-zinc-950 dark:border-orange-500 shadow-md'
                        : 'bg-zinc-50/70 dark:bg-zinc-850/60 text-zinc-800 dark:text-zinc-200 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-100/80 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-orange-500 dark:bg-white' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
                        <span className="font-display text-base font-bold">
                          {node.name}
                        </span>
                      </div>
                      <div className={`text-xs ${isActive ? 'text-zinc-300 dark:text-orange-100' : 'text-zinc-500 dark:text-zinc-400'}`}>
                        {node.subtitle}
                      </div>
                    </div>

                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      isActive 
                        ? 'bg-zinc-800 dark:bg-orange-700 text-orange-400 dark:text-white border border-zinc-700 dark:border-orange-600' 
                        : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                    }`}>
                      {node.type}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Transit corridor pill */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/70 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="text-zinc-900 dark:text-white font-bold block mb-1">COMMON TRANSIT CORRIDOR:</span>
              Mayfair / Asherifa &rarr; Campus Gate &rarr; Motion Ground &rarr; SUB &rarr; Academic Quadrangle
            </div>

          </motion.div>

          {/* Right: Zone Details */}
          <div className="lg:col-span-5 space-y-6">
            
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.21, 1, 0.36, 1] }}
              className="bg-zinc-950 dark:bg-zinc-900 text-white rounded-3xl border border-zinc-900 dark:border-zinc-800 p-6 sm:p-8 shadow-xl"
            >
              <div className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">
                Zone Overview
              </div>

              <h3 className="font-display text-2xl font-bold text-white mb-2">
                {selectedNode.name}
              </h3>

              <div className="text-xs text-zinc-400 mb-5">
                Atmosphere: <span className="text-zinc-200 font-medium">{selectedNode.vibe}</span>
              </div>

              <div className="bg-zinc-900/80 dark:bg-zinc-800/80 p-4 rounded-2xl border border-zinc-800 dark:border-zinc-700 mb-5">
                <span className="text-[10px] font-semibold uppercase text-orange-400 block mb-1">
                  How Students Interact Here
                </span>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  {selectedNode.typicalActivity}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <MapPin className="w-3.5 h-3.5 text-orange-500" />
                <span>Geotagged for safe student meetups &amp; verified lodge visits</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.55, delay: 0.16, ease: [0.21, 1, 0.36, 1] }}
              className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/90 dark:border-zinc-800 p-6 shadow-sm"
            >
              <div className="font-display text-base font-bold text-zinc-900 dark:text-white mb-2">
                Why Campus Context Matters
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
                A generic classifieds site doesn't understand that a student in Fajuyi Hall needs a meetup spot at the SUB car park before 6 PM, or that "Asherifa" means calculating bike fare from the gate. JID is designed specifically for OAU geography.
              </p>
              <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 dark:text-orange-400">
                <span>Made in Ile-Ife</span>
                <span>&bull;</span>
                <span>For Great Ife</span>
              </div>
            </motion.div>

          </div>

        </div>

      </div>
    </section>
  );
};
