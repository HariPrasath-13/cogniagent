'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { CogniLogo } from '@/components/shared/CogniLogo';
import {
  verifyRegistration,
  verifyLoginOtp,
  sendLoginOtp,
  resendOtp,
  saveSession,
} from '@/lib/auth-api';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const mode = searchParams.get('mode') || 'registration';

  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (secondsLeft > 0) {
      const timer = setInterval(() => {
        setSecondsLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [secondsLeft]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const fullOtp = otp.join('');

    if (fullOtp.length < 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (!email) {
      setError('Missing email address. Please start from the login or sign-up page.');
      return;
    }

    setLoading(true);
    try {
      let res;
      if (mode === 'login') {
        res = await verifyLoginOtp(email, fullOtp);
      } else {
        res = await verifyRegistration(email, fullOtp);
      }

      if (res.token && res.user) {
        saveSession(res.token, res.user);
      }

      setVerified(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 600);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft === 0 && email) {
      setError('');
      setInfoMessage('');
      try {
        if (mode === 'login') {
          await sendLoginOtp(email);
        } else {
          await resendOtp(email, 'registration');
        }
        setSecondsLeft(60);
        setOtp(['', '', '', '', '', '']);
        setInfoMessage('A new verification code has been dispatched. Please check your inbox.');
        inputRefs.current[0]?.focus();
      } catch (err: any) {
        setError(err.message || 'Failed to resend code. Please try again.');
      }
    }
  };

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 sm:p-10 shadow-xl border border-slate-200/80 dark:border-slate-800 text-center">
      <div className="flex justify-center mb-6">
        <CogniLogo size="md" />
      </div>

      <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-5 shadow-xs">
        <Mail className="w-8 h-8" />
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
        Verify Your Email
      </h1>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 mb-6">
        We have sent a 6-digit verification code to{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{email || 'your email'}</span>
      </p>

      {error && (
        <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 text-left">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {infoMessage && (
        <div className="mb-5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 text-left">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{infoMessage}</span>
        </div>
      )}

      <form onSubmit={handleVerify} className="space-y-6">
        {/* 6 OTP Input Boxes */}
        <div className="flex items-center justify-center gap-2 sm:gap-3">
          {otp.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className="w-11 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 focus:bg-white dark:focus:bg-slate-800 transition-all"
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={loading || verified}
          className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
        >
          {verified ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Verified! Entering Dashboard...</span>
            </>
          ) : loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Verifying Code...</span>
            </>
          ) : (
            <span>Verify</span>
          )}
        </button>
      </form>

      <div className="mt-6 text-xs text-slate-500 dark:text-slate-400 space-y-3">
        <p>
          Didn&apos;t receive the code?{' '}
          {secondsLeft > 0 ? (
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              Resend (00:{secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft})
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Resend now
            </button>
          )}
        </p>

        <div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go back</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 transition-colors">
      <Suspense fallback={<div className="text-slate-500 text-sm">Loading verification...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
