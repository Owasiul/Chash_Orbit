"use client";

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { FieldNavigation } from './FieldNavigation';
import { AdvisorPanel } from './dashboard/AdvisorPanel';
import {
  FieldOverview,
  SignalsPanel,
  CropsPanel,
  PlannerPanel,
  ComparePanel,
  LearnPanel,
} from './dashboard';
import { useTranslation } from '@/lib/locale';

export function FieldDashboard() {
  const { t } = useTranslation();
  const tab = useAppStore(s => s.dashboardTab);
  const analysis = useAppStore(s => s.analysis);

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  if (!analysis) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 text-center text-sm text-muted-foreground sm:text-base">
        {t('No analysis available.')}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-x-clip">
      <FieldNavigation />

      
      <div
        aria-hidden
        className="h-[calc(4rem+env(safe-area-inset-top))] shrink-0 sm:h-20"
      />

      {/* Tab content */}
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-8 sm:px-6 sm:pb-12 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className="min-w-0"
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
            {tab === 'advisor' && <AdvisorPanel analysis={analysis} />}
          </motion.div>
        </AnimatePresence>
      </main>

     
      <footer className="break-words border-t border-white/5 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 text-center font-mono text-[10px] uppercase leading-relaxed tracking-wider text-muted-foreground/50 text-balance sm:px-6 sm:pb-4 sm:tracking-widest">
        {t('Chash Orbit · NASA Earth-observation decision system · POWER · SMAP · GPM · MODIS')}
      </footer>
    </div>
  );
}