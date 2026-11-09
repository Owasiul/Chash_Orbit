"use client";

import dynamic from 'next/dynamic';

const SinglePageDashboard = dynamic(
  () => import('@/components/field-shift/SinglePageDashboard').then(m => m.SinglePageDashboard),
  { ssr: false },
);

export default function SinglePage() {
  return <SinglePageDashboard />;
}
