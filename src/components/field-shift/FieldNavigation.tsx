"use client";

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Globe2, Activity, Sprout, BarChart3, GraduationCap, Home, MessageSquare, SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore, type DashboardTab } from '@/lib/store';
import { useTranslation } from '@/lib/locale';

interface Tab {
  id: DashboardTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: 'field', label: 'Field', icon: Globe2 },
  { id: 'signals', label: 'Signals', icon: Activity },
  { id: 'workspace', label: 'Crop Workspace', icon: Sprout },
  { id: 'compare', label: 'Compare', icon: BarChart3 },
  { id: 'scenario', label: 'What-if', icon: SlidersHorizontal },
  { id: 'advisor', label: 'Advisor', icon: MessageSquare },
  { id: 'learn', label: 'Learn', icon: GraduationCap },
];

export function FieldNavigation() {
  const { t: translate } = useTranslation();
  const tab = useAppStore(s => s.dashboardTab);
  const setTab = useAppStore(s => s.setDashboardTab);
  const reset = useAppStore(s => s.reset);

  return (
    <>
      {/* Desktop — floating pill at top */}
      <nav className="pointer-events-none fixed inset-x-0 top-4 z-50 hidden justify-center px-3 sm:flex">
        <div className="glass-panel pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-1 overflow-x-auto rounded-full px-2 py-1.5 shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={reset}
            className="mr-1 flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-amber-200/80 transition-colors hover:bg-amber-400/10 hover:text-amber-200"
            title={translate('Back to globe')}
          >
            <Home className="size-3.5" />
            <span className="hidden lg:inline">{translate('Home')}</span>
          </button>
          <div className="mx-1 h-5 w-px shrink-0 bg-white/10" />
          {TABS.map(t => {
            const active =
              tab === t.id ||
              (t.id === 'workspace' && (tab === 'crops' || tab === 'planner'));
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all md:px-3.5',
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
                <span className="relative whitespace-nowrap">{translate(t.label)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile — fixed bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="glass-panel mx-2 mb-2 flex items-center gap-0.5 overflow-x-auto rounded-2xl px-1 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(t => {
            const active =
              tab === t.id ||
              (t.id === 'workspace' && (tab === 'crops' || tab === 'planner'));
            const Icon = t.icon;
            const shortLabel = t.id === 'workspace' ? 'Crops' : t.label;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex min-w-[3.25rem] shrink-0 flex-col items-center gap-0.5 rounded-xl px-1.5 py-1.5 text-[10px] font-medium transition-colors',
                  active ? 'text-amber-200' : 'text-muted-foreground/70',
                )}
              >
                <span className={cn(
                  'flex size-7 items-center justify-center rounded-lg transition-all',
                  active && 'bg-amber-400/20',
                )}>
                  <Icon className="size-4" />
                </span>
                <span className="max-w-[3.5rem] truncate">{translate(shortLabel)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
