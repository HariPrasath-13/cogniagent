'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  Send,
  AlertCircle,
  HelpCircle,
  Loader2,
  FileText,
  CheckCircle2,
  Sparkles,
  Play,
  AlertTriangle,
  ListChecks,
  Gauge,
  RotateCcw,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  getAssessment,
  startAssessment,
  submitAssessment,
  GeneratedQuestion,
  AssessmentDetailResponse,
} from '@/lib/assessment-api';

function TestInterfaceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assessmentIdParam = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [assessment, setAssessment] = useState<AssessmentDetailResponse | null>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [deadlineTimestamp, setDeadlineTimestamp] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Single-flight lock preventing race condition between manual and auto-submit
  const hasSubmittedRef = useRef(false);
  // Keep answers ref up to date so timer callback has current values
  const answersRef = useRef<Record<string, string>>({});
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Fetch assessment details
  useEffect(() => {
    if (!assessmentIdParam) {
      setLoading(false);
      return;
    }

    const id = parseInt(assessmentIdParam);
    if (isNaN(id)) {
      setError('Invalid assessment ID.');
      setLoading(false);
      return;
    }

    getAssessment(id)
      .then((data) => {
        setAssessment(data);
        if (data.status === 'completed') {
          // Already completed, navigate directly to results
          router.replace(`/test-results?id=${data.assessment_id}`);
          return;
        }

        // Initialize answers map for questions
        const initialAnswers: Record<string, string> = {};
        data.questions.forEach((q) => {
          initialAnswers[String(q.id)] = '';
        });
        setAnswers(initialAnswers);
        answersRef.current = initialAnswers;

        // If test was already started (e.g. page refresh during active test), resume timer from server deadline
        if (data.started_at && data.deadline) {
          setDeadlineTimestamp(data.deadline);
          const nowSec = Math.floor(Date.now() / 1000);
          const remaining = Math.max(0, data.deadline - nowSec);
          setTimeLeft(remaining);
        } else {
          // Test has not started yet; set preview duration
          const duration = data.duration_minutes || 15;
          setTimeLeft(duration * 60);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load assessment.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [assessmentIdParam, router]);

  // Accurate server-synchronized deadline countdown timer
  useEffect(() => {
    if (!deadlineTimestamp || hasSubmittedRef.current) return;

    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, deadlineTimestamp - nowSec);
      setTimeLeft(remaining);

      if (remaining <= 0 && !hasSubmittedRef.current) {
        handleAutoSubmit();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineTimestamp]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? `0${m}` : m}:${s < 10 ? `0${s}` : s}`;
  };

  const handleStartTest = async () => {
    if (!assessment || starting) return;
    setStarting(true);
    setError(null);

    try {
      const data = await startAssessment(assessment.assessment_id);
      setDeadlineTimestamp(data.deadline);
      const nowSec = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, data.deadline - nowSec);
      setTimeLeft(remaining);
      setAssessment((prev) =>
        prev
          ? {
              ...prev,
              started_at: data.started_at,
              deadline: data.deadline,
              duration_minutes: data.duration_minutes,
            }
          : prev
      );
    } catch (err: any) {
      setError(err.message || 'Failed to start assessment. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  const handleAnswerChange = (questionId: number, text: string) => {
    if (hasSubmittedRef.current || (deadlineTimestamp && timeLeft <= 0)) {
      return; // Locked after time expires or submission
    }
    setAnswers((prev) => ({
      ...prev,
      [String(questionId)]: text,
    }));
  };

  // Automatic submission when timer expires
  const handleAutoSubmit = async () => {
    if (hasSubmittedRef.current || !assessment) return;
    hasSubmittedRef.current = true;
    setShowConfirmModal(false);
    setIsAutoSubmitting(true);
    setSubmitError(null);

    try {
      const currentAnswers = answersRef.current;
      const response = await submitAssessment(assessment.assessment_id, currentAnswers, true);
      router.push(`/test-results?id=${response.assessment_id}&auto=1`);
    } catch (err: any) {
      setSubmitError(
        err.message || 'Auto-submit could not be saved to server. Please click Retry below.'
      );
      // Allow retry if network or AI service had temporary hiccup
      hasSubmittedRef.current = false;
      setIsAutoSubmitting(false);
    }
  };

  // Manual submission before timer expires
  const handleSubmit = async () => {
    if (hasSubmittedRef.current || !assessment) return;
    hasSubmittedRef.current = true;
    setShowConfirmModal(false);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const currentAnswers = answersRef.current;
      const response = await submitAssessment(assessment.assessment_id, currentAnswers, false);
      router.push(`/test-results?id=${response.assessment_id}`);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit assessment. Please try again.');
      hasSubmittedRef.current = false;
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Loading assessment questions...
        </p>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <EmptyState
          icon={FileText}
          title={error ? 'Assessment Not Found' : 'No Active Test Selected'}
          description={
            error ||
            'Please upload a study material PDF to generate and begin an assessment test.'
          }
          actionText="Upload PDF Material"
          actionHref="/upload"
          className="py-12"
        />
      </div>
    );
  }

  // PRE-TEST OVERVIEW: Show questions overview and "Start Test" button before the countdown begins
  const isTestActive = !!assessment.started_at;

  if (!isTestActive) {
    const typeLabel =
      assessment.question_type === 'mcq'
        ? 'MCQ (Multiple Choice)'
        : assessment.question_type === 'question_answer'
        ? 'Question & Answer (Descriptive)'
        : 'Mixed Assessment';

    const diffLabel =
      (assessment.difficulty || 'medium').charAt(0).toUpperCase() +
      (assessment.difficulty || 'medium').slice(1);

    return (
      <div className="max-w-3xl mx-auto py-8 space-y-6">
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Questions Ready
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                Ready to Start Your Assessment?
              </h1>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Assessment Configuration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <span className="text-slate-500">Material:</span>
                <span className="font-bold text-slate-900 dark:text-white truncate max-w-[180px]">
                  {assessment.filename}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <span className="text-slate-500">Total Questions:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {assessment.total_questions} Questions
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <span className="text-slate-500">Question Format:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {typeLabel}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <span className="text-slate-500">Difficulty:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {diffLabel}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 sm:col-span-2">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Allocated Test Duration:
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {assessment.duration_minutes || 15} Minutes
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-100/60 dark:border-indigo-900/40">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Important Instructions:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>The countdown timer starts only when you click <strong>Start Test Now</strong>.</li>
              <li>Your remaining time is tracked securely on the server.</li>
              <li>When time expires, your answers will be <strong>automatically submitted</strong>.</li>
              <li>You may also submit anytime before the deadline using the Submit button.</li>
            </ul>
          </div>

          <div className="pt-2 flex items-center justify-between gap-4">
            <Link
              href="/upload"
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Back to Upload
            </Link>

            <button
              type="button"
              disabled={starting}
              onClick={handleStartTest}
              className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer transition-all"
            >
              {starting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Starting Test...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Test Now ({assessment.duration_minutes || 15} Mins)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE TEST VIEW
  const questions = assessment.questions || [];
  const currentQ = questions[currentQIndex] || questions[0];
  const currentAnswer = answers[String(currentQ?.id)] || '';
  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length;
  const isOneMinuteWarning = timeLeft > 0 && timeLeft <= 60;
  const isTimeExpired = timeLeft <= 0;
  const isInputsLocked = isTimeExpired || submitting || isAutoSubmitting;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1-Minute Warning Banner */}
      {isOneMinuteWarning && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-2.5 animate-pulse">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            ⚠️ Warning: Less than 1 minute remaining! Your assessment answers will be automatically submitted when time expires.
          </span>
        </div>
      )}

      {/* Submission Error Banner with Retry */}
      {submitError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{submitError}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Submission</span>
          </button>
        </div>
      )}

      {/* Top Header & Status Bar */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate max-w-sm sm:max-w-md">
              {assessment.filename}
            </h1>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              AI Assessment
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Answer the questions generated from your uploaded document.
          </p>
        </div>

        {/* Live Countdown Timer */}
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-sm sm:text-base shrink-0 transition-all ${
            isOneMinuteWarning
              ? 'bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 animate-pulse ring-2 ring-rose-400/30'
              : 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-400'
          }`}
        >
          <Clock className={`w-4 h-4 ${isOneMinuteWarning ? 'text-rose-600' : 'animate-pulse'}`} />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Question Selector Palette */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-2">
          {questions.map((q, idx) => {
            const hasAnswer = (answers[String(q.id)] || '').trim().length > 0;
            const isCurrent = currentQIndex === idx;

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentQIndex(idx)}
                className={`w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900 shadow-xs'
                    : hasAnswer
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 shrink-0 font-medium">
          Answered <span className="font-bold text-emerald-600">{answeredCount}</span> of{' '}
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {questions.length}
          </span>
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs min-h-[460px] flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Question {currentQIndex + 1} of {questions.length}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {currentQ?.type === 'mcq'
                ? 'Multiple Choice (MCQ)'
                : 'Descriptive • Evaluated by AI'}
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed mb-6">
            {currentQ?.question}
          </h2>

          {/* Conditional Input Control: MCQ Options or Textarea */}
          {currentQ?.type === 'mcq' && currentQ?.options && currentQ.options.length > 0 ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Your Answer:
              </label>
              <div className="space-y-2.5">
                {currentQ.options.map((opt, optIdx) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const isSelected = currentAnswer === letter;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={isInputsLocked}
                      onClick={() => handleAnswerChange(currentQ.id, letter)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/40 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {letter}
                      </div>
                      <div className="flex-1 text-xs sm:text-sm text-slate-800 dark:text-slate-200 pt-1 leading-relaxed">
                        {opt.replace(/^[A-Da-d][\).\:\-]\s*/, '')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Student Answer Textarea */
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Your Answer:
              </label>
              <textarea
                rows={7}
                disabled={isInputsLocked}
                value={currentAnswer}
                onChange={(e) => handleAnswerChange(currentQ.id, e.target.value)}
                placeholder="Type your explanation or answer based on the document..."
                className="w-full p-4 text-xs sm:text-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-y disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Be thorough. The AI rubric checks for key concepts and details.</span>
                <span>{currentAnswer.length} / 5000 characters</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation & Submit */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800 mt-8">
          <button
            type="button"
            disabled={currentQIndex === 0}
            onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-3">
            {currentQIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 cursor-pointer"
              >
                <span>Next Question</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isInputsLocked}
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Assessment</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation & Submission Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Ready to Submit?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              You have answered <span className="font-bold text-emerald-600">{answeredCount}</span> of{' '}
              <span className="font-bold">{questions.length}</span> questions.
              {answeredCount < questions.length && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400 font-semibold">
                  ⚠️ Some questions have not been answered yet. Unanswered questions will receive 0 marks.
                </span>
              )}
            </p>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Continue Reviewing
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm &amp; Submit</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Submit / Manual-Submit Loading Overlay */}
      {(submitting || isAutoSubmitting) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm text-white space-y-4 p-6 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
          <div className="space-y-1 max-w-md">
            <h3 className="text-lg sm:text-xl font-bold">
              {isAutoSubmitting ? 'Time is up! Submitting Assessment...' : 'Submitting Assessment...'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              {isAutoSubmitting
                ? 'Your time expired. Your current answers have been submitted automatically.'
                : 'Evaluating your answers with AI and recording your results.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TestInterfacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      }
    >
      <TestInterfaceInner />
    </Suspense>
  );
}
