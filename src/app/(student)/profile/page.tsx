'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User,
  Mail,
  Edit3,
  Flame,
  Clock,
  Award,
  BookOpen,
  CheckCircle2,
  TrendingUp,
  Brain,
  Shield,
  X,
  Save,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function StudentProfilePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'achievements' | 'settings'>('overview');
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Profile data (local state)
  const [profile, setProfile] = useState({
    name: 'Student',
    email: 'student@gmail.com',
    targetExam: 'Computer Science Semester Finals',
    dailyGoal: '45 mins',
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
            {profile.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {profile.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>{profile.email}</span>
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-100 dark:border-indigo-900/60">
                Active Student
              </span>
              <span className="text-[11px] text-slate-400">
                Target: {profile.targetExam}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowEmptyState(!showEmptyState)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
          >
            {showEmptyState ? 'Show PDF Analytics' : 'Show Initial Empty'}
          </button>
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Profile Navigation Tabs matching Screen 10 */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-2">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'performance', label: 'Performance' },
            { id: 'achievements', label: 'Achievements' },
            { id: 'settings', label: 'Settings' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
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

      {/* Tab Panels */}
      {showEmptyState ? (
        <EmptyState
          icon={TrendingUp}
          title="No Profile Analytics Yet"
          description="Complete quizzes and practice tests to generate cognitive metrics, learning streaks, and subject breakdown."
          actionText="Take Assessment"
          actionHref="/test-setup"
          className="py-16"
        />
      ) : activeTab === 'overview' || activeTab === 'performance' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cognitive Progress Panel with Radar Polygon representation */}
          <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-600" />
                  <span>Cognitive Progress</span>
                </h2>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full">
                  Average 72%
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Multi-dimensional cognitive mastery evaluated across five core dimensions
              </p>

              {/* Spider Radar Diagram SVG */}
              <div className="relative aspect-square max-w-[280px] mx-auto my-2 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                  {/* Concentric rings */}
                  <polygon
                    points="100,20 176,75 147,165 53,165 24,75"
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth="1"
                  />
                  <polygon
                    points="100,45 151,83 132,143 68,143 49,83"
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth="1"
                  />
                  <polygon
                    points="100,70 126,88 116,122 84,122 74,88"
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth="1"
                  />

                  {/* Radiating axis lines */}
                  <line x1="100" y1="100" x2="100" y2="20" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />
                  <line x1="100" y1="100" x2="176" y2="75" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />
                  <line x1="100" y1="100" x2="147" y2="165" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />
                  <line x1="100" y1="100" x2="53" y2="165" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />
                  <line x1="100" y1="100" x2="24" y2="75" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />

                  {/* Filled Skill Polygon: 
                      Concept: 78% -> (100, 37)
                      Application: 64% -> (148, 84)
                      Problem Solving: 56% -> (126, 136)
                      Consistency: 72% -> (66, 146)
                      Recall: 86% -> (35, 78)
                  */}
                  <polygon
                    points="100,37 148,84 126,136 66,146 35,78"
                    className="fill-indigo-500/30 stroke-indigo-600 dark:stroke-indigo-400"
                    strokeWidth="2.5"
                  />
                </svg>

                {/* Dimension Badges matching Screen 10 */}
                <div className="absolute -top-3 text-[10px] font-bold text-center">
                  <span className="block text-slate-800 dark:text-slate-200">Concept understanding</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">78%</span>
                </div>
                <div className="absolute -left-6 top-16 text-[10px] font-bold text-left">
                  <span className="block text-slate-800 dark:text-slate-200">Recall</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">86%</span>
                </div>
                <div className="absolute -right-6 top-16 text-[10px] font-bold text-right">
                  <span className="block text-slate-800 dark:text-slate-200">Application</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">64%</span>
                </div>
                <div className="absolute left-2 -bottom-2 text-[10px] font-bold text-left">
                  <span className="block text-slate-800 dark:text-slate-200">Consistency</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">72%</span>
                </div>
                <div className="absolute right-2 -bottom-2 text-[10px] font-bold text-right">
                  <span className="block text-slate-800 dark:text-slate-200">Problem Solving</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">56%</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mastery assessed against bloom&apos;s revised taxonomy
              </span>
            </div>
          </div>

          {/* Right Column: Subject-wise Progress & Streak Cards */}
          <div className="lg:col-span-6 space-y-6">
            {/* Subject-wise Progress Bars */}
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5">
                Subject-wise Progress
              </h2>

              <div className="space-y-4">
                {[
                  { name: 'DBMS', pct: 82, color: 'bg-emerald-500' },
                  { name: 'Operating Systems', pct: 68, color: 'bg-sky-500' },
                  { name: 'Java', pct: 88, color: 'bg-indigo-500' },
                  { name: 'Algorithms', pct: 54, color: 'bg-rose-500' },
                ].map((s, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">{s.name}</span>
                      <span className="text-slate-900 dark:text-white font-bold">{s.pct}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${s.color} transition-all duration-700`}
                        style={{ width: `${s.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Streak & Learning Time Tiles matching Screen 10 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Learning Streak */}
              <div className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center shrink-0 shadow-2xs">
                  <Flame className="w-6 h-6 fill-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Learning Streak</p>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                    7 days
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                    Keep it up!
                  </p>
                </div>
              </div>

              {/* Total Learning Time */}
              <div className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">Total Learning Time</p>
                  <p className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                    32 hrs
                  </p>
                  <p className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                    Target: 40 hrs
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'achievements' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: '7-Day Streak Master', desc: 'Maintained active study consistency for 7 straight days', icon: Flame },
            { title: 'Database Architect', desc: 'Achieved 82%+ accuracy on DBMS normalization quizzes', icon: Award },
            { title: 'Rapid Retriever', desc: 'Consulted AI Tutor RAG citations 25 times', icon: Brain },
          ].map((a, i) => (
            <div key={i} className="p-6 rounded-3xl bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto mb-3 flex items-center justify-center">
                <a.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{a.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4 max-w-xl">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Account Preferences</h2>
          <p className="text-xs text-slate-500">Manage account information and study schedule settings.</p>
          <div className="pt-2">
            <Link href="/settings" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">
              Open Full Settings Page
            </Link>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Edit Student Profile
              </h3>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setEditModalOpen(false);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Exam
                </label>
                <input
                  type="text"
                  value={profile.targetExam}
                  onChange={(e) => setProfile({ ...profile, targetExam: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
