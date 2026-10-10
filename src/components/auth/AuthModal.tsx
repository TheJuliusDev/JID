import React from 'react';
import { X, Check, ShieldCheck, Zap } from 'lucide-react';
import { BRAND_CONFIG } from '../../config/brand';
import { Modal } from '../ui';
import { AuthForm, AuthMode } from './AuthForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => (
  <Modal
    open={isOpen}
    onClose={onClose}
    size="xl"
    ariaLabel={`${initialMode === 'signup' ? 'Create account' : 'Sign in'} on ${BRAND_CONFIG.name}`}
    panelClassName="bg-white dark:bg-zinc-900"
    scrimClassName="bg-black/80 backdrop-blur-md"
  >
    <div className="relative w-full grid grid-cols-1 md:grid-cols-12 min-h-[560px]">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* LEFT: brand panel */}
      <div className="md:col-span-5 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white p-8 flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-zinc-800">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-6 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              {BRAND_CONFIG.name} • {BRAND_CONFIG.institution.sobriquet}
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl sm:text-4xl font-black font-display tracking-tight leading-tight">
              Your campus.
              <br />
              <span className="text-emerald-500">One marketplace.</span>
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed pt-1">
              Buy, sell, and find trusted off-campus accommodation across Obafemi Awolowo University.
            </p>
          </div>
        </div>

        <div className="space-y-3 py-6 relative z-10 text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>Direct student-to-student handover</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>Water &amp; power transparency for every lodge</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>Free ad-powered boosts — no cash required</span>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 relative z-10">
          Any valid email works — you don’t need an OAU address to join.
        </p>
      </div>

      {/* RIGHT: form */}
      <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white dark:bg-zinc-900">
        <AuthForm
          key={initialMode}
          initialMode={initialMode}
          onAuthenticated={onClose}
          showModeTabs
        />

        <div className="pt-6 text-center text-[11px] text-zinc-400">
          By continuing, you agree to the {BRAND_CONFIG.name} campus honor code and safety standards.
        </div>
      </div>
    </div>
  </Modal>
);
