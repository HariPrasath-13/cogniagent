'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FolderArchive,
  FileText,
  Search,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function MaterialsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const materials = [
    {
      id: 'm1',
      title: 'DBMS Unit 1: Architecture & Relational Models',
      filename: 'DBMS_Unit1.pdf',
      subject: 'Database Systems',
      size: '12 MB',
      pages: 120,
      indexedAt: 'Yesterday',
    },
    {
      id: 'm2',
      title: 'DBMS Unit 2: Normalization, Functional Dependencies',
      filename: 'DBMS_Unit2.pdf',
      subject: 'Database Systems',
      size: '8 MB',
      pages: 95,
      indexedAt: '2 days ago',
    },
    {
      id: 'm3',
      title: 'Operating Systems: Virtual Memory Management',
      filename: 'OS_Notes.pdf',
      subject: 'Operating Systems',
      size: '4 MB',
      pages: 45,
      indexedAt: '3 days ago',
    },
  ];

  const filtered = materials.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            My Study Materials
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Access indexed textbooks, slides, and syllabus documents
          </p>
        </div>

        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Upload New PDF</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter materials by title or subject..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Grid of Materials */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  {item.subject}
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Indexed</span>
                </span>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-500 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {item.filename} • {item.size} • {item.pages} pages
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <Link
                href="/test-setup"
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                <Play className="w-3.5 h-3.5 fill-indigo-600 dark:fill-indigo-400" />
                <span>Test on this</span>
              </Link>
              <Link
                href="/ai-tutor"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Chat Tutor
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
