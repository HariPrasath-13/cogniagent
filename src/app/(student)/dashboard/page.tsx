'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  BookOpen,
  Award,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Play,
  FileText,
  Upload,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { MetricCard } from '@/components/student/MetricCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { useTheme } from '@/components/shared/ThemeProvider';
import { getSession } from '@/lib/auth-api';
import { getAssessmentHistory, AssessmentHistoryItem } from '@/lib/assessment-api';

export default function StudentDashboardPage() {
  const { theme } = useTheme();
  const [userName, setUserName] = useState('Student');
  const [history, setHistory] = useState<AssessmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { user } = getSession();
    if (user && user.name) {
      setUserName(user.name);
    }

    getAssessmentHistory()
      .then((data) => {
        setHistory(data.history || []);
      })
      .catch(() => {
        setHistory([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const completedTests = history.filter((h) => h.status === 'completed');
  const scores = completedTests.map((h) => h.score).filter((s): s is number => s !== null);

  const avgScore =
    scores.length > 0
      ? `${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%`
      : '--%';

  const testsCount = completedTests.length;
  const learningMinutes = testsCount * 15;
  const learningHoursText =
    learningMinutes >= 60
      ? `${(learningMinutes / 60).toFixed(1)} hrs`
      : `${learningMinutes} mins`;

  const hasData = history.length > 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>
              {theme === 'dark' ? `Good Evening, ${userName}! 🌙` : `Good Morning, ${userName}! 👋`}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {hasData
              ? 'Here is your current learning progress and test history'
              : 'Welcome to CogniAgent! Upload a document to start your learning journey'}
          </p>
        </div>

        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload PDF Material</span>
        </Link>
      </div>

      {/* Row 1: 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <MetricCard
          label="Average Score"
          value={avgScore}
          subtitle={scores.length > 0 ? `Across ${scores.length} test(s)` : 'No tests taken yet'}
          icon={Award}
          variant="emerald"
          isEmpty={scores.length === 0}
        />
        <MetricCard
          label="Tests Completed"
          value={String(testsCount)}
          subtitle={testsCount > 0 ? 'Evaluated with AI' : 'Ready to start'}
          icon={CheckCircle2}
          variant="purple"
          isEmpty={testsCount === 0}
        />
        <MetricCard
          label="Study Documents"
          value={String(history.length)}
          subtitle={history.length > 0 ? 'Custom materials' : 'No documents uploaded'}
          icon={BookOpen}
          variant="amber"
          isEmpty={history.length === 0}
        />
        <MetricCard
          label="Learning Time"
          value={testsCount > 0 ? learningHoursText : '0 mins'}
          subtitle={testsCount > 0 ? 'Total assessment time' : 'Start your first session'}
          icon={Clock}
          variant="blue"
          isEmpty={testsCount === 0}
        />
      </div>

      {/* Row 2: Assessment History & Recent Activity */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Recent Assessments
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              History of tests generated and evaluated for your account
            </p>
          </div>
          <Link
            href="/upload"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>New test</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="No Assessments Yet"
            description="Your assessment history is completely fresh. Upload a PDF textbook or notes to generate your first test."
            actionText="Upload PDF &amp; Take Test"
            actionHref="/upload"
            className="py-12"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="pb-3 font-semibold">Document</th>
                  <th className="pb-3 font-semibold">Questions</th>
                  <th className="pb-3 font-semibold">Score</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="truncate max-w-[200px] sm:max-w-xs">{item.pdf_name}</span>
                    </td>
                    <td className="py-3.5 text-slate-600 dark:text-slate-400">
                      {item.total_questions}
                    </td>
                    <td className="py-3.5 font-bold">
                      {item.score !== null ? (
                        <span
                          className={
                            item.score >= 70
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {item.score}%
                        </span>
                      ) : (
                        <span className="text-slate-400">--</span>
                      )}
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td className="py-3.5 text-right">
                      <Link
                        href={
                          item.status === 'completed'
                            ? `/test-results?id=${item.id}`
                            : `/test-interface?id=${item.id}`
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <span>{item.status === 'completed' ? 'View Results' : 'Resume'}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row 3: Quick Study Actions */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          Recommended Study Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/upload"
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                Upload New Study Material
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Turn any lecture PDF into active quiz questions
              </p>
            </div>
          </Link>

          <Link
            href="/test-setup"
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Play className="w-5 h-5 fill-purple-600 dark:fill-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                Take Assessment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Practice with AI-evaluated free response questions
              </p>
            </div>
          </Link>

          <Link
            href="/ai-tutor"
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex items-start gap-3.5 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                Ask AI Tutor
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Clarify questions and review difficult concepts
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
