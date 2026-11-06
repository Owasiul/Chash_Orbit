"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Sparkles,
  Printer,
  RotateCcw,
  Languages,
  Search,
  MapPin,
  Loader2,
  FileText,
  HelpCircle,
  ChevronDown,
  Info,
  Navigation,
  CheckCircle2,
  ArrowDown,
  Compass,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAppStore, type FullAnalysis } from "@/lib/store";
import { useTranslation } from "@/lib/locale";
import { formatArea, type PolygonValidationResult } from "@/lib/polygon";
import { formatLatLng, type GeoResult } from "@/lib/location";
import { VerdictCard } from "./VerdictCard";
import { RankedCropsSection } from "./RankedCropsSection";
import { RotationTimelineSection } from "./RotationTimelineSection";
import { FarmerProfileForm } from "./FarmerProfileForm";
import { LocationSearch } from "./LocationSearch";

// Dynamically import heavy interactive panels to keep initial bundle ultra fast
const FieldMap = dynamic(() => import("@/components/field-shift/FieldMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-950">
      <div className="flex flex-col items-center gap-2 text-muted-foreground font-mono text-xs">
        <Loader2 className="size-6 animate-spin text-amber-400" />
        <span>INITIALIZING SATELLITE MAP...</span>
      </div>
    </div>
  ),
});

const SignalsPanel = dynamic(
  () => import("@/components/field-shift/dashboard/SignalsPanel").then((m) => m.SignalsPanel),
  { ssr: false }
);

const ScenarioPanel = dynamic(
  () => import("@/components/field-shift/dashboard/ScenarioPanel").then((m) => m.ScenarioPanel),
  { ssr: false }
);

const LearnPanel = dynamic(
  () => import("@/components/field-shift/dashboard/LearnPanel").then((m) => m.LearnPanel),
  { ssr: false }
);

const FloatingAdvisorChat = dynamic(
  () => import("@/components/field-shift/FloatingAdvisorChat").then((m) => m.FloatingAdvisorChat),
  { ssr: false }
);

const GLOBAL_INIT_LAT = 15;
const GLOBAL_INIT_LNG = 15;
const GLOBAL_INIT_ZOOM = 1.0;
const FOCUSED_FIELD_ZOOM = 15;

const REGION_SHORTCUTS = [
  { name: "Dhaka Division, Bangladesh", label: "🇧🇩 Dhaka", lat: 23.8103, lng: 90.4125, country: "Bangladesh" },
  { name: "Punjab, India", label: "🇮🇳 Punjab", lat: 30.9010, lng: 75.8573, country: "India" },
  { name: "Iowa, USA", label: "🇺🇸 Iowa", lat: 41.8780, lng: -93.0977, country: "USA" },
  { name: "Cairo Nile Basin, Egypt", label: "🇪🇬 Nile Basin", lat: 30.0444, lng: 31.2357, country: "Egypt" },
  { name: "Bavaria, Germany", label: "🇩🇪 Bavaria", lat: 48.7904, lng: 11.4979, country: "Germany" },
  { name: "Rift Valley, Kenya", label: "🇰🇪 Rift Valley", lat: -0.3031, lng: 36.0800, country: "Kenya" },
];

