import React, { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Eye,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  Reply,
  RotateCcw,
  Send,
  User,
} from 'lucide-react';
import { sendContactMessage, isContactFormConfigured, ContactResult } from '../../services/contact';

type Status = 'idle' | 'submitting' | 'success' | 'error';
type FieldName = 'name' | 'email' | 'subject' | 'message';
type Errors = Partial<Record<FieldName, string>>;

interface Values {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const EMPTY_VALUES: Values = { name: '', email: '', subject: '', message: '' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX = { name: 80, email: 160, subject: 120, message: 2000 } as const;

const SUBJECT_OPTIONS = [
  'Marketplace enquiry',
  'Accommodation enquiry',
  'Selling on JID',
  'Account or sign-in help',
  'Report a listing',
] as const;

const CUSTOM_SUBJECT = '__custom__';
const EASE = [0.21, 1, 0.36, 1] as const;

/** Friendly, reason-specific copy for every failure the service can report. */
const ERROR_COPY = {
  'not-configured': {
    title: 'This form isn’t ready to send yet.',
    body: 'We’re finishing the wiring behind the scenes. Please try again shortly — nothing you typed has been lost.',
  },
  invalid: {
    title: 'That message didn’t get through.',
    body: 'The messaging service flagged the submission as invalid. Please review your message and try again.',
  },
  network: {
    title: 'We couldn’t reach the messaging service.',
    body: 'Check your internet connection, then hit “Try again” — everything you typed is still here.',
  },
} as const;

const SUCCESS_STEPS = [
  { icon: Inbox, label: 'Received', sub: 'In our inbox' },
  { icon: Eye, label: 'Read', sub: 'By a real person' },
  { icon: Reply, label: 'Reply', sub: 'Within 1 working day' },
] as const;

const validate = (values: Values): Errors => {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = 'Please tell us your name.';
  if (!values.email.trim()) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(values.email.trim())) errors.email = 'That email address doesn’t look right.';
  if (!values.subject.trim()) errors.subject = 'Please choose or enter a subject.';
  if (!values.message.trim()) errors.message = 'Please add a short message so we can help.';
  else if (values.message.trim().length < 10) errors.message = 'A little more detail helps us reply faster.';
  return errors;
};

export const ContactForm: React.FC = () => {
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  // Honeypot: real visitors never fill this, so it is our cheapest spam filter.
  const [website, setWebsite] = useState('');
  // Why the last attempt failed (so the error card can explain itself precisely).
  const [errorReason, setErrorReason] = useState<Exclude<ContactResult, { ok: true }>['reason'] | null>(null);
  // Snapshot of the submitted subject, kept so the success card can recap it
  // after the form fields are cleared.
  const [lastSubject, setLastSubject] = useState('');
  const reduceMotion = useReducedMotion();

  // The endpoint comes from the environment. If it is missing we say so plainly
  // instead of pretending the message went somewhere.
  const isConfigured = isContactFormConfigured();
  const isSubmitting = status === 'submitting';

  const transition = useMemo(
    () => (reduceMotion ? { duration: 0.12 } : { duration: 0.36, ease: EASE }),
    [reduceMotion]
  );

  const setField = useCallback(
    (field: FieldName, value: string) => {
      const next = { ...values, [field]: value };
      setValues(next);
      // Re-validate live only once a field has been blurred, so nobody is
      // shouted at while still typing their first character.
      if (touched[field]) setErrors(validate(next));
      if (status === 'error') {
        setStatus('idle');
        setErrorReason(null);
      }
    },
    [values, touched, status]
  );

  const blurField = useCallback(
    (field: FieldName) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      setErrors(validate(values));
    },
    [values]
  );

  const submit = useCallback(async () => {
    if (isSubmitting) return;
    if (website) return; // silently drop bots

    // Even without config, clicking must never be a dead button: explain why.
    if (!isConfigured) {
      setErrorReason('not-configured');
      setStatus('error');
      return;
    }

    const nextErrors = validate(values);
    setTouched({ name: true, email: true, subject: true, message: true });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus('submitting');
    setErrorReason(null);
    const result = await sendContactMessage(values);

    if (result.ok) {
      setLastSubject(values.subject.trim());
      setStatus('success');
      setValues(EMPTY_VALUES);
      setErrors({});
      setTouched({});
      setIsCustomSubject(false);
    } else {
      // Everything the visitor typed is deliberately kept so retrying is lossless.
      setErrorReason(result.reason);
      setStatus('error');
    }
  }, [isSubmitting, isConfigured, values, website]);

