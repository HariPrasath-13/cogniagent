import React from 'react';
import Link from 'next/link';

interface CogniLogoProps {
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark' | 'auto';
  href?: string;
}

export function CogniLogo({ size = 'md', theme = 'auto', href = '/' }: CogniLogoProps) {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const content = (
    <div className="flex items-center gap-2.5 font-bold tracking-tight select-none">
      <div
        className={`${iconSizes[size]} rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5/8 h-5/8"
        >
          <path d="M12 2a4 4 0 0 0-4 4c0 .8.2 1.5.7 2.1L4.5 12a4 4 0 1 0 5.6 5.6l3.8-4.2c.6.5 1.3.7 2.1.7a4 4 0 0 0 4-4c0-.8-.2-1.5-.7-2.1l4.2-3.9a4 4 0 1 0-5.6-5.6L14.1 6.3c-.6-.5-1.3-.7-2.1-.7z" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      </div>
      <span
        className={`${textSizes[size]} font-extrabold ${
          theme === 'dark'
            ? 'text-white'
            : theme === 'light'
            ? 'text-slate-900'
            : 'text-slate-900 dark:text-white'
        }`}
      >
        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Cogni
        </span>
        <span
          className={
            theme === 'dark'
              ? 'text-slate-100'
              : theme === 'light'
              ? 'text-slate-800'
              : 'text-slate-800 dark:text-slate-100'
          }
        >
          Agent
        </span>
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-block hover:opacity-95 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
