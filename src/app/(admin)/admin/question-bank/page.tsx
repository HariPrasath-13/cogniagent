'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Database,
  Search,
  Plus,
  FileText,
  CheckCircle2,
  Filter,
  ArrowRight,
} from 'lucide-react';

export default function AdminQuestionBankPage() {
  const [search, setSearch] = useState('');

  const questions = [
    {
      id: 'qb-1',
      subject: 'DBMS',
      text: 'Which of the following best describes normalization in DBMS?',
      qualityScore: 94,
      doc: 'DBMS_Unit2.pdf',
      page: 14,
    },
    {
      id: 'qb-2',
      subject: 'DBMS',
      text: 'What does ACID stand for in the context of relational database management systems?',
      qualityScore: 96,
      doc: 'DBMS_Unit1.pdf',
      page: 8,
    },
    {
      id: 'qb-3',
      subject: 'OS',
      text: 'Which page replacement algorithm suffers from Belady’s Anomaly?',
      qualityScore: 91,
      doc: 'OS_Notes.pdf',
      page: 32,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Admin Question Bank
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse and curate AI-generated assessment questions from uploaded textbooks
          </p>
        </div>

        <Link
          href="/admin/question-quality"
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white self-start sm:self-auto"
        >
          View Quality Dashboard
        </Link>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search question text or document reference..."
          className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
        />
      </div>

      <div className="space-y-3">
        {questions.map((q) => (
          <div
            key={q.id}
            className="p-5 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  {q.subject}
                </span>
                <span className="text-[11px] text-slate-400">
                  {q.doc} • Page {q.page}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                {q.text}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <div className="text-right">
                <p className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {q.qualityScore}%
                </p>
                <p className="text-[10px] text-slate-400">Quality Score</p>
              </div>

              <Link
                href="/admin/question-quality"
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-600"
                title="View Evidence"
              >
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