  const reset = () => {
    setStatus('idle');
    setValues(EMPTY_VALUES);
    setErrors({});
    setTouched({});
    setIsCustomSubject(false);
    setErrorReason(null);
  };

  const fieldClass = (field: FieldName) =>
    [
      'w-full pl-11 pr-4 py-3.5 rounded-2xl text-sm text-zinc-900 dark:text-zinc-100',
      'bg-white dark:bg-zinc-900/80 border transition-all duration-200',
      'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
      'focus:outline-none focus:ring-4',
      errors[field] && touched[field]
        ? 'border-rose-400 dark:border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/15'
        : 'border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-emerald-500/15',
      isSubmitting ? 'opacity-60' : '',
      'disabled:cursor-not-allowed',
    ].join(' ');

  const labelClass =
    'block text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-2';
  const errorId = (field: FieldName) => `contact-${field}-error`;
  const hasError = (field: FieldName) => Boolean(errors[field] && touched[field]);

  const subjectSelectValue = isCustomSubject
    ? CUSTOM_SUBJECT
    : values.subject
      ? (SUBJECT_OPTIONS as readonly string[]).includes(values.subject)
        ? values.subject
        : CUSTOM_SUBJECT
      : '';

  return (
    <div className="relative">
      {/* Brand halo — keeps the card feeling like JID, not a generic form box */}
      <div className="absolute -inset-4 bg-emerald-500/10 dark:bg-emerald-500/15 blur-3xl rounded-[2rem] pointer-events-none" />

      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[1.75rem] shadow-2xl shadow-zinc-900/5 dark:shadow-black/30 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {status === 'success' ? (
            /* ------------------------------ SUCCESS ------------------------------ */
            <motion.div
              key="success"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 14, scale: reduceMotion ? 1 : 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : -10, scale: reduceMotion ? 1 : 0.99 }}
              transition={transition}
              className="px-6 sm:px-10 py-14 sm:py-16 text-center"
              role="status"
              aria-live="polite"
            >
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-xl scale-125" aria-hidden="true" />
                <motion.div
                  initial={reduceMotion ? undefined : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={reduceMotion ? { duration: 0.12 } : { duration: 0.5, ease: EASE, delay: 0.05 }}
                  className="relative w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30"
                >
                  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" aria-hidden="true">
                    <motion.path
                      d="M4.5 12.5 9.5 17.5 19.5 6.5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={reduceMotion ? undefined : { pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={reduceMotion ? { duration: 0.12 } : { duration: 0.45, ease: EASE, delay: 0.18 }}
                    />
                  </svg>
                </motion.div>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white mt-6 mb-2">
                Message sent successfully.
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 max-w-sm mx-auto leading-relaxed">
                Your message is in our inbox.
              </p>
              {lastSubject.trim() && (
                <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Topic:{' '}
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">“{lastSubject}”</span>
                </p>
              )}

              <div className="mt-8 grid grid-cols-3 gap-3 max-w-md mx-auto">
                {SUCCESS_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <motion.div
                      key={step.label}
                      initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        reduceMotion
                          ? { duration: 0.12 }
                          : { duration: 0.4, ease: EASE, delay: 0.28 + index * 0.08 }
                      }
                      className="px-3 py-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800"
                    >
                      <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                      <p className="mt-2 text-[11px] font-bold text-zinc-900 dark:text-zinc-100">{step.label}</p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">{step.sub}</p>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-zinc-950 dark:bg-emerald-600 hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Send another message
                </button>
              </div>
            </motion.div>
          ) : (
            /* ------------------------ FORM / LOADING / ERROR ------------------------ */
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.99 }}
              transition={transition}
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
                noValidate
                aria-busy={isSubmitting}
                className="px-6 sm:px-10 py-8 sm:py-10 space-y-5"
              >
                <div className="flex items-center gap-2 pb-5 border-b border-zinc-100 dark:border-zinc-800">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Send us a message</h2>
                  <span className="ml-auto text-[11px] text-zinc-400">All fields required</span>
                </div>

