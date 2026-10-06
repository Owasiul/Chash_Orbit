"use client";

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';
import { HomeScreen } from './HomeScreen';
import { OnboardingWizard } from './OnboardingWizard';
import { AnalyzingScreen } from './AnalyzingScreen';

// The FieldDashboard uses dynamic-imported dashboard panels and recharts, so
// we keep it lazy to keep the homepage bundle lean.
const FieldDashboard = dynamic(
  () => import('./FieldDashboard').then(m => m.FieldDashboard),
  { ssr: false },
);

export function FieldShiftApp() {
  const view = useAppStore(s => s.view);

  React.useEffect(() => {
    // On first mount, ensure crop library is seeded.
    fetch('/api/crops').catch(() => {});
  }, []);

  if (view === 'home') return <HomeScreen />;
  if (view === 'onboarding') return <OnboardingWizard />;
  if (view === 'analyzing') return <AnalyzingScreen />;
  if (view === 'dashboard') return <FieldDashboard />;
  return <HomeScreen />;
}
