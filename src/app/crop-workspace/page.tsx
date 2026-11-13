"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CropWorkspace } from "@/components/field-shift/dashboard/CropWorkspace";
import { useAppStore } from "@/lib/store";
import { SAMPLE_FARMS } from "@/lib/location";
import { useTranslation } from "@/lib/locale";

export default function CropWorkspacePage() {
  const { t, locale } = useTranslation();
  const analysis = useAppStore(s => s.analysis);
  const runAnalysis = useAppStore(s => s.runAnalysis);
  const [loadingDemo, setLoadingDemo] = React.useState(false);

  const loadSampleAnalysis = React.useCallback(async (farmId = "rajshahi") => {
    const s = SAMPLE_FARMS.find(f => f.id === farmId) ?? SAMPLE_FARMS[0];
    if (!s) return;
    setLoadingDemo(true);
    try {
      await runAnalysis(
        {
          latitude: s.latitude,
          longitude: s.longitude,
          area: 2,
          areaUnit: "acres",
          currentCrop: "Rice",
          desiredCrops: ["Rice", "Wheat", "Mustard", "Potato", "Maize"],
          irrigation: "limited",
          soilType: "loamy",
          priorities: { soil: 25, water: 35, climate: 20, income: 20 },
        },
        { locationName: `${s.name}, ${s.country}`, country: s.country, locale }
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDemo(false);
    }
  }, [runAnalysis, locale]);

  // If no analysis is loaded when visiting directly, auto-load demo
  React.useEffect(() => {
    if (!analysis && !loadingDemo) {
      void loadSampleAnalysis("rajshahi");
    }
  }, [analysis, loadingDemo, loadSampleAnalysis]);

  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200"
          >
            <ArrowLeft className="size-3.5" />
            {t('Back to Chash Orbit')}
          </Link>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground hidden sm:inline">
              {t('NASA Earth Observation')}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {analysis ? (
          <CropWorkspace analysis={analysis} />
        ) : (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Loader2 className="size-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-medium text-foreground">
                {t('Initializing Crop Workspace...')}
              </h2>
              <p className="text-xs text-muted-foreground">
                {t('Connecting with NASA Earth observation signals & agronomic models.')}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadSampleAnalysis("rajshahi")}
              className="mt-2 border-amber-400/30 bg-amber-400/10 text-xs text-amber-200 hover:bg-amber-400/20"
            >
              <Sprout className="size-3.5 mr-1.5" />
              {t('Reload Sample Farm Analysis')}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
