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

  let screen;
  if (view === 'home') screen = <HomeScreen />;
  else if (view === 'onboarding') screen = <OnboardingWizard />;
  else if (view === 'analyzing') screen = <AnalyzingScreen />;
  else if (view === 'dashboard') screen = <FieldDashboard />;
  else screen = <HomeScreen />;

  return screen;
}
