'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileUp,
  ClipboardCheck,
  BookOpen,
  Bot,
  User,
  Settings,
  LogOut,
  Shield,
  X,
} from 'lucide-react';
import { CogniLogo } from '@/components/shared/CogniLogo';
import { clearSession } from '@/lib/auth-api';

interface StudentSidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function StudentSidebar({ mobileOpen = false, onCloseMobile }: StudentSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Upload PDF', href: '/upload', icon: FileUp },
    { label: 'Take Test', href: '/test-setup', icon: ClipboardCheck },
    { label: 'Study Plan', href: '/study-plan', icon: BookOpen },
    { label: 'AI Tutor', href: '/ai-tutor', icon: Bot },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0e1726] dark:bg-[#080d1a] text-slate-300 w-64 select-none border-r border-slate-800/60">
      {/* Brand Header */}
      <div className="p-5 flex items-center justify-between border-b border-slate-800/80">
        <CogniLogo size="md" theme="dark" href="/dashboard" />
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Nav Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item, idx) => {
          const isActive =
            pathname === item.href ||
            (item.href === '/test-setup' &&
              (pathname === '/test-interface' || pathname === '/test-results'));

          return (
            <Link
              key={idx}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
            >
              <item.icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Nav / Portal switch */}
      <div className="p-3 border-t border-slate-800/80 space-y-1">
        <Link
          href="/admin"
          onClick={onCloseMobile}
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 transition-colors"
        >
          <Shield className="w-4 h-4" />
          <span>Admin Portal</span>
        </Link>
        <Link
          href="/signin"
          onClick={() => {
            clearSession();
            if (onCloseMobile) onCloseMobile();
          }}
          className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
