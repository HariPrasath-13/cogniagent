import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: 'emerald' | 'purple' | 'amber' | 'blue';
  isEmpty?: boolean;
}

export function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  variant = 'purple',
  isEmpty = false,
}: MetricCardProps) {
  const variantStyles = {
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      border: 'border-emerald-100 dark:border-emerald-900/50',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400',
      valueColor: 'text-emerald-700 dark:text-emerald-300',
    },
    purple: {
      bg: 'bg-indigo-50/70 dark:bg-indigo-950/40',
      border: 'border-indigo-100 dark:border-indigo-900/50',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400',
      valueColor: 'text-indigo-700 dark:text-indigo-300',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/40',
      border: 'border-amber-100 dark:border-amber-900/50',
      iconBg: 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400',
      valueColor: 'text-amber-700 dark:text-amber-300',
    },
    blue: {
      bg: 'bg-sky-50 dark:bg-sky-950/40',
      border: 'border-sky-100 dark:border-sky-900/50',
      iconBg: 'bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400',
      valueColor: 'text-sky-700 dark:text-sky-300',
    },
  };

  const currentVariant = variantStyles[variant];

  return (
    <div
      className={`rounded-2xl p-5 border ${currentVariant.bg} ${currentVariant.border} shadow-xs flex items-center justify-between transition-all`}
    >
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className={`text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight ${isEmpty ? 'text-slate-400 dark:text-slate-500' : currentVariant.valueColor}`}>
          {value}
        </p>
        {subtitle && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      <div className={`w-12 h-12 rounded-2xl ${currentVariant.iconBg} flex items-center justify-center shrink-0 shadow-2xs`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  );
}
