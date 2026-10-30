"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Satellite, Sparkles, Globe2, Play } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { LocationSearch } from "./LocationSearch";
import { SAMPLE_FARMS } from "@/lib/location";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/locale";
import { toast } from "@/hooks/use-toast";
import {
  geocodeLocation,
  type ResolvedLocation,
} from "@/lib/location-geocoding";
import type { GeoResult } from "@/lib/location";
import Image from "next/image";

const FieldMap = dynamic(() => import("@/components/field-shift/FieldMap"), {
  ssr: false,
});

const HolographicGlobe = dynamic(
  () =>
    import("@/components/globe/HolographicGlobe").then(
      (m) => m.HolographicGlobe,
    ),
  { ssr: false, loading: () => <GlobeLoading /> },
);

function GlobeLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground/70">
        <div className="size-12 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-300" />
        <span className="font-mono text-xs tracking-widest">
          INITIALIZING EARTH OBSERVATION SYSTEM
        </span>
      </div>
    </div>
  );
}

export function HomeScreen() {
  const { locale, t, number } = useTranslation();
  const setSelected = useAppStore((s) => s.setSelected);
  const selected = useAppStore((s) => s.selected);
  const setView = useAppStore((s) => s.setView);
  const runAnalysis = useAppStore((s) => s.runAnalysis);
  const [navigationLocation, setNavigationLocation] =
    React.useState<ResolvedLocation | null>(null);
  const [locationLookupLoading, setLocationLookupLoading] =
    React.useState(false);
  const [locationLookupError, setLocationLookupError] = React.useState<
    string | null
  >(null);
  const [showLocationMap, setShowLocationMap] = React.useState(false);
  const locationLookupController = React.useRef<AbortController | null>(null);
  const showMapAfterNavigation = React.useCallback(() => {
    setShowLocationMap(true);
  }, []);

  const handleSelect = React.useCallback(
    async (r: GeoResult) => {
      setShowLocationMap(false);
      locationLookupController.current?.abort();
      const controller = new AbortController();
      locationLookupController.current = controller;
      setLocationLookupLoading(true);
      setLocationLookupError(null);

      const query = [r.name, r.admin2, r.admin1, r.country]
        .filter(Boolean)
        .join(", ");

      try {
        const location = await geocodeLocation(query, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;

        const resolvedResult: GeoResult = {
          ...r,
          name: location.name || r.name,
          latitude: location.lat,
          longitude: location.lng,
          country: location.country || r.country,
          countryCode: location.countryCode?.toUpperCase() || r.countryCode,
        };
        setSelected(resolvedResult);
        setNavigationLocation(location);
        if (!location.countryCenter && !location.isCountry) {
          setLocationLookupError(
            "Country center could not be resolved. Navigating directly to the matched location.",
          );
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        // The existing search result already contains usable coordinates. If the
        // optional country lookup is unavailable, keep navigation working and
        // let the globe fly directly to those coordinates.
        const location: ResolvedLocation = {
          query,
          name: r.name,
          displayName: [r.name, r.admin2, r.admin1, r.country]
            .filter(Boolean)
            .join(", "),
          lat: r.latitude,
          lng: r.longitude,
          country: r.country,
          countryCode: r.countryCode?.toLowerCase() ?? "",
          isCountry: r.featureCode === "PCLI",
        };
        setSelected(r);
        setNavigationLocation(location);
        toast({
          description: t(
            "Country details could not be loaded. Navigating directly to the matched location.",
          ),
          variant: "destructive",
        });
        console.warn(
          "[HomeScreen] country-aware location lookup failed:",
          error,
        );
      } finally {
        if (locationLookupController.current === controller) {
          locationLookupController.current = null;
          setLocationLookupLoading(false);
        }
      }
    },
    [setSelected, t],
  );

  React.useEffect(() => () => locationLookupController.current?.abort(), []);

  const handleSample = (id: string) => {
    const s = SAMPLE_FARMS.find((f) => f.id === id);
    if (!s) return;
    handleSelect({
      id: 0,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      country: s.country,
      countryCode: "",
      featureCode: "PPL",
    });
  };

  // One-click walkthrough: a Rajshahi Boro-rice farmer facing dry-season water
  // stress, skipping onboarding. Its NASA data is pre-warmed by warm-cache.
  const runDemo = () => {
    const s = SAMPLE_FARMS.find((f) => f.id === "rajshahi")!;
    handleSample(s.id);
    runAnalysis(
      {
        latitude: s.latitude,
        longitude: s.longitude,
        area: 2,
        areaUnit: "acres",
        currentCrop: "Rice",
        desiredCrops: ["Wheat", "Chickpea", "Lentil", "Maize", "Potato"],
        irrigation: "limited",
        soilType: "unknown",
        priorities: { soil: 25, water: 35, climate: 20, income: 20 },
      },
      { locationName: s.fullName, country: s.country, locale },
    );
  };

  return (
    <main className="relative min-h-dvh w-full overflow-hidden">
      {!showLocationMap && (
        <div className="absolute inset-0 z-0">
          <HolographicGlobe
            size="hero"
            enableZoom
            selectedLat={navigationLocation?.lat ?? selected?.latitude ?? null}
            selectedLng={navigationLocation?.lng ?? selected?.longitude ?? null}
            locationName={navigationLocation?.name ?? selected?.name ?? null}
            countryCenter={navigationLocation?.countryCenter}
            selectedBounds={navigationLocation?.bounds}
            selectedIsCountry={navigationLocation?.isCountry}
            onNavigationComplete={showMapAfterNavigation}
            autoRotate={!selected}
          />
        </div>
      )}
      <AnimatePresence>
        {showLocationMap && selected && (
          <motion.div
            key="selected-location-map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65 }}
            className="absolute inset-0 z-[5]"
            aria-label={t(`Map centered on ${selected.name}`)}
          >
            <FieldMap
              key={`${selected.latitude},${selected.longitude}`}
              latitude={selected.latitude}
              longitude={selected.longitude}
              height="100%"
              className="h-full rounded-none border-0"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top — brand + mission tag */}
      <header className="pointer-events-none relative z-10 flex items-start justify-between px-6 pt-6 sm:px-10 sm:pt-8">
        <div className="flex items-center gap-2">
          <Image
            src="/Logo.webp"
            alt="Logo"
            width={50}
            height={50}
            priority
          />
        </div>
      </header>

      <section className="absolute inset-x-0 bottom-0 z-20 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-8 sm:px-6">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-full bg-gradient-to-t from-black/85 via-black/55 to-transparent" />
        <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-3">
          <AnimatePresence>
            {selected && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.25 }}
                className="glass-panel scanline flex flex-col gap-3 rounded-2xl p-4"
              >
                <div className="flex -translate-x-2 items-center gap-3">
                  <Globe2 className="size-5 shrink-0 text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {[selected.name, selected.admin1, selected.country]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">
                      {number(Math.abs(selected.latitude), {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                        useGrouping: false,
                      })}
                      ° {selected.latitude >= 0 ? "N" : "S"}
                      {" · "}
                      {number(Math.abs(selected.longitude), {
                        minimumFractionDigits: 4,
                        maximumFractionDigits: 4,
                        useGrouping: false,
                      })}
                      ° {selected.longitude >= 0 ? "E" : "W"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setView("onboarding")}
                  className="group flex w-full items-center justify-between rounded-xl border border-amber-400/40 bg-linear-to-r from-amber-400/20 via-amber-300/15 to-amber-400/20 px-4 py-2.5 text-left transition-all hover:border-amber-300/60 hover:from-amber-400/30 hover:to-amber-400/30"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-4 text-amber-300" />
                    <span className="text-sm font-medium text-amber-100">
                      {t("common.analyze-this-area")}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-amber-300 transition-transform group-hover:translate-x-1" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!selected && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-white/60">
                {t("common.quick-pick")}
              </span>
              {SAMPLE_FARMS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSample(f.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-xs transition-all",
                    "border-white/15 bg-black/40 text-white/80 hover:border-amber-400/40 hover:text-amber-200",
                  )}
                >
                  {f.name}
                </button>
              ))}
              <button
                type="button"
                onClick={runDemo}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200"
              >
                <Play className="size-3" />
                {t("common.see-demo")}
              </button>
            </div>
          )}

          <LocationSearch
            onSelect={handleSelect}
            autoFocus
            resolving={locationLookupLoading}
            selectionError={locationLookupError}
            onQueryChange={() => setLocationLookupError(null)}
          />
        </div>
      </section>
    </main>
  );
}
