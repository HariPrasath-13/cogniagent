'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Play,
  FileText,
  Video,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  Target,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function StudyPlanPage() {
  const [activeTab, setActiveTab] = useState<'recommended' | 'my-plan' | 'resources'>('recommended');
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [createPlanModalOpen, setCreatePlanModalOpen] = useState(false);
  const [newPlanSubject, setNewPlanSubject] = useState('DBMS');
  const [newPlanGoal, setNewPlanGoal] = useState('10 Practice Questions Daily');

  // Recommendation items matching Screen 11 in reference PDF
  const recommendedPlans = [
    {
      id: 'plan-1',
      title: 'Normalization (DBMS)',
      tasks: 'Watch lecture • Practice 10 questions',
      type: 'lecture',
      subject: 'Database Systems',
      estimatedTime: '45 mins',
      href: '/test-setup?subject=DBMS',
    },
    {
      id: 'plan-2',
      title: 'Transactions (DBMS)',
      tasks: 'Read notes • Practice questions',
      type: 'notes',
      subject: 'Database Systems',
      estimatedTime: '30 mins',
      href: '/test-setup?subject=DBMS',
    },
    {
      id: 'plan-3',
      title: 'Dynamic Programming (Algorithms)',
      tasks: 'Concept video • Practice problems',
      type: 'video',
      subject: 'Algorithms',
      estimatedTime: '1 hr',
      href: '/test-setup?subject=Algorithms',
    },
    {
      id: 'plan-4',
      title: 'Memory Management (OS)',
      tasks: 'Study material • Take a quiz',
      type: 'quiz',
      subject: 'Operating Systems',
      estimatedTime: '35 mins',
      href: '/test-setup?subject=OS',
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header matching Screen 11 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Your Personalized Study Plan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Curated daily study milestones targeting diagnosed learning gaps
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowEmptyState(!showEmptyState)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
          >
            {showEmptyState ? 'Show Reference Plan' : 'Show Empty State'}
          </button>
          <button
            type="button"
            onClick={() => setCreatePlanModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Plan &gt;</span>
          </button>
        </div>
      </div>

      {/* Tabs matching Screen 11: [Recommended] [My Plan] [Resources] */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        {[
          { id: 'recommended', label: 'Recommended' },
          { id: 'my-plan', label: 'My Plan' },
          { id: 'resources', label: 'Resources' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 cursor-pointer ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {showEmptyState ? (
        <EmptyState
          icon={Sparkles}
          title="No Study Plan Generated Yet"
          description="Upload your syllabus or lecture slides to automatically generate personalized learning milestones."
          actionText="Upload Material"
          actionHref="/upload"
          className="py-16"
        />
      ) : activeTab === 'recommended' ? (
        <div className="space-y-4">
          {recommendedPlans.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-[#111827] rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                      {item.subject}
                    </span>
                    <span className="text-[10px] text-slate-400">• {item.estimatedTime}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {item.tasks}
                  </p>
                </div>
              </div>

              <Link
                href={item.href}
                className="self-end sm:self-center px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all shrink-0 cursor-pointer"
              >
                Start
              </Link>
            </div>
          ))}
        </div>
      ) : activeTab === 'my-plan' ? (
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" />
              <span>Current Sprint Goal</span>
            </h3>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full">
              In Progress
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Targeting Database Systems normalization and transaction isolation prior to finals.
          </p>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Daily Goal:</span>
              <span className="font-bold text-slate-900 dark:text-white">10 MCQs + 1 Chapter Review</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full w-2/3" />
            </div>
            <p className="text-[11px] text-slate-400 text-right">66% Completed for Today</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { name: 'DBMS Unit 2: Relational Models & Normalization.pdf', size: '8 MB' },
            { name: 'OS Unit 3: Virtual Memory & Page Replacement.pdf', size: '12 MB' },
          ].map((r, i) => (
            <div key={i} className="p-5 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{r.name}</p>
                  <p className="text-[11px] text-slate-400">{r.size}</p>
                </div>
              </div>
              <Link href="/upload" className="text-xs font-semibold text-indigo-600 hover:underline">View</Link>
            </div>
          ))}
        </div>
      )}

      {/* Create Plan Modal */}
      {createPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Create Custom Study Plan
              </h3>
              <button
                type="button"
                onClick={() => setCreatePlanModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCreatePlanModalOpen(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject or Module
                </label>
                <select
                  value={newPlanSubject}
                  onChange={(e) => setNewPlanSubject(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="DBMS">Database Management Systems (DBMS)</option>
                  <option value="OS">Operating Systems</option>
                  <option value="Java">Java Programming</option>
                  <option value="Algorithms">Algorithms &amp; Data Structures</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Goal
                </label>
                <input
                  type="text"
                  value={newPlanGoal}
                  onChange={(e) => setNewPlanGoal(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setCreatePlanModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white shadow-xs"
                >
                  Generate Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
