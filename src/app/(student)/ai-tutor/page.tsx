'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Send,
  Bot,
  User,
  Sparkles,
  FileText,
  RotateCcw,
  BookOpen,
  HelpCircle,
  Lightbulb,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { ChatMessage } from '@/types';
import {
  getTutorDocuments,
  uploadTutorDocument,
  getTutorHistory,
  sendTutorMessage,
  clearTutorHistory,
  TutorDocument,
} from '@/lib/assessment-api';

export default function AiTutorPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<TutorDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const promptChips = [
    'Summarize key concepts',
    'Explain the main topic with examples',
    'Generate 3 practice questions',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Load user's authentic documents and message history
  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInitial(true);
        setErrorMessage(null);

        const [docsRes, histRes] = await Promise.all([
          getTutorDocuments().catch(() => ({ documents: [] })),
          getTutorHistory().catch(() => ({ messages: [] })),
        ]);

        setDocuments(docsRes.documents);
        if (docsRes.documents.length > 0) {
          setSelectedDocId(docsRes.documents[0].id);
        }

        if (histRes.messages && histRes.messages.length > 0) {
          setMessages(
            histRes.messages.map((m) => ({
              id: `msg-${m.id}`,
              sender: m.sender,
              text: m.text,
              timestamp: new Date(m.created_at * 1000).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              source: m.source_file
                ? {
                    file: m.source_file,
                    excerpt: m.source_excerpt || undefined,
                  }
                : undefined,
            }))
          );
        } else {
          setMessages([]);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to load study assistant data.');
      } finally {
        setLoadingInitial(false);
      }
    }

    loadData();
  }, []);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setErrorMessage(null);

    try {
      const response = await sendTutorMessage(text.trim(), selectedDocId || undefined);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: response.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: response.source
          ? {
              file: response.source.file,
              excerpt: response.source.excerpt,
            }
          : undefined,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate response. Please ensure the AI service is active.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF documents are supported for study materials.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const res = await uploadTutorDocument(file);
      const newDoc = res.document;
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDocId(newDoc.id);

      // Add a greeting message from assistant
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-upload-${Date.now()}`,
          sender: 'assistant',
          text: `I've indexed **${newDoc.filename}**. What would you like to explore or clarify in this document?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: { file: newDoc.filename },
        },
      ]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload and index document.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearTutorHistory();
      setMessages([]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to clear conversation history.');
    }
  };

  const activeDoc = documents.find((d) => d.id === selectedDocId) || documents[0];

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8.5rem)] flex flex-col bg-white dark:bg-[#111827] rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Hidden File Input for PDF upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Tutor Header matching Screen 12 */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Chat with Your Study Assistant</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                AI Active
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-400">
              {activeDoc
                ? `Grounded in ${activeDoc.filename}`
                : 'Upload a study document to ground tutor responses'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {documents.length > 1 && (
            <select
              value={selectedDocId || ''}
              onChange={(e) => setSelectedDocId(Number(e.target.value))}
              aria-label="Select study material"
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
            title="Upload new study material"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{isUploading ? 'Uploading...' : 'Add Material'}</span>
          </button>

          <button
            type="button"
            onClick={handleClearHistory}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Clear chat history"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error alert if present */}
      {errorMessage && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Message History List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {loadingInitial ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
            <p className="text-xs">Loading assistant and course materials...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-6">
            <div className="w-14 h-14 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-sm">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Study Documents Uploaded Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-5">
              Upload your textbook, lecture slides, or revision notes to start an interactive,
              grounded tutoring session with AI assistance.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload PDF Notes</span>
              </button>
              <Link
                href="/upload"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span>Go to Assessments</span>
              </Link>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto p-6 text-slate-400">
            <Sparkles className="w-8 h-8 text-indigo-500 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Ready to learn with {activeDoc?.filename}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Ask any question about your document, request summaries, or pick a suggestion below.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    S
                  </div>
                )}

                <div
                  className={`max-w-xl rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-br-xs shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-700/80 shadow-2xs'
                  }`}
                >
                  <div className="whitespace-pre-line">{msg.text}</div>

                  {/* Source Evidence Citation Badge matching Screen 12 */}
                  {msg.source && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 flex flex-col gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>Source: {msg.source.file}</span>
                      </div>
                      {msg.source.excerpt && (
                        <p className="text-[10px] text-slate-500 font-normal italic line-clamp-2">
                          "{msg.source.excerpt}"
                        </p>
                      )}
                    </div>
                  )}

                  <span
                    className={`block text-[10px] mt-1.5 text-right ${
                      isUser ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isTyping && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              S
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl rounded-bl-xs flex items-center gap-2 text-slate-400 text-xs">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:300ms]" />
              <span className="ml-1 text-[11px] text-slate-500">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompt Chips matching Screen 12 */}
      {documents.length > 0 && (
        <div className="px-4 py-2 bg-slate-50/60 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Suggestions:</span>
          {promptChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip)}
              disabled={isTyping}
              className="px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input Form Bar */}
      <div className="p-3 sm:p-4 bg-white dark:bg-[#111827] border-t border-slate-200/80 dark:border-slate-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping || documents.length === 0}
            placeholder={
              documents.length === 0
                ? 'Upload a document above to begin asking questions...'
                : 'Ask a question about your study material...'
            }
            className="flex-1 px-4 py-3 text-xs sm:text-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping || documents.length === 0}
            className="w-11 h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0 transition-all cursor-pointer"
          >
            {isTyping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
