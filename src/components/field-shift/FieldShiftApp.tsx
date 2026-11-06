"use client";

import * as React from 'react';
import dynamic from 'next/dynamic';

// Single scrolling dashboard for Phase 3 — Everything on ONE page
const SinglePageDashboard = dynamic(
  () => import('./SinglePageDashboard').then(m => m.SinglePageDashboard),
  { ssr: false },
);

export function FieldShiftApp() {
  React.useEffect(() => {
    // On first mount, ensure crop library is seeded.
    fetch('/api/crops').catch(() => {});
  }, []);

  return <SinglePageDashboard />;
}

