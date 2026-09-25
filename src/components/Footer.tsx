import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { BRAND_CONFIG } from '../config/brand';
import { ViewType } from '../types';

interface FooterProps {
  onNavigate: (view: ViewType) => void;
  onOpenCreate: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenCreate }) => {
  return (
    <footer className="bg-zinc-950 text-zinc-400 border-t border-zinc-900 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-zinc-900">
          
          {/* Brand & Logo */}
          <div className="md:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-display font-black text-sm shadow-sm">
                {BRAND_CONFIG.name.charAt(0)}
              </div>
              <span className="font-display text-2xl font-black tracking-tight text-white">
                {BRAND_CONFIG.name}
              </span>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
                {BRAND_CONFIG.institution.shortName} Grid
              </span>
            </div>

            <p className="text-sm text-zinc-400 max-w-sm leading-relaxed">
              The unified campus marketplace and accommodation platform built specifically for students of Obafemi Awolowo University (OAU), Ile-Ife.
            </p>

            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Built for {BRAND_CONFIG.institution.sobriquet} students.</span>
            </div>
          </div>

          {/* Campus Platform Navigation */}
          <div className="md:col-span-3 space-y-2.5 text-xs">
            <div className="text-zinc-200 uppercase font-bold tracking-wider mb-2">
              Explore Campus
            </div>
            <div>
              <button
                onClick={() => onNavigate('marketplace')}
                className="text-zinc-400 hover:text-white transition-colors block py-1 text-left cursor-pointer"
              >
                Student Marketplace
              </button>
            </div>
            <div>
              <button
                onClick={() => onNavigate('accommodation')}
                className="text-zinc-400 hover:text-white transition-colors block py-1 text-left cursor-pointer"
              >
                Off-Campus Lodges
              </button>
            </div>
            <div>
              <button
                onClick={() => onNavigate('dashboard')}
                className="text-zinc-400 hover:text-white transition-colors block py-1 text-left cursor-pointer"
              >
                Student Dashboard
              </button>
            </div>
            <div>
              <button
                onClick={onOpenCreate}
                className="text-emerald-500 font-bold hover:text-emerald-400 transition-colors block py-1 text-left cursor-pointer"
              >
                + Post an Item or Lodge
              </button>
            </div>
          </div>

          {/* Safety & OAU Landmarks */}
          <div className="md:col-span-4 space-y-3 text-xs">
            <div className="text-zinc-200 uppercase font-bold tracking-wider mb-2">
              Designated Safe Spots
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Always schedule trades in public campus landmarks during daylight:
            </p>
            <ul className="text-xs text-zinc-500 space-y-1">
              <li>• SUB Car Park & Ground Floor</li>
              <li>• Hezekiah Oluwasanmi Library Walkway</li>
              <li>• Motion Ground & Amphitheatre</li>
              <li>• Faculty of Tech Spider Web</li>
            </ul>

            <div className="pt-2">
              <span className="text-[11px] text-zinc-500">Contact: support@jidcampus.ng</span>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} {BRAND_CONFIG.name} ({BRAND_CONFIG.institution.shortName} Campus Platform). All rights reserved.
          </div>
          <div className="flex items-center gap-2">
            <span>Ile-Ife, Osun State</span>
            <span>&bull;</span>
            <span className="text-emerald-500 font-medium">{BRAND_CONFIG.institution.sobriquet}</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
