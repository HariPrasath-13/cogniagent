'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { StudentSidebar } from '@/components/student/StudentSidebar';
import { StudentTopbar } from '@/components/student/StudentTopbar';
import { getSession } from '@/lib/auth-api';
import { Loader2 } from 'lucide-react';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    const { token, user } = getSession();
    if (!token || !user) {
      setIsAuthorized(false);
      const redirectQuery = pathname ? `?redirect=${encodeURIComponent(pathname)}` : '';
      router.replace(`/signin${redirectQuery}`);
    } else {
      setIsAuthorized(true);
    }
  }, [router, pathname]);

  if (isAuthorized === null || isAuthorized === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#090e1a]">
        <div className="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#090e1a] text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sidebar */}
      <StudentSidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <StudentTopbar
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
