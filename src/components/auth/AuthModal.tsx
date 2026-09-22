import React, { useState } from 'react';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Sparkles, 
  ArrowRight, 
  Check, 
  GraduationCap, 
  MapPin, 
  ShieldCheck, 
  Zap 
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup' | 'forgot';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login'
}) => {
  if (!isOpen) return null;

  const { login, signup, resetPassword, switchDemoUser, isDemoMode } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [level, setLevel] = useState('300L');
  const [hallOrArea, setHallOrArea] = useState(BRAND_CONFIG.campusLocations.halls[0]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (!res.success) {
          setErrorMsg(res.error || 'Invalid credentials');
        } else {
          onClose();
        }
      } else if (mode === 'signup') {
        const res = await signup({
          fullName,
          email,
          department,
          level,
          hallOrArea,
          password
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to create account');
        } else {
          onClose();
        }
      } else if (mode === 'forgot') {
        const res = await resetPassword(email);
        setSuccessMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemoLogin = (role: 'julius' | 'praise' | 'admin') => {
    switchDemoUser(role);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-8 grid grid-cols-1 md:grid-cols-12 min-h-[580px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full bg-zinc-100 dark:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LEFT COLUMN: Editorial Campus Brand Statement */}
        <div className="md:col-span-5 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white p-8 flex flex-col justify-between relative overflow-hidden border-b md:border-b-0 md:border-r border-zinc-800">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-600" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                {BRAND_CONFIG.name} • {BRAND_CONFIG.institution.sobriquet}
              </span>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl sm:text-4xl font-black font-display tracking-tight leading-tight">
                Your campus.
                <br />
                <span className="text-orange-500">One marketplace.</span>
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed pt-1">
                Buy, sell, and discover verified off-campus accommodation across Obafemi Awolowo University.
              </p>
            </div>
          </div>

          {/* Value Props checklist */}
          <div className="space-y-3 py-6 relative z-10 text-xs text-zinc-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span>Direct student-to-student handover</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span>Borehole & power transparency for lodges</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span>Voluntary ad-boost system (no cash required)</span>
            </div>
          </div>

          {/* Quick Demo Switcher Pill */}
          <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm space-y-1.5 relative z-10 text-[11px]">
            <p className="font-bold text-orange-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Instant Demo Sign-in
            </p>
            <p className="text-zinc-400 text-[10px]">
              No password needed for testing:
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('julius')}
                className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold text-[10px] transition-colors"
              >
                Julius (Student)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('praise')}
                className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold text-[10px] transition-colors"
              >
                Praise (Seller)
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Authentication Form */}
        <div className="md:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white dark:bg-zinc-900">
          <div>
            {/* Tab switch */}
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-6">
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`text-sm font-bold pb-1 transition-all ${
                  mode === 'login'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
                className={`text-sm font-bold pb-1 transition-all ${
                  mode === 'signup'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl border border-emerald-200 dark:border-emerald-900">
                {successMsg}
              </div>
            )}

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Julius Adeyemi"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@oauife.edu.ng or personal email"
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                      Password *
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Extra Campus Details on Sign Up */}
              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Mechanical Eng"
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                      Hall / Area
                    </label>
                    <select
                      value={hallOrArea}
                      onChange={(e) => setHallOrArea(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs"
                    >
                      {BRAND_CONFIG.campusLocations.halls.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                      {BRAND_CONFIG.campusLocations.offCampusAreas.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
              >
                {isSubmitting ? (
                  <span>Processing...</span>
                ) : (
                  <>
                    <span>
                      {mode === 'login' && 'Sign In to Campus'}
                      {mode === 'signup' && 'Create Student Account'}
                      {mode === 'forgot' && 'Send Reset Link'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Google architecture placeholder button */}
            <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => handleQuickDemoLogin('julius')}
                className="w-full py-2.5 px-4 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Continue with OAU Google Account
              </button>
            </div>
          </div>

          <div className="pt-4 text-center text-[11px] text-zinc-400">
            By signing in, you agree to OAU campus marketplace honor code and safety standards.
          </div>
        </div>
      </div>
    </div>
  );
};
