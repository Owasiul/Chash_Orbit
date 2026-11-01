// Chash Orbit — application flow state (single-page state machine).
// The whole app lives on `/` (per the constraint that users only see the
// `/` route). This store tracks the current view + farmer inputs + analysis
// result.

import { create } from 'zustand';
import type { Environment } from '@/lib/nasa/environment';
import { revivePowerSeries } from '@/lib/nasa/revive-power';
import type {
  AnalysisResult,
  FarmerInputs,
  FarmerPriorities,
} from '@/lib/decision/engine';
import type { GeoResult } from '@/lib/location';
import { translateMessage, type Locale } from '@/lib/i18n';

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
  | 'scenario'
  | 'learn'
  | 'advisor';

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

function reviveAnalysis(analysis: FullAnalysis): FullAnalysis {
  const power = analysis.environment.rawPower;
  if (!power) return analysis;
  return { ...analysis, environment: { ...analysis.environment, rawPower: revivePowerSeries(power) } };
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
  advisorChatHistory: any[];
  advisorReport: any | null;

  // Actions
  setView: (v: View) => void;
  setDashboardTab: (t: DashboardTab) => void;
  setSelected: (g: GeoResult | null) => void;
  setInputs: (i: FarmerInputs) => void;
  setAnalysis: (a: FullAnalysis | null) => void;
  setAdvisorChatHistory: (history: any[]) => void;
  setAdvisorReport: (report: any | null) => void;
  // Saves the inputs, shows the analyzing screen, and calls the analyze API.
  runAnalysis: (inputs: FarmerInputs, meta: { locationName: string; country?: string; locale?: Locale }) => Promise<void>;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'home',
  dashboardTab: 'field',
  selected: null,
  inputs: null,
  analysis: null,
  advisorChatHistory: [],
  advisorReport: null,
  setView: (v) => set({ view: v }),
  setDashboardTab: (t) => set({ dashboardTab: t }),
  setSelected: (g) => set({ selected: g }),
  setInputs: (i) => set({ inputs: i }),
  setAnalysis: (a) => set({ analysis: a ? reviveAnalysis(a) : null }),
  setAdvisorChatHistory: (h) => set({ advisorChatHistory: h }),
  setAdvisorReport: (r) => set({ advisorReport: r }),
  runAnalysis: async (inputs, meta) => {
    set({ inputs, view: 'analyzing', advisorReport: null, advisorChatHistory: [] });
    try {
      const res = await fetch('/api/field/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inputs, ...meta }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      set({ analysis: reviveAnalysis(json as FullAnalysis), view: 'dashboard' });
    } catch (e) {
      // Surface error then bounce home
      console.error(e);
      set({ view: 'home' });
      alert(`${translateMessage(meta.locale ?? 'en', 'Analysis failed')}: ${(e as Error).message}`);
    }
  },
  reset: () =>
    set({
      view: 'home',
      dashboardTab: 'field',
      selected: null,
      inputs: null,
      analysis: null,
      advisorChatHistory: [],
      advisorReport: null,
    }),
}));
