'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  TrendingUp,
  BookOpen,
  CheckCircle2,
  Bell,
  Play,
  Loader2,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  getAssessmentHistory,
  getStudyPlans,
  AssessmentHistoryItem,
  StudyPlanItem,
} from '@/lib/assessment-api';

export default function NotificationsPage() {
  const [history, setHistory] = useState<AssessmentHistoryItem[]>([]);
  const [plans, setPlans] = useState<StudyPlanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAssessmentHistory().catch(() => ({ history: [] })),
      getStudyPlans().catch(() => ({ plans: [] })),
    ])
      .then(([hRes, pRes]) => {
        setHistory(hRes.history || []);
        setPlans(pRes.plans || []);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const inProgressTests = history.filter((h) => h.status === 'in_progress');
  const completedTests = history.filter((h) => h.status === 'completed');
  const hasContent = history.length > 0 || plans.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          Assessments &amp; Notifications
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Track upcoming test deadlines and adaptive system alerts
        </p>
      </div>

      {!hasContent ? (
        <EmptyState
          icon={Bell}
          title="No Notifications or Scheduled Assessments"
          description="You are completely caught up! New reminders will appear here when you schedule assessments or generate study plans."
          actionText="Upload Study Material"
          actionHref="/upload"
          className="py-16"
        />
      ) : (
        <div className="space-y-6">
          {/* Active / In-Progress Assessments */}
          {inProgressTests.length > 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                Active &amp; In-Progress Tests
              </h2>
              <div className="space-y-3">
                {inProgressTests.map((item) => (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/70 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {item.pdf_name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.total_questions} questions • {item.duration_minutes || 15} mins duration
                        </p>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 mt-2">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Started • Awaiting submission</span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/test-interface?id=${item.id}`}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer self-end sm:self-center"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Resume Test</span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Study Plan Reminders */}
          {plans.length > 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
                Active Study Milestones
              </h2>
              <div className="space-y-3">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {p.overview.title || `Plan for ${p.document_name}`}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {p.completed_sessions.length} of {p.sessions.length} sessions completed ({p.progress_pct}%)
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/study-plan"
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 self-end sm:self-center"
                    >
                      <span>Continue Plan</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Alerts */}
          {completedTests.length > 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Activity &amp; Completed Assessments
              </h2>
              <div className="space-y-2.5">
                {completedTests.slice(0, 5).map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          Completed test on {t.pdf_name}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Score: {t.score}% • {new Date(t.created_at * 1000).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/test-results?id=${t.id}`}
                      className="text-xs font-semibold text-indigo-600 hover:underline"
                    >
                      View Report
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
