'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  UploadCloud,
  FileText,
  Clock,
  Sparkles,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Coffee,
  RotateCcw,
  PenTool,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  Trash2,
  Layers,
  Target,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  StudyPlanDocument,
  StudyPlan,
  StudyPlanTask,
  ActivityType,
  getStudyDocuments,
  uploadStudyDocument,
  generateStudyPlan,
  getLatestStudyPlan,
  updateTaskStatus,
  deleteStudyPlan,
} from '@/lib/study-plan-api';
import { getSession } from '@/lib/auth-api';

export default function StudyPlanPage() {
  const router = useRouter();

  // Active user session
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Existing documents & active selection
  const [documents, setDocuments] = useState<StudyPlanDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<StudyPlanDocument | null>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuration fields
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);

  const defaultTargetObj = new Date();
  defaultTargetObj.setDate(defaultTargetObj.getDate() + 7);
  const defaultTargetStr = defaultTargetObj.toISOString().split('T')[0];
  const [targetDate, setTargetDate] = useState(defaultTargetStr);

  const [dailyHours, setDailyHours] = useState(2.0);
  const [dailyStartTime, setDailyStartTime] = useState('09:00');
  const [learningLevel, setLearningLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Intermediate');
  const [learningGoal, setLearningGoal] = useState<'Exam Preparation' | 'Concept Understanding' | 'Revision' | 'Complete Syllabus'>('Exam Preparation');
  const [breakDuration, setBreakDuration] = useState<number>(10);
  const [includeRevision, setIncludeRevision] = useState(true);

  // Validation & generation state
  const [formError, setFormError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Active saved plan & task management
  const [activePlan, setActivePlan] = useState<StudyPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [taskUpdatingId, setTaskUpdatingId] = useState<number | null>(null);

  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  const loadInitialData = () => {
    setLoadingPlan(true);
    setInitialLoadError(null);
    Promise.allSettled([
      getStudyDocuments(),
      getLatestStudyPlan(),
    ]).then(([docsRes, planRes]) => {
      if (docsRes.status === 'fulfilled') {
        const docs = docsRes.value;
        setDocuments(docs);
        if (docs.length > 0) {
          setSelectedDocId((prev) => prev || docs[0].id);
          setSelectedDoc((prev) => prev || docs[0]);
        }
      } else {
        const msg = docsRes.reason?.message || 'Could not load documents';
        if (msg.includes('Cannot connect')) {
          setInitialLoadError(msg);
        }
      }

      if (planRes.status === 'fulfilled' && planRes.value) {
        const plan = planRes.value;
        setActivePlan(plan);
        const initialExpanded: Record<number, boolean> = {};
        const todayFormatted = new Date().toISOString().split('T')[0];
        let todayFound = false;

        plan.tasks.forEach((t) => {
          if (t.date === todayFormatted) {
            initialExpanded[t.day_number] = true;
            todayFound = true;
          }
        });
        if (!todayFound && plan.tasks.length > 0) {
          initialExpanded[1] = true;
        }
        setExpandedDays(initialExpanded);
      }
      setLoadingPlan(false);
    });
  };

  // Initial data loading
  useEffect(() => {
    const { token } = getSession();
    if (!token) {
      setIsAuthenticated(false);
      setSessionChecked(true);
      setLoadingPlan(false);
      return;
    }

    setIsAuthenticated(true);
    setSessionChecked(true);
    loadInitialData();
  }, []);

  // Update selected doc object when docId changes
  useEffect(() => {
    if (selectedDocId) {
      const match = documents.find((d) => d.id === selectedDocId);
      setSelectedDoc(match || null);
    } else {
      setSelectedDoc(null);
    }
  }, [selectedDocId, documents]);

  // Validate form configuration
  const validateConfiguration = (): string | null => {
    if (!selectedDocId) {
      return 'Please select or upload a study material PDF.';
    }
    if (!startDate) {
      return 'Please select a study start date.';
    }
    if (!targetDate) {
      return 'Please select a target completion date.';
    }
    if (targetDate <= startDate) {
      return 'Target completion date must be strictly after the start date.';
    }
    if (dailyHours < 1.0) {
      return 'Daily study duration must be at least 1 hour.';
    }
    if (breakDuration < 5 || breakDuration > 15) {
      return 'Break duration must be between 5 and 15 minutes.';
    }
    return null;
  };

  // Handle PDF file selection/upload
  const handlePdfUpload = async (file: File) => {
    setUploadError(null);
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a valid PDF file (.pdf).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('PDF size exceeds the maximum allowed limit of 10 MB.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);
      const doc = await uploadStudyDocument(file, (progress) => {
        setUploadProgress(progress);
      });
      setUploadProgress(100);
      setDocuments((prev) => [doc, ...prev]);
      setSelectedDocId(doc.id);
      setSelectedDoc(doc);
      setUploading(false);
    } catch (err: any) {
      setUploading(false);
      setUploadError(err.message || 'Failed to upload study material. Please try again.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handlePdfUpload(e.dataTransfer.files[0]);
    }
  };

  // Generate Plan Handler
  const handleGeneratePlan = async () => {
    const error = validateConfiguration();
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setGenerationError(null);
    setGenerating(true);

    try {
      const plan = await generateStudyPlan({
        document_id: selectedDocId!,
        start_date: startDate,
        target_date: targetDate,
        daily_study_hours: dailyHours,
        daily_start_time: dailyStartTime,
        learning_level: learningLevel,
        learning_goal: learningGoal,
        break_duration_minutes: breakDuration,
        include_revision: includeRevision,
      });

      setActivePlan(plan);
      setShowConfigForm(false);
      setConfirmRegenerateOpen(false);

      // Auto-expand day 1 or today
      const newExpanded: Record<number, boolean> = { 1: true };
      const todayFormatted = new Date().toISOString().split('T')[0];
      plan.tasks.forEach((t) => {
        if (t.date === todayFormatted) {
          newExpanded[t.day_number] = true;
        }
      });
      setExpandedDays(newExpanded);
      setGenerating(false);

      // Smooth scroll to timetable
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      setGenerating(false);
      setGenerationError(err.message || 'Failed to generate study plan. Please verify the document has readable text.');
    }
  };

  // Task Completion Toggle
  const handleToggleTask = async (task: StudyPlanTask) => {
    if (!activePlan) return;
    const currentCompleted = Boolean(task.is_completed);
    const newCompleted = !currentCompleted;

    // Optimistic update
    setTaskUpdatingId(task.id);
    const updatedTasks = activePlan.tasks.map((t) =>
      t.id === task.id ? { ...t, is_completed: newCompleted ? 1 : 0 } : t
    );
    const completedCount = updatedTasks.filter((t) => Boolean(t.is_completed)).length;
    const totalCount = updatedTasks.length;
    const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 1000) / 10 : 0;

    setActivePlan({
      ...activePlan,
      tasks: updatedTasks,
      stats: {
        total_tasks: totalCount,
        completed_tasks: completedCount,
        progress_percentage: progressPct,
      },
    });

    try {
      const res = await updateTaskStatus(task.id, newCompleted);
      if (res && res.stats) {
        setActivePlan((prev) =>
          prev ? { ...prev, stats: res.stats } : prev
        );
      }
    } catch (err: any) {
      // Revert optimistic update on failure
      const revertedTasks = activePlan.tasks.map((t) =>
        t.id === task.id ? { ...t, is_completed: currentCompleted ? 1 : 0 } : t
      );
      setActivePlan({
        ...activePlan,
        tasks: revertedTasks,
      });
      alert('Could not update task status: ' + (err.message || 'Network error'));
    } finally {
      setTaskUpdatingId(null);
    }
  };

  const toggleDayExpansion = (dayNum: number) => {
    setExpandedDays((prev) => ({
      ...prev,
      [dayNum]: !prev[dayNum],
    }));
  };

  // Format Helper for file size preview
  const formatFileSize = (charCount?: number) => {
    if (!charCount) return 'Uploaded PDF';
    const estimatedKb = Math.round(charCount / 800);
    return `${estimatedKb} KB indexed text`;
  };

  // Helper for activity type badge rendering
  const getActivityBadge = (type: ActivityType) => {
    switch (type) {
      case 'Study':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60">
            <BookOpen className="w-3 h-3" />
            <span>Study</span>
          </span>
        );
      case 'Practice':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
            <PenTool className="w-3 h-3" />
            <span>Practice</span>
          </span>
        );
      case 'Break':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60">
            <Coffee className="w-3 h-3" />
            <span>Break</span>
          </span>
        );
      case 'Revision':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/60">
            <RotateCcw className="w-3 h-3" />
            <span>Revision</span>
          </span>
        );
    }
  };

  // Group tasks by day
  const groupedDays: { dayNumber: number; date: string; tasks: StudyPlanTask[] }[] = [];
  if (activePlan) {
    const daysMap = new Map<number, StudyPlanTask[]>();
    activePlan.tasks.forEach((t) => {
      const list = daysMap.get(t.day_number) || [];
      list.push(t);
      daysMap.set(t.day_number, list);
    });

    Array.from(daysMap.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([dayNum, tasks]) => {
        groupedDays.push({
          dayNumber: dayNum,
          date: tasks[0]?.date || '',
          tasks,
        });
      });
  }

  // Not signed in state
  if (sessionChecked && !isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Sign In to Access Your Study Plan
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Please log in to your student account to upload course documents and generate AI-powered personalized timetables.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
        >
          <span>Sign In</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* =========================================================================
          SECTION 4 (PERSISTED TIMETABLE): Show Active Timetable if one exists
      ========================================================================= */}
      {activePlan && !showConfigForm && (
        <div className="space-y-6">
          {/* Top Banner / Plan Summary Header */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Active Personalized Timetable</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                  {activePlan.title}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Based on: {activePlan.filename || 'Uploaded Document'}</span>
                  <span>•</span>
                  <span>Target Date: {activePlan.target_date}</span>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmRegenerateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Plan</span>
                </button>
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Planned Hours
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {activePlan.total_hours} hrs
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Duration
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {activePlan.total_days} Days
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Pace / Day
                </p>
                <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {activePlan.daily_hours} hrs/day
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Task Completion
                </p>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {activePlan.stats.progress_percentage}%
                </p>
              </div>
            </div>

            {/* Live Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-300">
                  Timetable Milestones Completed
                </span>
                <span className="text-slate-900 dark:text-white font-bold">
                  {activePlan.stats.completed_tasks} of {activePlan.stats.total_tasks} tasks done
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, activePlan.stats.progress_percentage))}%` }}
                />
              </div>
            </div>

            {/* Topic Limitation Note if material was constrained */}
            {activePlan.limitation_note && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <p>{activePlan.limitation_note}</p>
              </div>
            )}
          </div>

          {/* Confirmation Modal to Replace Existing Plan */}
          {confirmRegenerateOpen && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
                  <AlertCircle className="w-6 h-6" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Replace Current Study Plan?
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Generating a new timetable will configure a fresh schedule. Your current completed task records on this plan will be replaced by the new timetable.
                </p>
                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmRegenerateOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmRegenerateOpen(false);
                      setShowConfigForm(true);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    Proceed to Reconfigure
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Day-by-Day Expandable Timetable */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Day-by-Day Timetable Schedule</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allExp: Record<number, boolean> = {};
                    groupedDays.forEach((g) => (allExp[g.dayNumber] = true));
                    setExpandedDays(allExp);
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Expand All
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={() => setExpandedDays({})}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {groupedDays.map((group) => {
              const isToday = group.date === todayStr;
              const isExpanded = Boolean(expandedDays[group.dayNumber]);
              const dayCompletedCount = group.tasks.filter((t) => Boolean(t.is_completed)).length;
              const dayTotalCount = group.tasks.length;
              const isDayAllDone = dayTotalCount > 0 && dayCompletedCount === dayTotalCount;

              return (
                <div
                  key={group.dayNumber}
                  className={`bg-white dark:bg-[#111827] rounded-3xl border transition-all overflow-hidden ${
                    isToday
                      ? 'border-indigo-500/80 dark:border-indigo-500/60 shadow-md shadow-indigo-500/5 ring-1 ring-indigo-500/20'
                      : 'border-slate-200/80 dark:border-slate-800 shadow-xs'
                  }`}
                >
                  {/* Accordion Day Header */}
                  <div
                    onClick={() => toggleDayExpansion(group.dayNumber)}
                    className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-all select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isDayAllDone
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                            : isToday
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isDayAllDone ? <Check className="w-5 h-5" /> : `D${group.dayNumber}`}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                            Day {group.dayNumber}
                          </h3>
                          <span className="text-xs text-slate-400">• {group.date}</span>
                          {isToday && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-600 text-white tracking-wider">
                              Today
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {dayCompletedCount} of {dayTotalCount} tasks finished
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Tasks List for Day */}
                  {isExpanded && (
                    <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 space-y-2.5 border-t border-slate-100 dark:border-slate-800/60">
                      {group.tasks.map((task) => {
                        const isCompleted = Boolean(task.is_completed);
                        const isUpdating = taskUpdatingId === task.id;

                        return (
                          <div
                            key={task.id}
                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                              isCompleted
                                ? 'bg-slate-50/70 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-800 opacity-70'
                                : task.activity_type === 'Break'
                                ? 'bg-amber-50/30 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30'
                                : 'bg-white dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleToggleTask(task)}
                                className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                                  isCompleted
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 bg-white dark:bg-slate-800'
                                }`}
                              >
                                {isCompleted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </button>

                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                    {task.start_time} – {task.end_time}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    ({task.duration_minutes}m)
                                  </span>
                                  {getActivityBadge(task.activity_type)}
                                </div>
                                <p
                                  className={`text-xs sm:text-sm font-medium leading-relaxed ${
                                    isCompleted
                                      ? 'line-through text-slate-400 dark:text-slate-500'
                                      : 'text-slate-900 dark:text-white'
                                  }`}
                                >
                                  {task.topic}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          PLAN CREATION FORM (Section A, Section B, Section C)
          Shown if no plan exists or user clicked "Regenerate Plan"
      ========================================================================= */}
      {(!activePlan || showConfigForm) && (
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Create Your Personalized Study Plan
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Upload or select your study material to generate a personalized timetable.
                </p>
              </div>
              {activePlan && showConfigForm && (
                <button
                  type="button"
                  onClick={() => setShowConfigForm(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  Back to Active Plan
                </button>
              )}
            </div>
          </div>

          {initialLoadError && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{initialLoadError}</span>
              </div>
              <button
                type="button"
                onClick={loadInitialData}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shrink-0 cursor-pointer transition-colors"
              >
                Reconnect
              </button>
            </div>
          )}

          {/* =========================================================================
              SECTION A — Uploaded PDF
          ========================================================================= */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Section A — Study Material PDF</span>
              </h2>
              {documents.length > 0 && (
                <span className="text-xs text-slate-400">
                  {documents.length} document{documents.length > 1 ? 's' : ''} available
                </span>
              )}
            </div>

            {/* Dropdown for Existing Uploads */}
            {documents.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Existing Document:
                </label>
                <select
                  value={selectedDocId || ''}
                  onChange={(e) => setSelectedDocId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.filename} ({formatFileSize(d.char_count)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Drag & Drop Upload Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-900/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handlePdfUpload(e.target.files[0]);
                  }
                }}
              />
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                Drag and drop a new PDF here, or <span className="text-indigo-600 dark:text-indigo-400 underline">Browse Files</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Supported formats: PDF (up to 10 MB). Requires readable text.
              </p>
            </div>

            {/* Upload progress & error states */}
            {uploading && (
              <div className="space-y-1.5 p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <span>Uploading and parsing PDF...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-indigo-200 dark:bg-indigo-950 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Selected PDF Preview Row */}
            {selectedDoc && (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {selectedDoc.filename}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatFileSize(selectedDoc.char_count)} • Ready for timetable generation
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full shrink-0">
                  Selected
                </span>
              </div>
            )}
          </div>

          {/* =========================================================================
              SECTION B — Plan Configuration
          ========================================================================= */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Section B — Plan Configuration</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Selected PDF Preview (Required) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. Selected Study Material <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedDoc ? selectedDoc.filename : 'No PDF selected yet'}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-not-allowed font-medium"
                />
              </div>

              {/* 2. Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  2. Study Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 3. Target Completion Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  3. Target Completion Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={targetDate}
                  min={startDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 4. Daily Study Duration (Minimum 1 hour, 30-min increments) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  4. Daily Study Duration <span className="text-rose-500">*</span> (Min 1 hr)
                </label>
                <select
                  value={dailyHours}
                  onChange={(e) => setDailyHours(parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={1.0}>1.0 hour (60 mins)</option>
                  <option value={1.5}>1.5 hours (90 mins)</option>
                  <option value={2.0}>2.0 hours (120 mins)</option>
                  <option value={2.5}>2.5 hours (150 mins)</option>
                  <option value={3.0}>3.0 hours (180 mins)</option>
                  <option value={3.5}>3.5 hours (210 mins)</option>
                  <option value={4.0}>4.0 hours (240 mins)</option>
                  <option value={5.0}>5.0 hours (300 mins)</option>
                  <option value={6.0}>6.0 hours (360 mins)</option>
                </select>
              </div>

              {/* 5. Preferred Daily Study Start Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  5. Daily Start Time <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={dailyStartTime}
                  onChange={(e) => setDailyStartTime(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 6. Learning Level */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  6. Learning Level <span className="text-rose-500">*</span>
                </label>
                <select
                  value={learningLevel}
                  onChange={(e) => setLearningLevel(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Beginner">Beginner (Foundations &amp; Basics)</option>
                  <option value="Intermediate">Intermediate (Core &amp; Application)</option>
                  <option value="Advanced">Advanced (Deep Dive &amp; Complex Problem Sets)</option>
                </select>
              </div>

              {/* 7. Learning Goal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  7. Learning Goal <span className="text-rose-500">*</span>
                </label>
                <select
                  value={learningGoal}
                  onChange={(e) => setLearningGoal(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Exam Preparation">Exam Preparation</option>
                  <option value="Concept Understanding">Concept Understanding</option>
                  <option value="Revision">Revision</option>
                  <option value="Complete Syllabus">Complete Syllabus</option>
                </select>
              </div>

              {/* 8. Break Duration (Strictly 5 to 15 mins only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  8. Break Duration <span className="text-rose-500">*</span> (5–15 mins only)
                </label>
                <select
                  value={breakDuration}
                  onChange={(e) => setBreakDuration(parseInt(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes (Maximum allowed)</option>
                </select>
              </div>

              {/* 9. Revision Preference */}
              <div className="flex items-center pt-5">
                <label className="relative flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRevision}
                    onChange={(e) => setIncludeRevision(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      9. Include Revision Sessions
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Include daily recall sessions and a final review prior to target date.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          {/* =========================================================================
              SECTION C — Generate Study Plan
          ========================================================================= */}
          <div className="space-y-3">
            {generationError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{generationError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={!selectedDocId || generating || !startDate || !targetDate || targetDate <= startDate}
              onClick={handleGeneratePlan}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                !selectedDocId || generating || !startDate || !targetDate || targetDate <= startDate
                  ? 'bg-indigo-400 dark:bg-indigo-900 cursor-not-allowed opacity-60'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/25 hover:shadow-indigo-600/35 hover:-translate-y-0.5'
              }`}
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing PDF Topics &amp; Building Timetable...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate My Study Plan</span>
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Extracts core modules from your uploaded PDF and allocates a structured timetable matching your exact time budget.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
