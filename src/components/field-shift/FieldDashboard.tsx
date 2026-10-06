"use client";

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { FieldNavigation } from './FieldNavigation';
import {
  FieldOverview,
  SignalsPanel,
  CropsPanel,
  PlannerPanel,
  ComparePanel,
  LearnPanel,
} from './dashboard';

export function FieldDashboard() {
  const tab = useAppStore(s => s.dashboardTab);
  const analysis = useAppStore(s => s.analysis);

  if (!analysis) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        No analysis available.
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh w-full">
      <FieldNavigation />

      {/* Top spacer so floating desktop nav doesn't overlap content */}
      <div className="h-16 sm:h-20" />

      {/* Tab content */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6 sm:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {tab === 'field' && <FieldOverview analysis={analysis} />}
            {tab === 'signals' && <SignalsPanel analysis={analysis} />}
            {tab === 'crops' && <CropsPanel analysis={analysis} />}
            {tab === 'planner' && <PlannerPanel analysis={analysis} />}
            {tab === 'compare' && <ComparePanel analysis={analysis} />}
            {tab === 'learn' && <LearnPanel analysis={analysis} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-white/5 px-4 py-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 sm:px-6">
        Field Shift · NASA Earth-observation decision system · POWER · SMAP · GPM · MODIS
      </footer>
    </div>
  );
}