export function SinglePageDashboard() {
  const { locale, setLocale, t, number } = useTranslation();
  const analysis = useAppStore((s) => s.analysis);
  const view = useAppStore((s) => s.view);
  const activePolygon = useAppStore((s) => s.activePolygon);
  const setActivePolygon = useAppStore((s) => s.setActivePolygon);
  const selected = useAppStore((s) => s.selected);
  const setSelected = useAppStore((s) => s.setSelected);
  const runAnalysis = useAppStore((s) => s.runAnalysis);
  const reset = useAppStore((s) => s.reset);

  const resultsRef = React.useRef<HTMLDivElement | null>(null);

  // Map center coordinates & zoom:
  // Starts in global orbital view (zoom 1.8) showing the whole world map.
  // Once a user selects a location, it smoothly flies to that location at field zoom (15).
  const mapLat = activePolygon?.centroid[1] ?? selected?.latitude ?? GLOBAL_INIT_LAT;
  const mapLng = activePolygon?.centroid[0] ?? selected?.longitude ?? GLOBAL_INIT_LNG;
  const mapZoom = activePolygon || selected ? FOCUSED_FIELD_ZOOM : GLOBAL_INIT_ZOOM;

  // Auto-scroll to results when analysis is ready
  React.useEffect(() => {
    if (analysis && view === "dashboard") {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [analysis, view]);

  // Handle polygon drawn or modified
  const handlePolygonChange = React.useCallback(
    (res: PolygonValidationResult | null, feature: any) => {
      if (res && res.valid && feature) {
        const coords = feature.geometry.coordinates?.[0] as [number, number][];
        setActivePolygon({
          coordinates: coords,
          areaHa: res.areaHa,
          areaAcres: res.areaAcres,
          centroid: res.centroid,
          bbox: res.bbox,
          geojson: feature,
        });
      } else {
        setActivePolygon(null);
      }
    },
    [setActivePolygon]
  );

  // City Jump Shortcut Handler (clicking an active jump toggles back to global view)
  const handleCityJump = (city: typeof REGION_SHORTCUTS[number]) => {
    setActivePolygon(null);
    if (selected?.name === city.name) {
      setSelected(null);
      return;
    }
    setSelected({
      id: 0,
      name: city.name,
      latitude: city.lat,
      longitude: city.lng,
      country: city.country,
      countryCode: "",
      featureCode: "PPL",
    });
  };

  // Click on map to select location
  const handleMapPick = (point: { latitude: number; longitude: number }) => {
    setActivePolygon(null);
    setSelected({
      id: Date.now(),
      name: `${Math.abs(point.latitude).toFixed(4)}° ${point.latitude >= 0 ? "N" : "S"}, ${Math.abs(point.longitude).toFixed(4)}° ${point.longitude >= 0 ? "E" : "W"}`,
      latitude: point.latitude,
      longitude: point.longitude,
      country: "",
      countryCode: "",
      featureCode: "PPL",
    });
  };

  // Run analysis triggered from Profile Form or Quick Analyze button
  const handleProfileFormAnalyze = () => {
    const currentInputs = useAppStore.getState().inputs;
    const lat = activePolygon?.centroid[1] ?? selected?.latitude ?? 23.8103;
    const lng = activePolygon?.centroid[0] ?? selected?.longitude ?? 90.4125;
    const area = activePolygon?.areaHa ?? 2.5;

    const payload = currentInputs ?? {
      latitude: lat,
      longitude: lng,
      area,
      areaUnit: "hectares" as const,
      currentCrop: "Rice",
      desiredCrops: ["Wheat", "Chickpea", "Lentil", "Maize", "Potato"],
      irrigation: "limited" as const,
      soilType: "unknown" as const,
      priorities: { soil: 25, water: 35, climate: 20, income: 20 },
      polygon: activePolygon?.coordinates ?? null,
    };

    const locName = selected?.name || (activePolygon ? `Field (${formatArea(area)})` : "Target Field");
    const country = selected?.country || undefined;

    runAnalysis(payload, { locationName: locName, country, locale });
  };

  // Print executive summary
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-amber-400/20">
      {/* ── STICKY TOP BAR ──────────────────────────────────────────────── */}
      <header className="no-print sticky top-0 z-50 border-b border-white/10 bg-background/85 backdrop-blur-md px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          {/* Logo & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-[0_0_15px_rgba(251,191,36,0.3)]">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-widest text-foreground">
                  CHASH ORBIT
                </span>
                <Badge variant="outline" className="hidden sm:inline-flex border-amber-400/40 bg-amber-400/10 text-[9px] font-mono text-amber-200">
                  NASA POWER · MODIS 250m
                </Badge>
              </div>
              <p className="hidden text-[10px] text-muted-foreground sm:block">
                {t("Earth-Observation Agricultural Decision System")}
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Export PDF Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!analysis}
              className="border-white/10 bg-white/5 text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground h-8"
              title={t("Print or save one-page executive plan")}
            >
              <Printer className="mr-1 size-3.5 text-cyan-300" />
              <span className="hidden md:inline">{t("Export PDF")}</span>
            </Button>

            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocale(locale === "bn-BD" ? "en" : "bn-BD")}
              className="text-xs font-mono text-muted-foreground hover:text-foreground h-8 px-2"
              title={t("Toggle Language (English / বাংলা)")}
            >
              <Languages className="size-3.5 text-muted-foreground mr-1" />
              <span>{locale === "bn-BD" ? "EN" : "বাংলা"}</span>
            </Button>

            {/* Reset */}
            {(analysis || selected || activePolygon) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-rose-300 h-8 px-2"
                title={t("Reset dashboard")}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ── PRINT-ONLY REPORT HEADER ─────────────────────────────────────── */}
      <div className="hidden print-only mb-6 border-b border-gray-300 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              CHASH ORBIT — EXECUTIVE FIELD REPORT
            </h1>
            <p className="text-sm text-gray-600">
              NASA Earth-Observation Climate Adaptation & 4-Year Crop Rotation Plan
            </p>
          </div>
          <div className="text-right font-mono text-xs text-gray-600">
            <div><strong>Location:</strong> {analysis?.field.locationName || analysis?.field.name}</div>
            <div><strong>Coordinates:</strong> {analysis && formatLatLng(analysis.field.latitude, analysis.field.longitude)}</div>
            <div><strong>Area:</strong> {analysis?.field.area ? formatArea(analysis.field.area) : "Field boundary"}</div>
            <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* ── MAIN SCROLLING CONTENT ────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
        {/* ── STAGE 1: FULL SATELLITE MAP & SEARCH (Centerpiece) ───────────── */}
        <section className="no-print space-y-3 mb-6 relative z-30">
          {/* Floating Search & Location Controls Bar */}
          <div className="relative z-40 overflow-visible flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 rounded-2xl border border-white/10 bg-card/75 p-3 backdrop-blur-md shadow-xl">
            {/* Location Search Bar with GPS and Coordinate Detection */}
            <div className="flex-1 max-w-xl relative z-50">
              <LocationSearch
                onSelect={(r) => {
                  setActivePolygon(null);
                  setSelected(r);
                }}
                onClear={() => {
                  setActivePolygon(null);
                  setSelected(null);
                }}
                dropdownPosition="bottom"
                className="w-full"
              />
            </div>

            {/* Quick Global Agricultural Region Jumps */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 hidden sm:inline mr-1">
                {t("Quick Jumps:")}
              </span>
              {REGION_SHORTCUTS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => handleCityJump(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-mono transition-colors",
                    selected?.name === c.name
                      ? "border-amber-400/60 bg-amber-400/20 text-amber-200"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Satellite Map Container */}
          <div className="relative z-10 rounded-2xl overflow-hidden border border-white/15 bg-slate-950 shadow-2xl">
            <FieldMap
              latitude={mapLat}
              longitude={mapLng}
              zoom={mapZoom}
              height="clamp(440px, 65vh, 640px)"
              enableDrawing={true}
              showToolbar={true}
              initialPolygon={activePolygon?.coordinates ?? undefined}
              onPolygonChange={handlePolygonChange}
              onPick={handleMapPick}
            />

            {/* Floating Live Polygon Area & Action Prompt */}
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto z-20 flex flex-wrap items-center gap-2.5 rounded-xl border border-white/15 bg-black/85 p-2.5 shadow-2xl backdrop-blur-md">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-amber-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-foreground">
                    {selected?.name || (activePolygon ? t("Custom Field Boundary") : t("Explore & Draw Field"))}
                  </span>
                  {activePolygon && (
                    <span className="font-mono text-[10px] text-muted-foreground/80">
                      {Math.abs(activePolygon.centroid[1]).toFixed(4)}° {activePolygon.centroid[1] >= 0 ? "N" : "S"},{" "}
                      {Math.abs(activePolygon.centroid[0]).toFixed(4)}° {activePolygon.centroid[0] >= 0 ? "E" : "W"}
                    </span>
                  )}
                </div>
                {activePolygon && (
                  <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/15 text-emerald-300 font-mono text-xs">
                    {formatArea(activePolygon.areaHa)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── STAGE 2: FARMER PROFILE FORM & OUTPUTS ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Compact Collapsible Profile Form */}
          <div className="no-print lg:col-span-4">
            <FarmerProfileForm
              onAnalyze={handleProfileFormAnalyze}
              isAnalyzing={view === "analyzing"}
            />
          </div>

          {/* Right Column: Output Results (a through g) */}
          <div ref={resultsRef} className="lg:col-span-8 space-y-6 pb-16">
            {/* State 1: Currently Analyzing Loading Skeleton */}
            {view === "analyzing" && (
              <Card className="border-amber-400/30 bg-card/60 p-6 space-y-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <Loader2 className="size-5 animate-spin text-amber-400" />
                  <span className="font-mono text-sm uppercase tracking-wider text-amber-200 font-medium">
                    {t("Querying NASA POWER, MODIS 250m & Decision Engine...")}
                  </span>
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-3/4 bg-white/10" />
                  <Skeleton className="h-4 w-full bg-white/5" />
                  <Skeleton className="h-4 w-5/6 bg-white/5" />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Skeleton className="h-28 bg-white/5 rounded-lg" />
                  <Skeleton className="h-28 bg-white/5 rounded-lg" />
                </div>
              </Card>
            )}

            {/* State 2: Welcome Prompt before any analysis */}
            {!analysis && view !== "analyzing" && (
              <Card className="border-white/10 bg-card/40 p-6 sm:p-8 space-y-5">
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-light text-foreground sm:text-xl">
                      {t("Start Building Your Crop Rotation Plan")}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {t("Use the full satellite map above to locate your farmland and draw your field polygon. Our NASA-powered engine calculates optimal 4-year rotations, climate risk scores, and crop suitabilities.")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-1">
                    <div className="font-mono text-[10px] text-amber-300 uppercase tracking-wider">Step 1 · Locate</div>
                    <p className="text-xs text-foreground font-medium">Search City or Use GPS</p>
                    <p className="text-[11px] text-muted-foreground">Type any region, city name, or lat/lon coordinates to fly the map.</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-1">
                    <div className="font-mono text-[10px] text-amber-300 uppercase tracking-wider">Step 2 · Outline</div>
                    <p className="text-xs text-foreground font-medium">Draw Field Polygon</p>
                    <p className="text-[11px] text-muted-foreground">Click corners on satellite imagery to measure real farm area.</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-1">
                    <div className="font-mono text-[10px] text-amber-300 uppercase tracking-wider">Step 3 · Analyze</div>
                    <p className="text-xs text-foreground font-medium">NASA Climate Engine</p>
                    <p className="text-[11px] text-muted-foreground">Get ranked crops, 4-year rotation, and heat/drought signals.</p>
                  </div>
                </div>
              </Card>
            )}

            {/* State 3: Analysis Results (Rendered in the exact required order) */}
            {analysis && view !== "analyzing" && (
              <div className="space-y-6">
                {/* ── Section a: Verdict Card ── */}
                <section id="verdict">
                  <VerdictCard analysis={analysis} />
                </section>

                {/* ── Section b: Ranked Crops ── */}
                <section id="ranked-crops">
                  <RankedCropsSection analysis={analysis} />
                </section>

                {/* ── Section c: 4-Year Rotation Timeline ── */}
                <section id="rotation-timeline">
                  <RotationTimelineSection analysis={analysis} />
                </section>

                {/* ── Section d: Climate & Risk Panel (Heat, Drought, Flood, Rainfall, NDVI) ── */}
                <section id="climate-signals">
                  <SignalsPanel analysis={analysis} />
                </section>

                {/* ── Section e: Interactive Scenario Sliders (-20% rain, +2 C) ── */}
                <section id="scenario-sliders">
                  <ScenarioPanel analysis={analysis} />
                </section>

                {/* ── Section f: Data Sources, Resolution, and Limitations ── */}
                <section id="data-sources">
                  <LearnPanel analysis={analysis} />
                </section>

                {/* Bottom Export PDF Button */}
                <div className="no-print flex justify-center pt-2">
                  <Button
                    onClick={handlePrint}
                    variant="outline"
                    className="border-white/15 bg-white/5 hover:bg-white/10 text-foreground text-xs font-mono h-10 px-6"
                  >
                    <Printer className="mr-2 size-4 text-cyan-300" />
                    <span>{t("Print / Export Field Plan (PDF)")}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="no-print mt-auto border-t border-white/5 py-4 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
        {t("Chash Orbit · NASA Earth-Observation Decision System · NASA POWER (MERRA-2) · MODIS Terra (ORNL DAAC) · Sentinel-2 L2A")}
      </footer>

      {/* ── PERSISTENT FLOATING AI ADVISOR CHATBOT (GEMINI 3.5 FLASH LITE) ─── */}
      <FloatingAdvisorChat analysis={analysis} />
    </div>
  );
}
