'use client';

import React from 'react';
import Link from 'next/link';
import { BarChart3, TrendingUp, Sparkles, Layers, ArrowRight } from 'lucide-react';

export default function AdminAnalyticsPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          System Analytics &amp; Retrieval Metrics
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Detailed telemetry on vector retrieval latency, chunk hit rates, and model performance
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-400 font-medium">Avg Vector Latency</p>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">42ms</p>
          <p className="text-xs text-emerald-600 mt-1 font-semibold">Fast retrieval</p>
        </div>
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-400 font-medium">Chunk Hit Rate</p>
          <p className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">94.8%</p>
          <p className="text-xs text-slate-400 mt-1">Top-3 recall</p>
        </div>
        <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs text-slate-400 font-medium">Faithfulness Score</p>
          <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">95.0%</p>
          <p className="text-xs text-slate-400 mt-1">Hallucination free</p>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Model Performance Comparison
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            View the 3-model evaluation chart for LLM Baseline, Base RAG, and CogniAgent.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
        >
          <span>Open Comparison</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
