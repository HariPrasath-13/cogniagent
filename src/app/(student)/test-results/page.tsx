'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Trophy,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  RotateCcw,
  LayoutDashboard,
  Bot,
  Loader2,
  Sparkles,
  Info,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  getAssessment,
  getAssessmentHistory,
  AssessmentDetailResponse,
  QuestionEvaluation,
} from '@/lib/assessment-api';

function TestResultsInner() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessmentDetailResponse | null>(null);
  const [filter, setFilter] = useState<'all' | 'high' | 'low'>('all');

  useEffect(() => {
    async function loadData() {
      try {
        if (idParam) {
          const id = parseInt(idParam);
          if (!isNaN(id)) {
            const data = await getAssessment(id);
            setAssessment(data);
            return;
          }
        }

        // If no ID provided in query params, fetch most recent completed test from history
        const { history } = await getAssessmentHistory();
        const completed = history.filter((h) => h.status === 'completed');
        if (completed.length > 0) {
          const latest = completed[0];
          const data = await getAssessment(latest.id);
          setAssessment(data);
        } else {
          setAssessment(null);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load test results.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [idParam]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Loading assessment results...
        </p>
      </div>
    );
  }

  if (error || !assessment || assessment.status !== 'completed' || !assessment.results) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          Test Results &amp; Evaluation
        </h1>
        <EmptyState
          icon={Award}
          title="No Assessment Results Available"
          description={
            error ||
            'You have not completed any assessments yet. Upload a PDF study material to test your knowledge.'
          }
          actionText="Upload Study Material"
          actionHref="/upload"
          className="py-16"
        />
      </div>
    );
  }

  const results = assessment.results;
  const overallScore = assessment.score ?? 0;

  const filteredResults = results.filter((item) => {
    if (filter === 'high') return item.score >= 70;
    if (filter === 'low') return item.score < 70;
    return true;
  });

  const isAutoSubmitted =
    searchParams.get('auto') === '1' || Boolean(assessment.auto_submitted);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Auto-submission notification */}
      {isAutoSubmitted && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/80 text-amber-900 dark:text-amber-200 flex items-center gap-3 shadow-xs">
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-xs sm:text-sm font-bold">
              Time is up. Your assessment has been submitted automatically.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Your answers were safely saved and evaluated by AI.
            </p>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Assessment Results &amp; Feedback
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Document: <span className="font-semibold text-slate-800 dark:text-slate-200">{assessment.filename}</span>
          </p>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Evaluation</span>
        </div>
      </div>

      {/* Summary Score Metric Card */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Overall Percentage */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {overallScore}%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Overall AI Score
              </p>
            </div>
          </div>

          {/* Total Questions Evaluated */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                {assessment.total_questions}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Questions Assessed
              </p>
            </div>
          </div>

          {/* Performance Tier */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-900/40">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-base font-extrabold text-sky-600 dark:text-sky-400">
                {overallScore >= 80 ? 'Mastery' : overallScore >= 60 ? 'Competent' : 'Needs Review'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Performance Status
              </p>
            </div>
          </div>
        </div>

        {/* AI Disclaimer Alert */}
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-[11px] text-slate-500 dark:text-slate-400">
          <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
          <span>
            <strong>Educational AI Notice:</strong> Scores, feedback, and key points are generated automatically by AI based exclusively on the uploaded document text.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Upload Another Document</span>
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <Link
            href="/ai-tutor"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold hover:bg-purple-100"
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Review with AI Tutor</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All Questions ({results.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('high')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            filter === 'high'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Score &ge; 70% ({results.filter((q) => q.score >= 70).length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('low')}
          className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
            filter === 'low'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Needs Review (&lt; 70%) ({results.filter((q) => q.score < 70).length})
        </button>
      </div>

      {/* Question Review Cards */}
      <div className="space-y-4">
        {filteredResults.map((item) => (
          <div
            key={item.question_id}
            className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4"
          >
            {/* Header with question number and score badge */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Question {item.question_id}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                  item.score >= 70
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                }`}
              >
                {item.score >= 70 ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                <span>Score: {item.score} / 100</span>
              </span>
            </div>

            {/* Question Text */}
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug">
              {item.question}
            </h3>

            {/* Student's Answer */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Your Answer:
              </p>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {item.your_answer || <span className="italic text-slate-400">No answer submitted.</span>}
              </p>
            </div>

            {/* Reference Answer */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50">
              <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                Document Reference Answer:
              </p>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {item.reference_answer}
              </p>
            </div>

            {/* Feedback & Rubric Points */}
            <div className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-3">
              <div>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  AI Evaluator Feedback:
                </p>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">
                  {item.feedback || 'Answer evaluated.'}
                </p>
              </div>

              {/* Correct Points Covered */}
              {item.correct_points && item.correct_points.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mb-1">
                    <Check className="w-3 h-3" />
                    <span>Points Correctly Covered:</span>
                  </p>
                  <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-0.5 pl-1">
                    {item.correct_points.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Points */}
              {item.missing_points && item.missing_points.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Key Missing Points / Room for Improvement:</span>
                  </p>
                  <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-0.5 pl-1">
                    {item.missing_points.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TestResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      }
    >
      <TestResultsInner />
    </Suspense>
  );
}
