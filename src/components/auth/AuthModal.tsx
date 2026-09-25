import React, { useState, useEffect, useRef } from 'react';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Mail,
  Lock,
  User,
  AtSign,
  ArrowRight,
  Check,
  ShieldCheck,
  Zap,
  Loader2,
  Eye,
  EyeOff,
  MailCheck,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup' | 'forgot';
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const LEVELS = ['100L', '200L', '300L', '400L', '500L', '600L', 'Postgraduate', 'Alumnus'];
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, initialMode = 'login' }) => {
  const { login, signup, resetPassword, checkUsername } = useAuth();

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [department, setDepartment] = useState('');
  const [level, setLevel] = useState('');
  const [hallOrArea, setHallOrArea] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmSent, setConfirmSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const checkSeq = useRef(0);

  // Reset transient state whenever the modal (re)opens or the mode changes.
  useEffect(() => {
    if (isOpen) setMode(initialMode);
  }, [isOpen, initialMode]);

  useEffect(() => {
    setErrorMsg('');
    setSuccessMsg('');
    setConfirmSent(false);
  }, [mode]);

  // Live username availability check (signup only), debounced.
  useEffect(() => {
    if (mode !== 'signup') return;
    const raw = username.trim();
    if (raw.length === 0) {
      setUsernameStatus('idle');
      return;
    }
    if (!USERNAME_RE.test(raw)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const seq = ++checkSeq.current;
    const t = setTimeout(async () => {
      const available = await checkUsername(raw);
      if (seq !== checkSeq.current) return; // a newer keystroke superseded this
      setUsernameStatus(available ? 'available' : 'taken');
    }, 450);
    return () => clearTimeout(t);
  }, [username, mode, checkUsername]);

  if (!isOpen) return null;

  const validate = (): string | null => {
    if (!email.trim()) return 'Please enter your email address.';
    if (mode !== 'forgot' && password.length < 6) return 'Your password must be at least 6 characters.';
    if (mode === 'signup') {
      if (!fullName.trim()) return 'Please enter your full name.';
      if (!USERNAME_RE.test(username.trim()))
        return 'Choose a username with 3–20 letters, numbers, or underscores.';
      if (usernameStatus === 'taken') return 'That username is already taken — pick another.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const validationError = validate();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await login(email, password);
        if (!res.success) setErrorMsg(res.error || 'Could not sign you in.');
        else onClose();
      } else if (mode === 'signup') {
        const res = await signup({
          fullName,
          username: username.trim().toLowerCase(),
          email,
          password,
          department: department.trim() || undefined,
          level: level || undefined,
          hallOrArea: hallOrArea || undefined,
        });
        if (!res.success) {
          setErrorMsg(res.error || 'Could not create your account.');
        } else if (res.needsConfirmation) {
          setConfirmSent(true);
        } else {
          onClose();
        }
      } else {
        const res = await resetPassword(email);
        if (res.success) setSuccessMsg(res.message);
        else setErrorMsg(res.message);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (next: 'login' | 'signup' | 'forgot') => setMode(next);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden my-8 grid grid-cols-1 md:grid-cols-12 min-h-[560px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full bg-zinc-100/80 dark:bg-zinc-800/80 transition-colors"
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
          {confirmSent ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-8">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                <MailCheck className="w-9 h-9" />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white font-display">Confirm your email</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                We’ve sent a confirmation link to <strong className="text-zinc-800 dark:text-zinc-200">{email}</strong>.
                Click it to activate your account, then come back and sign in.
              </p>
              <button
                onClick={() => { setConfirmSent(false); setMode('login'); }}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow cursor-pointer"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <div>
              {/* Tabs */}
              <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-6">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`text-sm font-bold pb-1 transition-all ${
                    mode === 'login'
                      ? 'text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`text-sm font-bold pb-1 transition-all ${
                    mode === 'signup'
                      ? 'text-emerald-600 border-b-2 border-emerald-600'
                      : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {mode === 'forgot' && (
                <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
                  Enter your email and we’ll send you a link to reset your password.
                </p>
              )}

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

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
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
                          className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1">
                        Username *
                      </label>
                      <div className="relative">
                        <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <input
                          type="text"
                          required
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="your_handle"
                          autoCapitalize="none"
                          autoCorrect="off"
                          className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 lowercase"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}
                          {usernameStatus === 'available' && <Check className="w-4 h-4 text-emerald-500" />}
                          {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                            <X className="w-4 h-4 text-rose-500" />
                          )}
                        </div>
                      </div>
                      {usernameStatus === 'invalid' && (
                        <p className="mt-1 text-[11px] text-rose-500">3–20 letters, numbers, or underscores.</p>
                      )}
                      {usernameStatus === 'taken' && (
                        <p className="mt-1 text-[11px] text-rose-500">That username is taken — try another.</p>
                      )}
                      {usernameStatus === 'available' && (
                        <p className="mt-1 text-[11px] text-emerald-500">Nice — that username is available.</p>
                      )}
                    </div>
                  </>
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
                      placeholder="you@email.com"
                      autoCapitalize="none"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100"
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
                          onClick={() => switchMode('forgot')}
                          className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                        className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'signup' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Department
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Mechanical Eng"
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Level
                      </label>
                      <select
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">—</option>
                        {LEVELS.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                        Hall / Area
                      </label>
                      <select
                        value={hallOrArea}
                        onChange={(e) => setHallOrArea(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">—</option>
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
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Please wait…</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {mode === 'login' && 'Sign in'}
                        {mode === 'signup' && 'Create account'}
                        {mode === 'forgot' && 'Send reset link'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {mode === 'forgot' && (
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full text-center text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  >
                    ← Back to sign in
                  </button>
                )}
              </form>
            </div>
          )}

          <div className="pt-6 text-center text-[11px] text-zinc-400">
            By continuing, you agree to the {BRAND_CONFIG.name} campus honor code and safety standards.
          </div>
        </div>
      </div>
    </div>
  );
};
