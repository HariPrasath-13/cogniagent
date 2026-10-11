'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  FileText,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  X,
  Layers,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function AdminModelComparisonPage() {
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Model comparison benchmarks matching Screen 14 in reference PDF
  const metrics = [
    {
      name: 'Accuracy',
      baselineLLM: 78,
      baseRAG: 84,
      cogniAgent: 92,
      lowerIsBetter: false,
    },
    {
      name: 'Faithfulness',
      baselineLLM: 70,
      baseRAG: 86,
      cogniAgent: 95,
      lowerIsBetter: false,
    },
    {
      name: 'Relevance',
      baselineLLM: 75,
      baseRAG: 85,
      cogniAgent: 94,
      lowerIsBetter: false,
    },
    {
      name: 'Hallucination Rate',
      unitNote: '(Lower is better)',
      baselineLLM: 18,
      baseRAG: 9,
      cogniAgent: 3,
      lowerIsBetter: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header & Empty State Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#111827] p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60">
              Benchmark Evaluation
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Model Performance Comparison
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Empirical comparison across LLM Baseline, Base RAG, and CogniAgent Proposed architecture
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowEmptyState(!showEmptyState)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
          >
            {showEmptyState ? 'Show PDF Reference (Screen 14)' : 'Show Initial Empty State'}
          </button>
        </div>
      </div>

      {showEmptyState ? (
        <EmptyState
          icon={BarChart3}
          title="No Benchmark Evaluation Data Connected"
          description="Evaluation metric charts will populate once benchmark model evaluation suites are connected."
          actionText="Inspect Question Quality"
          actionHref="/admin/question-quality"
          className="py-20"
        />
      ) : (
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-8">
          {/* Bar Charts Grid matching Screen 14 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            {metrics.map((item, idx) => {
              const maxVal = item.lowerIsBetter ? 25 : 100;

              return (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 text-center">
                      {item.name}
                    </h3>
                    {item.unitNote && (
                      <p className="text-[10px] text-slate-400 text-center font-medium">
                        {item.unitNote}
                      </p>
                    )}
                  </div>

                  {/* 3 Triple Columns for the 3 Models */}
                  <div className="flex items-end justify-center gap-3 h-52 pt-6 pb-2 px-2">
                    {/* Model 1: LLM Baseline (Pink/Red) */}
                    <div className="flex flex-col items-center h-full justify-end flex-1 max-w-[42px] group">
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mb-1.5">
                        {item.baselineLLM}%
                      </span>
                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-t-lg h-full flex items-end overflow-hidden">
                        <div
                          className="w-full bg-rose-400 dark:bg-rose-500 rounded-t-lg transition-all duration-700 shadow-xs"
                          style={{
                            height: `${(item.baselineLLM / maxVal) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 mt-2">
                        LLM
                      </span>
                    </div>

                    {/* Model 2: Base RAG (Sky Blue) */}
                    <div className="flex flex-col items-center h-full justify-end flex-1 max-w-[42px] group">
                      <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 mb-1.5">
                        {item.baseRAG}%
                      </span>
                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-t-lg h-full flex items-end overflow-hidden">
                        <div
                          className="w-full bg-sky-400 dark:bg-sky-500 rounded-t-lg transition-all duration-700 shadow-xs"
                          style={{
                            height: `${(item.baseRAG / maxVal) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 mt-2">
                        Base RAG
                      </span>
                    </div>

                    {/* Model 3: CogniAgent Proposed (Emerald Green) */}
                    <div className="flex flex-col items-center h-full justify-end flex-1 max-w-[42px] group">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">
                        {item.cogniAgent}%
                      </span>
                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-t-lg h-full flex items-end overflow-hidden ring-1 ring-emerald-400/40">
                        <div
                          className="w-full bg-emerald-500 dark:bg-emerald-400 rounded-t-lg transition-all duration-700 shadow-xs"
                          style={{
                            height: `${(item.cogniAgent / maxVal) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                        CogniAgent
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Color Legend matching Screen 14 */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-2 pb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="w-3.5 h-3.5 rounded-sm bg-rose-400 dark:bg-rose-500" />
              <span>LLM (Baseline)</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="w-3.5 h-3.5 rounded-sm bg-sky-400 dark:bg-sky-500" />
              <span>Base RAG</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500" />
              <span>CogniAgent (Proposed)</span>
            </div>
          </div>

          {/* Action button matching Screen 14: "View Detailed Results" */}
          <div className="flex items-center justify-center pt-2">
            <button
              type="button"
              onClick={() => setDetailModalOpen(true)}
              className="px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              View Detailed Results
            </button>
          </div>
        </div>
      )}

      {/* Detailed Benchmark Results Modal */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Evaluation Benchmark Table
                </h3>
                <p className="text-xs text-slate-400">
                  Evaluated across 500 test questions generated from technical textbook corpus
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5">Evaluation Metric</th>
                    <th className="py-2.5">LLM (Baseline)</th>
                    <th className="py-2.5">Base RAG</th>
                    <th className="py-2.5 text-emerald-600 font-bold">CogniAgent</th>
                    <th className="py-2.5 text-right">Advantage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  <tr>
                    <td className="py-3 font-bold text-slate-800 dark:text-slate-200">Accuracy</td>
                    <td className="py-3 text-rose-500">78%</td>
                    <td className="py-3 text-sky-500">84%</td>
                    <td className="py-3 text-emerald-600 font-bold">92%</td>
                    <td className="py-3 text-right text-emerald-600 font-bold">+14%</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-slate-800 dark:text-slate-200">Faithfulness</td>
                    <td className="py-3 text-rose-500">70%</td>
                    <td className="py-3 text-sky-500">86%</td>
                    <td className="py-3 text-emerald-600 font-bold">95%</td>
                    <td className="py-3 text-right text-emerald-600 font-bold">+25%</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-slate-800 dark:text-slate-200">Relevance</td>
                    <td className="py-3 text-rose-500">75%</td>
                    <td className="py-3 text-sky-500">85%</td>
                    <td className="py-3 text-emerald-600 font-bold">94%</td>
                    <td className="py-3 text-right text-emerald-600 font-bold">+19%</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-bold text-slate-800 dark:text-slate-200">Hallucination Rate</td>
                    <td className="py-3 text-rose-500">18%</td>
                    <td className="py-3 text-sky-500">9%</td>
                    <td className="py-3 text-emerald-600 font-bold">3%</td>
                    <td className="py-3 text-right text-emerald-600 font-bold">-15%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800 mt-4">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
              <Link
                href="/admin/question-quality"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                Inspect Evidence Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
