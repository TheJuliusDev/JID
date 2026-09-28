import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, AtSign, Check, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, User, X } from 'lucide-react';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';

export type AuthMode = 'login' | 'signup' | 'forgot';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const LEVELS = ['100L', '200L', '300L', '400L', '500L', '600L', 'Postgraduate', 'Alumnus'];
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

interface AuthFormProps {
  initialMode: AuthMode;
  /** Called after a successful login or signup (close the modal / leave the page). */
  onAuthenticated: () => void;
  /** Allow switching between sign in and sign up in place. */
  showModeTabs?: boolean;
  className?: string;
}

/**
 * The sign in / sign up / password reset form, shared by the auth modal and the
 * dedicated /login and /signup pages so the behaviour only exists once.
 */
export const AuthForm: React.FC<AuthFormProps> = ({
  initialMode,
  onAuthenticated,
  showModeTabs = false,
  className = '',
}) => {
  const { login, signup, resetPassword, checkUsername } = useAuth();

  const [mode, setMode] = useState<AuthMode>(initialMode);
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

  // A page-level form should follow the URL it was opened at.
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

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
        else onAuthenticated();
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
          onAuthenticated();
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

  if (confirmSent) {
    return (
      <div className={`text-center py-6 ${className}`}>
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto mb-5">
          <MailCheck className="w-8 h-8" />
        </div>
        <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white">Confirm your email</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-2 leading-relaxed">
          We’ve sent a confirmation link to <strong className="text-zinc-800 dark:text-zinc-200">{email}</strong>.
          Click it to activate your account, then come back and sign in.
        </p>
        <button
          onClick={() => {
            setConfirmSent(false);
            setMode('login');
          }}
          className="mt-6 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow cursor-pointer"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  const tabClass = (active: boolean) =>
    `text-sm font-bold pb-1 transition-all ${
      active ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
    }`;

  return (
    <div className={className}>
      {showModeTabs && (
        <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-6">
          <button type="button" onClick={() => setMode('login')} className={tabClass(mode === 'login')}>
            Sign In
          </button>
          <button type="button" onClick={() => setMode('signup')} className={tabClass(mode === 'signup')}>
            Create Account
          </button>
        </div>
      )}

      {mode === 'forgot' && (
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Enter your email and we’ll send you a link to reset your password.
        </p>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900"
        >
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
              <label
                htmlFor="auth-fullName"
                className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1"
              >
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  id="auth-fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Julius Adeyemi"
                  autoComplete="name"
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-username"
                className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1"
              >
                Username *
              </label>
              <div className="relative">
                <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  id="auth-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_handle"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 lowercase focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
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
          <label
            htmlFor="auth-email"
            className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1"
          >
            Email Address *
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              autoCapitalize="none"
              autoComplete="email"
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
            />
          </div>
        </div>

        {mode !== 'forgot' && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="auth-password"
                className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider"
              >
                Password *
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full pl-10 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
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
              <label
                htmlFor="auth-department"
                className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1"
              >
                Department
              </label>
              <input
                id="auth-department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Mechanical Eng"
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label
                htmlFor="auth-level"
                className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1"
              >
                Level
              </label>
              <select
                id="auth-level"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
              >
                <option value="">—</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="auth-hall"
                className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-1"
              >
                Hall / Area
              </label>
              <select
                id="auth-hall"
                value={hallOrArea}
                onChange={(e) => setHallOrArea(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
              >
                <option value="">—</option>
                {BRAND_CONFIG.campusLocations.halls.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
                {BRAND_CONFIG.campusLocations.offCampusAreas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
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
            onClick={() => setMode('login')}
            className="w-full text-center text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            &larr; Back to sign in
          </button>
        )}
      </form>
    </div>
  );
};
