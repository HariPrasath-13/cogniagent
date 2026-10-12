'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FileText,
  Search,
  Plus,
  Play,
  Trash2,
  CheckCircle2,
  Loader2,
  Calendar,
  BookOpen,
} from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  getStudyMaterials,
  uploadStudyMaterial,
  deleteStudyMaterial,
  StudyMaterialItem,
} from '@/lib/assessment-api';

export default function MaterialsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      setErrorNotice(null);
      const res = await getStudyMaterials();
      setMaterials(res.materials || []);
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to load study materials');
      setMaterials([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorNotice('Only PDF documents are supported.');
      return;
    }

    try {
      setUploading(true);
      setErrorNotice(null);
      await uploadStudyMaterial(file);
      await fetchMaterials();
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this study material?')) return;
    try {
      await deleteStudyMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      setErrorNotice(err.message || 'Failed to delete material.');
    }
  };

  const filtered = materials.filter((m) =>
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

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>{uploading ? 'Processing PDF...' : 'Upload New PDF'}</span>
          </button>
        </div>
      </div>

      {errorNotice && (
        <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          {errorNotice}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter materials by title..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Grid of Materials or Clean Empty State */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : materials.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Study Materials"
          description="No materials uploaded yet. Upload your first PDF to get started."
          actionText="Upload First PDF"
          onAction={() => fileInputRef.current?.click()}
          className="py-16"
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-xs text-slate-400">
          No study materials match your search query &quot;{search}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-[#111827] rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 truncate max-w-[140px]">
                    PDF Material
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Indexed</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                      title="Delete material"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/60 text-red-500 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                      {item.filename}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {item.char_count ? `${Math.round(item.char_count / 1000)}k chars` : 'Analyzed'} •{' '}
                      {new Date(item.created_at * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                <Link
                  href={`/study-plan?docId=${item.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Create Plan</span>
                </Link>
                <Link
                  href="/upload"
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
      )}
    </div>
  );
}
