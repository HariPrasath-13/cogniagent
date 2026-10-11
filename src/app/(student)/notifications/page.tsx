'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  TrendingUp,
  BookOpen,
  CheckCircle2,
  Bell,
  ArrowRight,
  RotateCcw,
  Play,
  X,
  Filter,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';

export default function NotificationsPage() {
  const [showEmptyState, setShowEmptyState] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('Tomorrow 10:00 AM');

  // Notifications matching Screen 13 in reference PDF
  const [notifications, setNotifications] = useState([
    {
      id: 'n1',
      title: 'Your DBMS assessment is tomorrow',
      timeAgo: '1 hour ago',
      icon: Calendar,
      variant: 'blue',
      unread: true,
    },
    {
      id: 'n2',
      title: 'Your score improved by 12%',
      timeAgo: '3 hours ago',
      icon: TrendingUp,
      variant: 'emerald',
      unread: true,
    },
    {
      id: 'n3',
      title: 'New material recommended for Dynamic Programming',
      timeAgo: '1 day ago',
      icon: BookOpen,
      variant: 'purple',
      unread: false,
    },
    {
      id: 'n4',
      title: "You have completed today's study goal",
      timeAgo: '2 days ago',
      icon: CheckCircle2,
      variant: 'emerald',
      unread: false,
    },
  ]);

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Assessments &amp; Notifications
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Track upcoming test deadlines and adaptive system alerts
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowEmptyState(!showEmptyState)}
          className="self-start sm:self-auto px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 cursor-pointer"
        >
          {showEmptyState ? 'Show Reference View' : 'Show Empty State'}
        </button>
      </div>

      {showEmptyState ? (
        <EmptyState
          icon={Bell}
          title="No Notifications or Scheduled Assessments"
          description="You are completely caught up! New reminders will appear here when you schedule assessments or set goals."
          actionText="Schedule Assessment"
          actionHref="/test-setup"
          className="py-16"
        />
      ) : (
        <>
          {/* Section 1: Upcoming Assessments matching Screen 13 */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Upcoming Assessments
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Scheduled review sessions
                </p>
              </div>
              <button
                type="button"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All
              </button>
            </div>

            {/* Assessment Card matching Screen 13 */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/70 to-purple-50/50 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-600/20">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    DBMS - Normalization
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    20 questions • 20 mins
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{scheduledDate}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => setRescheduleModalOpen(true)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:border-indigo-300 transition-colors cursor-pointer"
                >
                  Reschedule
                </button>
                <Link
                  href="/test-setup?subject=DBMS"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Start Now</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Section 2: Recent Notifications matching Screen 13 */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Recent Notifications
              </h2>
              <span className="text-xs text-slate-400">
                {notifications.length} updates
              </span>
            </div>

            <div className="space-y-3">
              {notifications.map((item) => {
                const IconComponent = item.icon;
                const colors = {
                  blue: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
                  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
                  purple: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
                }[item.variant as 'blue' | 'emerald' | 'purple'];

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      item.unread
                        ? 'bg-slate-50/80 dark:bg-slate-800/40 border-indigo-100 dark:border-indigo-950/80'
                        : 'bg-white dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/80 opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colors}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {item.timeAgo}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.unread && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600" />
                      )}
                      <button
                        type="button"
                        onClick={() => handleDismiss(item.id)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded-lg"
                        title="Dismiss"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Reschedule Modal */}
      {rescheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white mb-3">
              Reschedule Assessment
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Select new date and time for DBMS Normalization quiz:
            </p>
            <input
              type="text"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 mb-5"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduleModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setRescheduleModalOpen(false)}
                className="px-4 py-1.5 text-xs rounded-xl bg-indigo-600 text-white font-semibold shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
