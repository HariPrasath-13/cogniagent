'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Play,
  FileText,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  Target,
  Loader2,
  AlertCircle,
  RotateCcw,
  Trash2,
  Calendar,
  Layers,
  HelpCircle,
  ChevronDown,
  Check,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  getStudyMaterials,
  getStudyPlans,
  getStudyPlan,
  generateStudyPlan,
  updateStudyPlanSession,
  deleteStudyPlan,
  StudyMaterialItem,
  StudyPlanItem,
  StudyPlanSession,
} from '@/lib/assessment-api';

function StudyPlanContent() {
  const searchParams = useSearchParams();
  const preselectedDocId = searchParams.get('docId');

  const [activeTab, setActiveTab] = useState<'schedule' | 'overview' | 'all-plans'>('schedule');
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [plans, setPlans] = useState<StudyPlanItem[]>([]);
  const [activePlan, setActivePlan] = useState<StudyPlanItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Modal form fields
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [targetDays, setTargetDays] = useState<number>(7);
  const [dailyMinutes, setDailyMinutes] = useState<number>(45);
  const [knowledgeLevel, setKnowledgeLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [studyGoal, setStudyGoal] = useState<'concept_understanding' | 'exam_preparation' | 'revision'>('concept_understanding');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorNotice(null);
      const [matRes, planRes] = await Promise.all([
        getStudyMaterials().catch(() => ({ materials: [] })),
        getStudyPlans().catch(() => ({ plans: [] })),
      ]);

      setMaterials(matRes.materials || []);
      const loadedPlans = planRes.plans || [];
      setPlans(loadedPlans);

      if (loadedPlans.length > 0) {
        setActivePlan(loadedPlans[0]);
      } else {
        setActivePlan(null);
      }

      if (preselectedDocId) {
        const idNum = parseInt(preselectedDocId);
        if (!isNaN(idNum)) {
          setSelectedDocId(idNum);
          setCreateModalOpen(true);
        }
      } else if (matRes.materials && matRes.materials.length > 0) {
        setSelectedDocId(matRes.materials[0].id);
      }
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to load study plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [preselectedDocId]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId) {
      setModalError('Please select a study material to generate your plan.');
      return;
    }

    setIsGenerating(true);
    setModalError(null);

    try {
      const res = await generateStudyPlan({
        document_id: selectedDocId,
        target_days: targetDays,
        daily_minutes: dailyMinutes,
        knowledge_level: knowledgeLevel,
        study_goal: studyGoal,
      });

      const newPlan = res.plan;
      setPlans((prev) => [newPlan, ...prev]);
      setActivePlan(newPlan);
      setCreateModalOpen(false);
      setActiveTab('schedule');
    } catch (err: any) {
      setModalError(err.message || 'Failed to generate study plan. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleSession = async (sessionNumber: number, currentlyCompleted: boolean) => {
    if (!activePlan) return;
    const newStatus = currentlyCompleted ? 'not_started' : 'completed';

    // Optimistic UI update
    const prevCompleted = [...activePlan.completed_sessions];
    const nextCompleted = currentlyCompleted
      ? prevCompleted.filter((n) => n !== sessionNumber)
      : [...prevCompleted, sessionNumber].sort((a, b) => a - b);

    const nextPct = Math.round((nextCompleted.length / (activePlan.sessions.length || 1)) * 100);

    const updatedPlan: StudyPlanItem = {
      ...activePlan,
      completed_sessions: nextCompleted,
      progress_pct: nextPct,
      sessions: activePlan.sessions.map((s) =>
        s.session_number === sessionNumber
          ? { ...s, status: currentlyCompleted ? 'not_started' : 'completed' }
          : s
      ),
    };

    setActivePlan(updatedPlan);
    setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? updatedPlan : p)));

    try {
      await updateStudyPlanSession(activePlan.id, sessionNumber, newStatus);
    } catch (err) {
      // Revert on error
      loadData();
    }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!confirm('Are you sure you want to delete this study plan?')) return;
    try {
      await deleteStudyPlan(planId);
      const remaining = plans.filter((p) => p.id !== planId);
      setPlans(remaining);
      setActivePlan(remaining.length > 0 ? remaining[0] : null);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to delete plan.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            Your Personalized Study Plan
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            AI-structured learning milestones grounded in your uploaded materials
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setModalError(null);
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Plan &gt;</span>
          </button>
        </div>
      </div>

      {errorNotice && (
        <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          {errorNotice}
        </div>
      )}

      {/* Main Content Area */}
      {!activePlan ? (
        <EmptyState
          icon={Sparkles}
          title="No Study Plan Generated Yet"
          description="No study plan yet. Upload a PDF or select an existing material to create your plan."
          actionText={materials.length > 0 ? 'Create First Study Plan' : 'Upload PDF Material'}
          actionHref={materials.length > 0 ? undefined : '/upload'}
          onAction={
            materials.length > 0
              ? () => {
                  setModalError(null);
                  setCreateModalOpen(true);
                }
              : undefined
          }
          className="py-16"
        />
      ) : (
        <>
          {/* Active Plan Progress Hero Banner */}
          <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    {activePlan.config.knowledge_level || 'Custom'} Plan
                  </span>
                  <span className="text-xs text-slate-400">
                    • Based on {activePlan.document_name}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {activePlan.overview.title || `Plan for ${activePlan.document_name}`}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {activePlan.overview.learning_objective}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <Link
                  href="/upload"
                  className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-indigo-600 dark:fill-indigo-400" />
                  <span>Practice Test</span>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDeletePlan(activePlan.id)}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Delete this plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Completion Status:</span>
                </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {activePlan.completed_sessions.length} of {activePlan.sessions.length} Sessions Completed ({activePlan.progress_pct}%)
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, activePlan.progress_pct))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{activePlan.config.daily_minutes} mins/day commitment</span>
                <span>{activePlan.overview.estimated_total_hours} total hours estimated</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
            {[
              { id: 'schedule', label: `Daily Schedule (${activePlan.sessions.length} Days)` },
              { id: 'overview', label: 'Plan Overview & Topics' },
              { id: 'all-plans', label: `Saved Plans (${plans.length})` },
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

          {/* Tab 1: Daily Schedule */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              {activePlan.sessions.map((session) => {
                const isCompleted = activePlan.completed_sessions.includes(session.session_number);

                return (
                  <div
                    key={session.session_number}
                    className={`bg-white dark:bg-[#111827] rounded-3xl p-5 sm:p-6 border transition-all ${
                      isCompleted
                        ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/10 dark:bg-emerald-950/10'
                        : session.is_revision_session
                        ? 'border-purple-200 dark:border-purple-900/60 bg-purple-50/10 dark:bg-purple-950/10'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSession(session.session_number, isCompleted)}
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                              : 'border-2 border-slate-300 dark:border-slate-700 hover:border-indigo-600 text-transparent'
                          }`}
                          title={isCompleted ? 'Mark as incomplete' : 'Mark as completed'}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                              Day {session.day_number}
                            </span>
                            <span className="text-[11px] text-slate-400">• {session.estimated_minutes} mins</span>
                            {session.is_revision_session && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                                Revision &amp; Assessment
                              </span>
                            )}
                            {isCompleted && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                Completed
                              </span>
                            )}
                          </div>

                          <h3
                            className={`text-base font-bold ${
                              isCompleted
                                ? 'text-slate-500 dark:text-slate-400 line-through'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {session.title}
                          </h3>

                          {/* Concepts from PDF */}
                          {session.concepts_to_study && session.concepts_to_study.length > 0 && (
                            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">
                                Grounded Concepts to Study:
                              </span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {session.concepts_to_study.map((c, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-700 dark:text-slate-300"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Learning Objectives */}
                          {session.learning_objectives && session.learning_objectives.length > 0 && (
                            <ul className="text-xs text-slate-500 dark:text-slate-400 list-disc list-inside space-y-0.5 pt-1">
                              {session.learning_objectives.map((obj, i) => (
                                <li key={i}>{obj}</li>
                              ))}
                            </ul>
                          )}

                          {/* Practice Questions Grounded in Material */}
                          {session.practice_questions && session.practice_questions.length > 0 && (
                            <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-1.5 mt-2">
                              <p className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                                <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Grounded Practice Questions:</span>
                              </p>
                              {session.practice_questions.map((q, i) => (
                                <p key={i} className="text-slate-700 dark:text-slate-300 pl-4 border-l-2 border-indigo-300 dark:border-indigo-700">
                                  {q}
                                </p>
                              ))}
                            </div>
                          )}

                          {/* Revision Activity */}
                          {session.revision_activity && (
                            <p className="text-[11px] text-slate-400 italic pt-1">
                              <strong>Daily Recall Activity:</strong> {session.revision_activity}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleSession(session.session_number, isCompleted)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isCompleted
                              ? 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20'
                          }`}
                        >
                          {isCompleted ? 'Mark Incomplete' : 'Complete Session'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 2: Plan Overview & Topics */}
          {activeTab === 'overview' && (
            <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <span>Curriculum Architecture &amp; Major Topics</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Synthesized from the structure and terminology in {activePlan.document_name}
                </p>
              </div>

              {/* Major Topics */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Major Topics in Recommended Order
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(activePlan.overview.recommended_learning_order || activePlan.overview.major_topics || []).map(
                    (topic, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center gap-3"
                      >
                        <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {topic}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Assessment link */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50/80 to-purple-50/50 dark:from-indigo-950/40 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Ready to validate your learning?
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Generate an AI quiz from {activePlan.document_name} to test your retention.
                  </p>
                </div>
                <Link
                  href="/upload"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all shrink-0 text-center"
                >
                  Generate Assessment
                </Link>
              </div>
            </div>
          )}

          {/* Tab 3: Saved Plans */}
          {activeTab === 'all-plans' && (
            <div className="space-y-4">
              {plans.map((p) => {
                const isActive = p.id === activePlan.id;
                return (
                  <div
                    key={p.id}
                    className={`bg-white dark:bg-[#111827] rounded-3xl p-5 border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      isActive
                        ? 'border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/10'
                        : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {p.overview.title || `Plan for ${p.document_name}`}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {p.document_name} • {p.sessions.length} Sessions • {p.progress_pct}% Completed
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            setActivePlan(p);
                            setActiveTab('schedule');
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          Switch to this Plan
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(p.id)}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Delete plan"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Plan Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Create AI Study Plan
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your uploaded PDF and configure your personalized learning pace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="space-y-4">
              {/* Material Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Study Material (Your Uploaded PDFs)
                </label>
                {materials.length === 0 ? (
                  <div className="p-3 text-xs rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 dark:text-amber-300 space-y-2">
                    <p>No study PDFs uploaded to your account yet.</p>
                    <Link
                      href="/upload"
                      className="inline-block px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold"
                    >
                      Upload a PDF first
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedDocId || ''}
                    onChange={(e) => setSelectedDocId(parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.filename} ({Math.round((m.char_count || 0) / 1000)}k chars)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Study Days & Daily Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Study Duration (Days)
                  </label>
                  <select
                    value={targetDays}
                    onChange={(e) => setTargetDays(parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value={3}>3 Days (Crash Course)</option>
                    <option value={5}>5 Days (Sprint)</option>
                    <option value={7}>7 Days (1 Week Standard)</option>
                    <option value={10}>10 Days (Deep Learning)</option>
                    <option value={14}>14 Days (2 Weeks Comprehensive)</option>
                    <option value={21}>21 Days (3 Weeks)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Available Time / Day
                  </label>
                  <select
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value={20}>20 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes (1 hr)</option>
                    <option value={90}>90 minutes (1.5 hrs)</option>
                    <option value={120}>120 minutes (2 hrs)</option>
                  </select>
                </div>
              </div>

              {/* Knowledge Level & Goal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Knowledge Level
                  </label>
                  <select
                    value={knowledgeLevel}
                    onChange={(e) => setKnowledgeLevel(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="beginner">Beginner (Foundations first)</option>
                    <option value="intermediate">Intermediate (Standard depth)</option>
                    <option value="advanced">Advanced (Deep mechanisms)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Primary Goal
                  </label>
                  <select
                    value={studyGoal}
                    onChange={(e) => setStudyGoal(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="concept_understanding">Concept Understanding</option>
                    <option value="exam_preparation">Exam Preparation</option>
                    <option value="revision">Fast Revision</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || materials.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating Plan with AI...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Create Plan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudyPlanPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    }>
      <StudyPlanContent />
    </Suspense>
  );
}
