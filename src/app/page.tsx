'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  CheckCircle2,
  Play,
  ArrowRight,
  BookOpen,
  Brain,
  BarChart3,
  FileText,
  ShieldCheck,
  Zap,
  Bot,
  Users,
  Layers,
  X,
} from 'lucide-react';
import { CogniLogo } from '@/components/shared/CogniLogo';

export default function LandingPage() {
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/20 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <CogniLogo size="md" href="/" />

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              How It Works
            </a>
            <a href="#about" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              About
            </a>
            <a href="#contact" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Contact
            </a>
            <Link href="/admin" className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700">
              Admin Portal
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/signin"
              className="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-12 pb-20 lg:pt-16 lg:pb-28">
          {/* Subtle background glow */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-500/15 via-purple-500/10 to-pink-500/10 blur-3xl pointer-events-none rounded-full" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              {/* Left Column: Copy & CTAs */}
              <div className="lg:col-span-7 space-y-7 text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold tracking-wide">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>Next-Gen RAG Study Engine</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
                  Learn Smarter <br />
                  <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500 bg-clip-text text-transparent">
                    with AI
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                  Upload your study materials, take personalized assessments, track your progress, and get AI-powered recommendations.
                </p>

                {/* Feature Bullet List as shown in PDF */}
                <div className="space-y-3.5 pt-1">
                  {[
                    'AI-Generated MCQs from your PDFs',
                    'Adaptive Learning Path',
                    'Personalized Study Assistant',
                    'Track Progress & Improve Faster',
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <span className="text-sm sm:text-base font-medium text-slate-700 dark:text-slate-200">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-3">
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm sm:text-base shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40 transition-all transform hover:-translate-y-0.5"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setShowDemoModal(true)}
                    className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-sm sm:text-base shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Play className="w-3 h-3 fill-indigo-600 dark:fill-indigo-400" />
                    </div>
                    <span>Watch Demo</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Hero Visual Illustration */}
              <div className="lg:col-span-5 relative flex items-center justify-center">
                <div className="relative w-full max-w-md aspect-square rounded-3xl bg-gradient-to-tr from-indigo-500/10 via-purple-500/10 to-pink-500/5 p-6 border border-indigo-100/60 dark:border-indigo-900/40 flex items-center justify-center shadow-2xl shadow-indigo-500/10">
                  {/* Central Glow Disc */}
                  <div className="w-64 h-64 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 opacity-20 blur-2xl absolute" />

                  {/* Dynamic Interactive Illustration Canvas */}
                  <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
                    {/* Character / Learning Icon Centerpiece */}
                    <div className="relative w-44 h-44 rounded-full bg-gradient-to-b from-indigo-100 to-indigo-200 dark:from-indigo-900/60 dark:to-purple-950/60 border-4 border-white dark:border-slate-800 shadow-xl flex items-center justify-center overflow-hidden">
                      {/* Stylized Learner Silhouette & Laptop */}
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-md mb-2">
                          <Brain className="w-8 h-8 text-white" />
                        </div>
                        <div className="w-24 h-6 rounded-md bg-white/80 dark:bg-slate-800/90 shadow-xs flex items-center justify-center border border-indigo-100 dark:border-indigo-900">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">CogniAgent AI</span>
                        </div>
                      </div>
                    </div>

                    {/* Floating Badge 1: Top Left PDF */}
                    <div className="absolute top-4 left-2 bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg border border-slate-100 dark:border-slate-800 flex items-center gap-2.5 animate-bounce [animation-duration:4s]">
                      <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-500 flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">DBMS_Unit2.pdf</p>
                        <p className="text-[9px] text-slate-400">120 pages analyzed</p>
                      </div>
                    </div>

                    {/* Floating Badge 2: Top Right Mastery */}
                    <div className="absolute top-6 right-2 bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <BarChart3 className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">95% Mastery</p>
                        <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">+14% this week</p>
                      </div>
                    </div>

                    {/* Floating Badge 3: Bottom Left Assistant */}
                    <div className="absolute bottom-4 left-4 bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">AI Tutor</p>
                        <p className="text-[9px] text-slate-400">RAG Grounded</p>
                      </div>
                    </div>

                    {/* Floating Badge 4: Bottom Right Question */}
                    <div className="absolute bottom-6 right-4 bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-lg border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Adaptive MCQs</p>
                        <p className="text-[9px] text-slate-400">Instant Feedback</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row from PDF */}
            <div className="mt-16 pt-8 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white dark:bg-slate-900/80 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800">
                <div className="text-center border-r border-slate-100 dark:border-slate-800/60 last:border-none">
                  <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">10K+</p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Happy Learners</p>
                </div>
                <div className="text-center md:border-r border-slate-100 dark:border-slate-800/60 last:border-none">
                  <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">500+</p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Study Materials</p>
                </div>
                <div className="text-center border-r border-slate-100 dark:border-slate-800/60 last:border-none">
                  <p className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">95%</p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">User Satisfaction</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl sm:text-3xl font-extrabold text-purple-600 dark:text-purple-400">AI</p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">RAG-Powered</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-slate-100/50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-xs uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                Features
              </h2>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                Everything You Need for High-Yield Study
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-3">
                Built specifically for university courses, certifications, and technical textbooks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: FileText,
                  title: 'Document Chunking & Vector Search',
                  desc: 'Upload PDFs, syllabi, and lecture slides. Our semantic pipeline indexes key definitions, theorems, and proofs.',
                },
                {
                  icon: Zap,
                  title: 'Dynamic MCQ Assessment Engine',
                  desc: 'Test knowledge with auto-generated multi-choice questions with verified citations from your uploaded pages.',
                },
                {
                  icon: Bot,
                  title: 'Context-Aware AI Study Tutor',
                  desc: 'Chat directly with your notes. Get step-by-step solutions, analogies, and page-specific references.',
                },
              ].map((f, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-6">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{f.title}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-xs uppercase tracking-wider font-bold text-indigo-600 dark:text-indigo-400 mb-2">
                Workflow
              </h2>
              <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                How CogniAgent Accelerates Learning
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {[
                {
                  step: '01',
                  title: 'Upload Material',
                  desc: 'Drag & drop lecture notes, textbook chapters, or slide decks in standard PDF format.',
                  link: '/upload',
                },
                {
                  step: '02',
                  title: 'Customized Assessment',
                  desc: 'Configure difficulty, question count, and time limit to simulate real test environments.',
                  link: '/test-setup',
                },
                {
                  step: '03',
                  title: 'Master Weak Areas',
                  desc: 'Review exact page-level source citations and consult the personalized AI Tutor for remediation.',
                  link: '/study-plan',
                },
              ].map((s, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-left relative"
                >
                  <span className="text-4xl font-extrabold text-indigo-100 dark:text-indigo-950/80 mb-4 block">
                    {s.step}
                  </span>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{s.title}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">{s.desc}</p>
                  <Link
                    href={s.link}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:gap-2 transition-all"
                  >
                    <span>Try flow</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <CogniLogo size="sm" />
          <div className="flex items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/signin" className="hover:text-indigo-600">Sign In</Link>
            <Link href="/signup" className="hover:text-indigo-600">Sign Up</Link>
            <Link href="/dashboard" className="hover:text-indigo-600">Student Dashboard</Link>
            <Link href="/admin" className="hover:text-indigo-600">Research Admin</Link>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            © 2026 CogniAgent. Frontend Phase.
          </p>
        </div>
      </footer>

      {/* Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-indigo-600" />
                <span>CogniAgent Product Tour</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="aspect-video rounded-xl bg-slate-950 flex flex-col items-center justify-center text-center p-6 text-white mb-5 border border-slate-800">
              <Brain className="w-12 h-12 text-indigo-400 mb-3 animate-pulse" />
              <p className="text-sm font-semibold">Interactive UI Demonstration</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Explore the complete 16-screen frontend prototype including student assessments, AI tutor, and admin evaluation.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDemoModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Close
              </button>
              <Link
                href="/dashboard"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                Open Student Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
