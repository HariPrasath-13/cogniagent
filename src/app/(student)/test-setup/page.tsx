'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  BookOpen,
  Clock,
  HelpCircle,
  Play,
  SlidersHorizontal,
  FileText,
  Upload,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { getAssessmentHistory, AssessmentHistoryItem } from '@/lib/assessment-api';

export default function TestSetupPage() {
  const router = useRouter();

  const [history, setHistory] = useState<AssessmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-8 space-y-6">
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xl relative overflow-hidden">
        {/* Glow corner */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 dark:bg-indigo-500/15 blur-2xl pointer-events-none rounded-full" />

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Take an AI Assessment
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Generate a custom test from your PDF material or review past assessments
            </p>
          </div>
        </div>

        {/* Primary Action: Upload PDF */}
        <div className="mt-6 p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Upload New Document
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload any PDF notes or textbook to automatically generate grounded questions using AI.
              </p>
            </div>
          </div>

          <Link
            href="/upload"
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Upload PDF &amp; Generate Test</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Previous Assessments List */}
        <div className="mt-8 space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Your Assessments
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 text-xs text-slate-400">
              No assessments found. Upload your first PDF above to start learning!
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/70 hover:border-indigo-300 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-indigo-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                        {item.pdf_name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {item.total_questions} questions • {item.status === 'completed' ? `Score: ${item.score}%` : 'In progress'}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={
                      item.status === 'completed'
                        ? `/test-results?id=${item.id}`
                        : `/test-interface?id=${item.id}`
                    }
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 shrink-0"
                  >
                    <span>{item.status === 'completed' ? 'View Results' : 'Resume'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
