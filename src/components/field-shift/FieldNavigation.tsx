"use client";

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Globe2, Activity, Sprout, CalendarClock, BarChart3, GraduationCap, Home, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type DashboardTab } from '@/lib/store';

interface Tab {
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: 'field', label: 'Field', icon: Globe2 },
  { id: 'signals', label: 'Signals', icon: Activity },
  { id: 'crops', label: 'Crops', icon: Sprout },
  { id: 'planner', label: 'Planner', icon: CalendarClock },
  { id: 'compare', label: 'Compare', icon: BarChart3 },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
  { id: 'advisor', label: 'Advisor', icon: MessageSquare },
];

export function FieldNavigation() {
  const tab = useAppStore(s => s.dashboardTab);
  const setTab = useAppStore(s => s.setDashboardTab);
  const reset = useAppStore(s => s.reset);

  return (
    <>
      {/* Desktop — floating pill at top */}
      <nav className="pointer-events-none fixed inset-x-0 top-4 z-50 hidden justify-center sm:flex">
        <div className="glass-panel pointer-events-auto flex items-center gap-1 rounded-full px-2 py-1.5 shadow-2xl">
          <button
            type="button"
            onClick={reset}
            className="mr-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-amber-200/80 transition-colors hover:bg-amber-400/10 hover:text-amber-200"
            title="Back to globe"
          >
            <Home className="size-3.5" />
            <span className="hidden md:inline">Home</span>
          </button>
          <div className="mx-1 h-5 w-px bg-white/10" />
          {TABS.map(t => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all',
                  active ? 'text-amber-100' : 'text-muted-foreground/80 hover:text-foreground',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full bg-amber-400/20"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon className="relative size-3.5" />
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile — fixed bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 sm:hidden">
        <div className="glass-panel mx-2 mb-2 flex items-center justify-around rounded-2xl px-1 py-1.5">
          {TABS.map(t => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors',
                  active ? 'text-amber-200' : 'text-muted-foreground/70',
                )}
              >
                <span className={cn(
                  'flex size-7 items-center justify-center rounded-lg transition-all',
                  active && 'bg-amber-400/20',
                )}>
                  <Icon className="size-4" />
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
