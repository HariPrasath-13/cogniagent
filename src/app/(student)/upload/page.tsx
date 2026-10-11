'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  ListChecks,
  Layers,
  Sparkles,
  AlertCircle,
  Loader2,
  HelpCircle,
  FileCheck2,
  Trash2,
  ArrowRight,
  Gauge,
  Check,
  Clock,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  generateAssessment,
  QuestionType,
  DifficultyLevel,
} from '@/lib/assessment-api';

interface LocalPdfFile {
  file: File;
  name: string;
  sizeMb: string;
  status: 'ready' | 'generating' | 'error';
  errorMessage?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<LocalPdfFile | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType>('mcq');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isCustomCount, setIsCustomCount] = useState<boolean>(false);
  const [customCountInput, setCustomCountInput] = useState<string>('5');
  const [testDuration, setTestDuration] = useState<number>(15);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);
  const [customDurationInput, setCustomDurationInput] = useState<string>('15');
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Live timer while AI generation is in progress
  React.useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenerating) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isGenerating]);

  const processFile = (file: File) => {
    setErrorNotice(null);
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorNotice('Only PDF documents are supported. Please select a valid .pdf file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorNotice('File size exceeds the 10 MB limit. Please upload a smaller PDF.');
      return;
    }

    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    setSelectedFile({
      file,
      name: file.name,
      sizeMb: `${sizeMb} MB`,
      status: 'ready',
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const effectiveCount = isCustomCount
    ? Math.max(1, Math.min(15, parseInt(customCountInput) || 5))
    : questionCount;

  const effectiveDuration = isCustomDuration
    ? Math.max(1, Math.min(180, parseInt(customDurationInput) || 15))
    : testDuration;

  const handleGenerate = async () => {
    if (!selectedFile) return;

    if (isCustomCount) {
      const parsed = parseInt(customCountInput);
      if (isNaN(parsed) || parsed < 1 || parsed > 15) {
        setErrorNotice('Please enter a valid question count between 1 and 15.');
        return;
      }
    }

    if (isCustomDuration) {
      const parsed = parseInt(customDurationInput);
      if (isNaN(parsed) || parsed < 1 || parsed > 180) {
        setErrorNotice('Please enter a valid test duration between 1 and 180 minutes.');
        return;
      }
    }

    setIsGenerating(true);
    setErrorNotice(null);

    try {
      const response = await generateAssessment(
        selectedFile.file,
        effectiveCount,
        questionType,
        difficulty,
        effectiveDuration
      );
      // Navigate to the live test interface with the generated assessment ID
      router.push(`/test-interface?id=${response.assessment_id}`);
    } catch (err: any) {
      setErrorNotice(
        err.message || 'Failed to generate assessment. Please ensure the AI service is running.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const getLoadingMessage = () => {
    if (elapsedSeconds < 8) return 'Analyzing PDF and extracting course text...';
    if (elapsedSeconds < 35) return `Generating ${effectiveCount} questions with AI...`;
    return 'Finalizing questions and grading rubrics...';
  };

  const questionTypeSummary =
    questionType === 'mcq'
      ? 'MCQ'
      : questionType === 'question_answer'
      ? 'Question & Answer'
      : 'Mixed';

  const difficultySummary =
    difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          Upload Your Study Material
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload your textbook, lecture notes, or slides (PDF) to generate AI-powered assessment questions.
        </p>
      </div>

      {/* Error alert banner with Retry Action */}
      {errorNotice && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 text-xs sm:text-sm shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-bold">Generation Did Not Complete</p>
              <p className="text-rose-600 dark:text-rose-400 mt-0.5">{errorNotice}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {questionCount > 3 && (
              <button
                type="button"
                onClick={() => {
                  setQuestionCount(3);
                  setErrorNotice(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
              >
                Switch to 3 Questions (Faster)
              </button>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* PDF Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center p-8 sm:p-12 rounded-3xl border-2 border-dashed transition-all bg-white dark:bg-[#111827] text-center ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[1.01]'
            : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-5 shadow-xs">
          <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>

        <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200">
          Drag &amp; drop your PDF here
        </h3>
        <p className="text-xs text-slate-400 my-2">or select a file from your computer</p>

        <button
          type="button"
          disabled={isGenerating}
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-xs sm:text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Browse PDF File
        </button>

        <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500 mt-5">
          Supports text-based PDF up to 10 MB and 100 pages • Secure local AI processing
        </p>
      </div>

      {/* Selected File & Generation Configuration Section */}
      <div className="bg-white dark:bg-[#111827] rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          Assessment Configuration
        </h2>

        {!selectedFile ? (
          <EmptyState
            icon={FileText}
            title="No PDF Selected"
            description="Upload a PDF file using the dropzone above to configure your question type, difficulty, and generate your assessment."
            className="py-10"
          />
        ) : (
          <div className="space-y-6">
            {/* Document Info Card */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {selectedFile.sizeMb} • Ready for question generation
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setSelectedFile(null)}
                  className="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Section A: Question Type Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ListChecks className="w-4 h-4 text-indigo-500" />
                  <span>1. Select Question Type</span>
                </label>
                <span className="text-[11px] text-slate-400">Only one type active</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* MCQ Card */}
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setQuestionType('mcq')}
                  className={`relative p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    questionType === 'mcq'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {questionType === 'mcq' && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5">
                    <ListChecks className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    MCQ (Multiple Choice)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    4 options (A-D) per question with single correct answer and automated scoring.
                  </p>
                </button>

                {/* Question & Answer Card */}
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setQuestionType('question_answer')}
                  className={`relative p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    questionType === 'question_answer'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {questionType === 'question_answer' && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Question &amp; Answer
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Descriptive typed answers evaluated against rubrics and reference criteria.
                  </p>
                </button>

                {/* Mixed Card */}
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setQuestionType('mixed')}
                  className={`relative p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    questionType === 'mixed'
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {questionType === 'mixed' && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                  <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Mixed Assessment
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    A balanced split of multiple-choice and descriptive questions.
                  </p>
                </button>
              </div>
            </div>

            {/* Section B: Difficulty Level Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-indigo-500" />
                  <span>2. Select Difficulty Level</span>
                </label>
                <span className="text-[11px] text-slate-400">Strictly enforced in generation</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Easy */}
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setDifficulty('easy')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    difficulty === 'easy'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Easy
                    </span>
                    {difficulty === 'easy' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Basic concepts, definitions &amp; straightforward recall.
                  </p>
                </button>

                {/* Medium */}
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setDifficulty('medium')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    difficulty === 'medium'
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                      Medium
                    </span>
                    {difficulty === 'medium' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Conceptual understanding, comparisons &amp; application.
                  </p>
                </button>

                {/* Hard */}
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => setDifficulty('hard')}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    difficulty === 'hard'
                      ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Hard
                    </span>
                    {difficulty === 'hard' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Deeper reasoning, analysis &amp; challenging applications.
                  </p>
                </button>
              </div>
            </div>

            {/* Section C: Question Count Selection */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-indigo-500" />
                    <span>3. Number of Questions</span>
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Choose assessment length or enter custom count (1–15)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => {
                        setQuestionCount(num);
                        setIsCustomCount(false);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        !isCustomCount && questionCount === num
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                      }`}
                    >
                      {num} Questions
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setIsCustomCount(true)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isCustomCount
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {isCustomCount && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Custom question count:
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={customCountInput}
                    disabled={isGenerating}
                    onChange={(e) => setCustomCountInput(e.target.value)}
                    placeholder="1 - 15"
                    className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-600"
                  />
                  <span className="text-[11px] text-slate-400">
                    (Allowed range: 1 to 15 questions)
                  </span>
                </div>
              )}
            </div>

            {/* Section D: Test Duration Selection */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span>4. Test Duration</span>
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Select allocated time limit (Default: 15 minutes)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[5, 10, 15, 20, 30].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => {
                        setTestDuration(mins);
                        setIsCustomDuration(false);
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        !isCustomDuration && testDuration === mins
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                      }`}
                    >
                      {mins} mins
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setIsCustomDuration(true)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isCustomDuration
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {isCustomDuration && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Custom duration (minutes):
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={customDurationInput}
                    disabled={isGenerating}
                    onChange={(e) => setCustomDurationInput(e.target.value)}
                    placeholder="1 - 180"
                    className="w-24 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-600"
                  />
                  <span className="text-[11px] text-slate-400">
                    (Allowed range: 1 to 180 minutes)
                  </span>
                </div>
              )}
            </div>

            {/* Section E: Configuration Summary & Generate Action */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              {/* Detailed Configuration Summary Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5" />
                    Assessment Configuration Summary
                  </span>
                  <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400 font-medium">
                    Pre-test Review
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-xs">
                  <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-indigo-100/60 dark:border-indigo-900/30">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Uploaded PDF</span>
                    <span className="font-semibold text-slate-900 dark:text-white truncate block" title={selectedFile.name}>
                      {selectedFile.name}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-indigo-100/60 dark:border-indigo-900/30">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Question Type</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {questionTypeSummary}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-indigo-100/60 dark:border-indigo-900/30">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Difficulty</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {difficultySummary}
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-indigo-100/60 dark:border-indigo-900/30">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Questions</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {effectiveCount} questions
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-indigo-100/60 dark:border-indigo-900/30 col-span-2 sm:col-span-1">
                    <span className="block text-[10px] text-slate-400 uppercase font-bold">Test Duration</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {effectiveDuration} mins
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                disabled={!selectedFile || isGenerating}
                onClick={handleGenerate}
                className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm shadow-md shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{getLoadingMessage()} ({elapsedSeconds}s)</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Assessment ({effectiveCount} Questions • {effectiveDuration} Mins)</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
