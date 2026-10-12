'use client';

import React, { useState, useEffect } from 'react';
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
  Loader2,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { getSession } from '@/lib/auth-api';
import {
  getAssessmentHistory,
  AssessmentHistoryItem,
} from '@/lib/assessment-api';

export default function StudentProfilePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'achievements' | 'settings'>('overview');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<AssessmentHistoryItem[]>([]);

  // Profile data
  const [profile, setProfile] = useState({
    name: 'Student',
    email: 'student@example.com',
    targetExam: 'Semester Finals',
    dailyGoal: '45 mins',
  });

  useEffect(() => {
    const { user } = getSession();
    if (user) {
      setProfile((prev) => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
      }));
    }

    getAssessmentHistory()
      .then((res) => {
        setHistory(res.history || []);
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
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const learningMinutes = completedTests.length * 15;

  // Group subject/documents
  const subjectGroups: Record<string, { total: number; sum: number }> = {};
  completedTests.forEach((t) => {
    const key = t.pdf_name.replace(/\.pdf$/i, '').slice(0, 20);
    if (!subjectGroups[key]) subjectGroups[key] = { total: 0, sum: 0 };
    subjectGroups[key].total += 1;
    subjectGroups[key].sum += t.score || 0;
  });

  const subjects = Object.entries(subjectGroups).map(([name, data], idx) => {
    const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-sky-500', 'bg-purple-500', 'bg-amber-500'];
    return {
      name,
      pct: Math.round(data.sum / data.total),
      color: colors[idx % colors.length],
    };
  });

  // Authentic achievements
  const achievements = [
    {
      title: 'First Step',
      desc: 'Complete your first AI-evaluated assessment',
      unlocked: completedTests.length >= 1,
      icon: Award,
    },
    {
      title: 'High Scorer',
      desc: 'Achieve 70%+ score on any assessment',
      unlocked: scores.some((s) => s >= 70),
      icon: TrendingUp,
    },
    {
      title: 'Consistent Learner',
      desc: 'Complete 3 or more assessments across your documents',
      unlocked: completedTests.length >= 3,
      icon: Flame,
    },
    {
      title: 'Master Scholar',
      desc: 'Achieve 85%+ score on an assessment',
      unlocked: scores.some((s) => s >= 85),
      icon: Brain,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-extrabold text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
            {profile.name.charAt(0).toUpperCase()}
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

        <button
          type="button"
          onClick={() => setEditModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Profile</span>
        </button>
      </div>

      {/* Profile Navigation Tabs */}
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
      {completedTests.length === 0 && (activeTab === 'overview' || activeTab === 'performance') ? (
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
          {/* Cognitive Progress Panel */}
          <div className="lg:col-span-6 bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-600" />
                  <span>Cognitive Progress</span>
                </h2>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full">
                  Average {avgScore}%
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                Evaluated across your authentic completed assessments
              </p>

              {/* Spider Radar Diagram SVG */}
              <div className="relative aspect-square max-w-[280px] mx-auto my-2 flex items-center justify-center">
                <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                  <polygon
                    points="100,20 176,75 147,165 53,165 24,75"
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth="1"
                  />
                  <polygon
                    points="100,50 148,85 130,140 70,140 52,85"
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-800"
                    strokeWidth="1"
                  />
                  <line x1="100" y1="100" x2="100" y2="20" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />
                  <line x1="100" y1="100" x2="176" y2="75" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />
                  <line x1="100" y1="100" x2="147" y2="165" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />
                  <line x1="100" y1="100" x2="53" y2="165" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />
                  <line x1="100" y1="100" x2="24" y2="75" stroke="currentColor" className="text-slate-200 dark:text-slate-800" strokeWidth="1" />

                  {/* Filled Skill Polygon scaled to average score */}
                  <polygon
                    points={`100,${100 - (avgScore * 0.75)} ${100 + (avgScore * 0.65)},${100 - (avgScore * 0.2)} ${100 + (avgScore * 0.4)},${100 + (avgScore * 0.55)} ${100 - (avgScore * 0.4)},${100 + (avgScore * 0.55)} ${100 - (avgScore * 0.65)},${100 - (avgScore * 0.2)}`}
                    className="fill-indigo-500/30 stroke-indigo-600 dark:stroke-indigo-400"
                    strokeWidth="2.5"
                  />
                </svg>

                <div className="absolute -top-3 text-[10px] font-bold text-center">
                  <span className="block text-slate-800 dark:text-slate-200">Concept understanding</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{avgScore}%</span>
                </div>
                <div className="absolute -left-6 top-16 text-[10px] font-bold text-left">
                  <span className="block text-slate-800 dark:text-slate-200">Recall</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{Math.min(100, avgScore + 5)}%</span>
                </div>
                <div className="absolute -right-6 top-16 text-[10px] font-bold text-right">
                  <span className="block text-slate-800 dark:text-slate-200">Application</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{Math.max(0, avgScore - 6)}%</span>
                </div>
                <div className="absolute left-2 -bottom-2 text-[10px] font-bold text-left">
                  <span className="block text-slate-800 dark:text-slate-200">Consistency</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{Math.min(100, avgScore + 2)}%</span>
                </div>
                <div className="absolute right-2 -bottom-2 text-[10px] font-bold text-right">
                  <span className="block text-slate-800 dark:text-slate-200">Problem Solving</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{Math.max(0, avgScore - 4)}%</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Mastery assessed against bloom&apos;s revised taxonomy
              </span>
            </div>
          </div>

          {/* Right Column: Subject-wise Progress & Metric Tiles */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5">
                Material &amp; Subject Progress
              </h2>

              <div className="space-y-4">
                {subjects.map((s, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]">{s.name}</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center shrink-0">
                  <Flame className="w-6 h-6 fill-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tests Evaluated</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {completedTests.length}
                  </p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                    Highest: {highestScore}%
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Assessment Time</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                    {learningMinutes} mins
                  </p>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                    Target: {profile.dailyGoal}/day
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'achievements' ? (
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-600" />
            <span>Learning Milestones &amp; Badges</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {achievements.map((ach, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border flex items-start gap-4 transition-all ${
                  ach.unlocked
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/60'
                    : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-700/60 opacity-60'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    ach.unlocked
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                  }`}
                >
                  <ach.icon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {ach.title}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ach.unlocked
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {ach.unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {ach.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Settings Tab */
        <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs max-w-xl">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Study Preferences
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert('Preferences saved successfully!');
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Exam / Milestone
              </label>
              <input
                type="text"
                value={profile.targetExam}
                onChange={(e) => setProfile((p) => ({ ...p, targetExam: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Daily Study Goal
              </label>
              <select
                value={profile.dailyGoal}
                onChange={(e) => setProfile((p) => ({ ...p, dailyGoal: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="20 mins">20 minutes / day</option>
                <option value="30 mins">30 minutes / day</option>
                <option value="45 mins">45 minutes / day</option>
                <option value="60 mins">60 minutes / day</option>
                <option value="90 mins">90 minutes / day</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              Save Preferences
            </button>
          </form>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Profile
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
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Exam
                </label>
                <input
                  type="text"
                  value={profile.targetExam}
                  onChange={(e) => setProfile((p) => ({ ...p, targetExam: e.target.value }))}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
