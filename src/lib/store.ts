// Chash Orbit — application flow state (single-page state machine).
// The whole app lives on `/` (per the constraint that users only see the
// `/` route). This store tracks the current view + farmer inputs + analysis
// result.

import { create } from 'zustand';
import type { Environment } from '@/lib/nasa/environment';
import type {
  AnalysisResult,
  FarmerInputs,
  FarmerPriorities,
} from '@/lib/decision/engine';
import type { GeoResult } from '@/lib/location';

export type View =
  | 'home'
  | 'onboarding'
  | 'analyzing'
  | 'dashboard';

export type DashboardTab =
  | 'field'
  | 'signals'
  | 'crops'
  | 'planner'
  | 'compare'
  | 'learn';

export interface FieldSummary {
  farmId: string;
  name: string;
  locationName: string;
  country: string | null;
  latitude: number;
  longitude: number;
  area: number | null;
  areaUnit: string | null;
  soilType: string;
  irrigationType: string | null;
  currentCrop: string | null;
  desiredCrops: string[];
  priorities: FarmerPriorities;
  createdAt: string;
  updatedAt: string;
}

export interface FullAnalysis {
  field: FieldSummary;
  environment: Environment;
  risks: AnalysisResult['risks'];
  cropCompatibility: AnalysisResult['cropCompatibility'];
  recommendations: AnalysisResult['recommendations'];
  rotationPlan: AnalysisResult['rotationPlan'];
  sources: { name: string; source: 'live' | 'cached' | 'demo' | 'derived'; attribution: string }[];
}

interface AppState {
  view: View;
  dashboardTab: DashboardTab;

  // Selected location (from globe search)
  selected: GeoResult | null;

  // Farmer inputs collected during onboarding
  inputs: FarmerInputs | null;

  // Final analysis result
  analysis: FullAnalysis | null;

  // Actions
  setView: (v: View) => void;
  setDashboardTab: (t: DashboardTab) => void;
  setSelected: (g: GeoResult | null) => void;
  setInputs: (i: FarmerInputs) => void;
  setAnalysis: (a: FullAnalysis | null) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'home',
  dashboardTab: 'field',
  selected: null,
  inputs: null,
  analysis: null,
  setView: (v) => set({ view: v }),
  setDashboardTab: (t) => set({ dashboardTab: t }),
  setSelected: (g) => set({ selected: g }),
  setInputs: (i) => set({ inputs: i }),
  setAnalysis: (a) => set({ analysis: a }),
  reset: () =>
    set({
      view: 'home',
      dashboardTab: 'field',
      selected: null,
      inputs: null,
      analysis: null,
    }),
}));