                {/* Honeypot — off-screen and ignored by assistive tech */}
                <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    name="_gotcha"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="contact-name" className={labelClass}>
                      Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                      <input
                        id="contact-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        maxLength={MAX.name}
                        disabled={isSubmitting}
                        value={values.name}
                        onChange={(e) => setField('name', e.target.value)}
                        onBlur={() => blurField('name')}
                        placeholder="e.g. Julius Adeyemi"
                        aria-invalid={hasError('name')}
                        aria-describedby={hasError('name') ? errorId('name') : undefined}
                        className={fieldClass('name')}
                      />
                    </div>
                    {hasError('name') && (
                      <p id={errorId('name')} className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contact-email" className={labelClass}>
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                      <input
                        id="contact-email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        maxLength={MAX.email}
                        disabled={isSubmitting}
                        value={values.email}
                        onChange={(e) => setField('email', e.target.value)}
                        onBlur={() => blurField('email')}
                        placeholder="you@email.com"
                        aria-invalid={hasError('email')}
                        aria-describedby={hasError('email') ? errorId('email') : undefined}
                        className={fieldClass('email')}
                      />
                    </div>
                    {hasError('email') && (
                      <p id={errorId('email')} className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {errors.email}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-subject" className={labelClass}>
                    Subject
                  </label>
                  <select
                    id="contact-subject"
                    name="subject"
                    disabled={isSubmitting}
                    value={subjectSelectValue}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM_SUBJECT) {
                        setIsCustomSubject(true);
                        setField('subject', '');
                      } else {
                        setIsCustomSubject(false);
                        setField('subject', e.target.value);
                      }
                    }}
                    onBlur={() => blurField('subject')}
                    aria-invalid={hasError('subject')}
                    aria-describedby={hasError('subject') ? errorId('subject') : undefined}
                    className={`${fieldClass('subject')} cursor-pointer appearance-none ${
                      subjectSelectValue ? '' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    <option value="">Choose a topic…</option>
                    {SUBJECT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                    <option value={CUSTOM_SUBJECT}>Something else…</option>
                  </select>

                  {/* Free-text escape hatch so a visitor is never trapped by presets */}
                  {isCustomSubject && (
                    <input
                      type="text"
                      aria-label="Your subject"
                      maxLength={MAX.subject}
                      disabled={isSubmitting}
                      value={values.subject}
                      onChange={(e) => setField('subject', e.target.value)}
                      onBlur={() => blurField('subject')}
                      placeholder="Type your subject"
                      className={`${fieldClass('subject')} !pl-4 mt-3`}
                    />
                  )}

                  {hasError('subject') && (
                    <p id={errorId('subject')} className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {errors.subject}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="contact-message" className={labelClass}>
                      Message
                    </label>
                    <span className="text-[11px] text-zinc-400 tabular-nums">
                      {values.message.length}/{MAX.message}
                    </span>
                  </div>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={5}
                    maxLength={MAX.message}
                    disabled={isSubmitting}
                    value={values.message}
                    onChange={(e) => setField('message', e.target.value)}
                    onBlur={() => blurField('message')}
                    placeholder="Tell us what you need — listing details, a lodge question, or how selling on JID works."
                    aria-invalid={hasError('message')}
                    aria-describedby={hasError('message') ? errorId('message') : undefined}
                    className={`${fieldClass('message')} resize-y min-h-[128px]`}
                  />
                  {hasError('message') && (
                    <p id={errorId('message')} className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {errors.message}
                    </p>
                  )}
                </div>

                {/* Failure state — friendly copy only, never a raw provider error */}
                <AnimatePresence initial={false}>
                  {status === 'error' && (
                    <motion.div
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto', y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                      transition={transition}
                      className="overflow-hidden"
                      role="alert"
                    >
                      <div className="rounded-2xl border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/30 p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-rose-900 dark:text-rose-200">
                              {ERROR_COPY[errorReason ?? 'network'].title}
                            </p>
                            <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-1 leading-relaxed">
                              {ERROR_COPY[errorReason ?? 'network'].body}
                            </p>
                            <button
                              type="button"
                              onClick={() => void submit()}
                              className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Try again
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Sending state — unmistakable loading while the request is in flight */}
                <AnimatePresence initial={false}>
                  {isSubmitting && (
                    <motion.div
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto', y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }}
                      transition={transition}
                      className="overflow-hidden"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 p-4 sm:p-5">
                        <div className="flex items-center gap-3">
                          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                              Sending your message…
                            </p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300/80 mt-0.5">
                              This usually takes a few seconds.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden" aria-hidden="true">
                          <motion.div
                            className="h-full bg-emerald-500"
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ duration: 0.9, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.5 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isConfigured && status !== 'error' && (
                  <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
                    Direct messaging is temporarily unavailable while we finish wiring this form up. Please try again
                    shortly.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <span>Send message</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Indeterminate progress hairline while the request is in flight */}
        <AnimatePresence>
          {isSubmitting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden bg-emerald-100 dark:bg-emerald-950"
              aria-hidden="true"
            >
              <motion.div
                className="h-full w-1/3 bg-emerald-500"
                animate={reduceMotion ? { opacity: 0.7 } : { x: ['-120%', '420%'] }}
                transition={
                  reduceMotion
                    ? { duration: 0.12 }
                    : { duration: 0.9, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.15 }
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
