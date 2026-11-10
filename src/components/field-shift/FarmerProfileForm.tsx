"use client";

import * as React from "react";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Droplets,
  Layers,
  Loader2,
  MoreHorizontal,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  ONBOARDING_CROP_OPTIONS,
  type IrrigationType,
  type SoilType,
} from "@/lib/crops";
import { useTranslation } from "@/lib/locale";

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const MIN_DESIRED_CROPS = 2;
const DEFAULT_CURRENT_CROP = "Rice";

// How many crops are shown as chips before the rest go into the "..." menu.
const CURRENT_CROP_QUICK_COUNT = 7;
const DESIRED_CROP_QUICK_COUNT = 10;
const DEFAULT_DESIRED_COUNT = 3;

// Listed first (and selected by default) when they exist in the crop library.
const PREFERRED_DESIRED_CROPS = [
  "Wheat",
  "Maize",
  "Potato",
  "Tomato",
  "Chickpea",
  "Lentil",
  "Mustard",
];

// Used when no field/location has been selected on the map.
const DEFAULT_LATITUDE = 24.3745;
const DEFAULT_LONGITUDE = 88.6039;
const DEFAULT_AREA_HA = 2.5;

type IrrigationOption = IrrigationType | "rainfed" | "limited" | "reliable";
type SoilOption = SoilType | "unknown" | "sandy" | "loamy" | "clay";

const IRRIGATION_OPTIONS: readonly IrrigationOption[] = [
  "rainfed",
  "limited",
  "reliable",
];
const SOIL_OPTIONS: readonly SoilOption[] = [
  "unknown",
  "sandy",
  "loamy",
  "clay",
];

/* -------------------------------------------------------------------------- */
/* Helpers & Hooks                                                            */
/* -------------------------------------------------------------------------- */

function normalizeCropNames(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const names: string[] = [];

  for (const item of items) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed) names.push(trimmed);
      continue;
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const candidate =
        record.name ?? record.value ?? record.label ?? record.id;
      if (typeof candidate === "string" && candidate.trim()) {
        names.push(candidate.trim());
      }
    }
  }

  return Array.from(new Set(names));
}

// Fallback static list used when the API is unavailable.
const FALLBACK_CROP_OPTIONS: string[] = normalizeCropNames(
  ONBOARDING_CROP_OPTIONS,
);

const emptySubscribe = () => () => {};

function useHasMounted(): boolean {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

// Fetches all crop names from the API. Always returns a stable array
// (the fallback list until the request finishes or if it fails).
function useCropLibrary(): { crops: string[]; isReady: boolean } {
  const [state, setState] = React.useState<{
    crops: string[];
    isReady: boolean;
  }>({
    crops: FALLBACK_CROP_OPTIONS,
    isReady: false,
  });

  React.useEffect(() => {
    const controller = new AbortController();

    fetch("/api/crops", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`GET /api/crops failed: ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((data: unknown) => {
        if (controller.signal.aborted) return;
        const rawList = Array.isArray(data)
          ? data
          : data && typeof data === "object" && "crops" in data
            ? (data as { crops?: unknown }).crops
            : [];
        const fetched = normalizeCropNames(rawList);
        setState({
          crops: fetched.length > 0 ? fetched : FALLBACK_CROP_OPTIONS,
          isReady: true,
        });
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        console.warn("Crop library unavailable, using fallback list:", error);
        setState({ crops: FALLBACK_CROP_OPTIONS, isReady: true });
      });

    return () => controller.abort();
  }, []);

  return state;
}

function orderByPreference(crops: string[]): string[] {
  const preferred = PREFERRED_DESIRED_CROPS.filter((crop) =>
    crops.includes(crop),
  );
  const rest = crops.filter((crop) => !preferred.includes(crop));
  return [...preferred, ...rest];
}

function extractFieldMeta(
  activePolygon: unknown,
  selected: unknown,
  fallbackInputs: unknown,
): { lat: number; lng: number; area: number; polygon: unknown } {
  let lat: number | undefined;
  let lng: number | undefined;
  let area: number | undefined;
  let polygon: unknown = null;

  if (activePolygon && typeof activePolygon === "object") {
    const poly = activePolygon as Record<string, unknown>;
    const centroid = poly.centroid;
    if (
      Array.isArray(centroid) &&
      typeof centroid[0] === "number" &&
      typeof centroid[1] === "number"
    ) {
      lng = centroid[0];
      lat = centroid[1];
    } else if (centroid && typeof centroid === "object") {
      const c = centroid as Record<string, unknown>;
      const cLat = c.lat ?? c.latitude;
      const cLng = c.lng ?? c.lon ?? c.longitude;
      if (typeof cLat === "number" && typeof cLng === "number") {
        lat = cLat;
        lng = cLng;
      }
    }

    const polyArea = poly.areaHa ?? poly.area;
    if (typeof polyArea === "number" && polyArea > 0) {
      area = polyArea;
    }

    if ("coordinates" in poly && poly.coordinates != null) {
      polygon = poly.coordinates;
    } else if (
      poly.geometry &&
      typeof poly.geometry === "object" &&
      "coordinates" in poly.geometry
    ) {
      polygon =
        (poly.geometry as { coordinates?: unknown }).coordinates ?? null;
    }
  }

  if (
    (lat === undefined || lng === undefined) &&
    selected &&
    typeof selected === "object"
  ) {
    const s = selected as Record<string, unknown>;
    const sLat = s.latitude ?? s.lat;
    const sLng = s.longitude ?? s.lng ?? s.lon;
    if (typeof sLat === "number" && typeof sLng === "number") {
      lat = sLat;
      lng = sLng;
    }
  }

  if (fallbackInputs && typeof fallbackInputs === "object") {
    const inp = fallbackInputs as Record<string, unknown>;
    if (
      (lat === undefined || lng === undefined) &&
      typeof inp.latitude === "number" &&
      typeof inp.longitude === "number"
    ) {
      lat = inp.latitude;
      lng = inp.longitude;
    }
    if (area === undefined && typeof inp.area === "number" && inp.area > 0) {
      area = inp.area;
    }
    if (polygon == null && inp.polygon != null) {
      polygon = inp.polygon;
    }
  }

  return {
    lat: lat ?? DEFAULT_LATITUDE,
    lng: lng ?? DEFAULT_LONGITUDE,
    area: area ?? DEFAULT_AREA_HA,
    polygon,
  };
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const chipBase =
  "inline-flex min-h-9 select-none items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] leading-tight whitespace-normal transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 sm:text-xs";
const chipIdle =
  "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground";
const chipCurrentActive =
  "border-amber-400/50 bg-amber-400/15 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]";
const chipFallow =
  "border-dashed border-white/20 bg-transparent text-muted-foreground hover:border-white/35 hover:bg-white/5 hover:text-foreground";
const chipFallowActive =
  "border-dashed border-white/40 bg-white/10 text-foreground";
const chipDesiredActive =
  "border-emerald-400/50 bg-emerald-400/15 text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.08)]";
const iconBtn =
  "inline-flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50";
const segmentBase =
  "min-h-8 rounded-md px-1.5 py-1.5 text-center text-[10px] leading-tight whitespace-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 sm:text-[11px]";
const menuCls =
  "max-h-64 w-56 overflow-y-auto rounded-xl border-white/10 bg-card/95 p-1.5 shadow-2xl backdrop-blur sm:w-60";

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

type DraftState = {
  source: unknown;
  currentCrop?: string;
  desiredCrops?: string[];
  irrigation?: IrrigationOption;
  soilType?: SoilOption;
};

export function FarmerProfileForm({
  onAnalyze,
  isAnalyzing = false,
  defaultOpen = true,
}: {
  onAnalyze: () => void;
  isAnalyzing?: boolean;
  defaultOpen?: boolean;
}) {
  const hasMounted = useHasMounted();
  const translation = useTranslation();

  const rawInputs = useAppStore((s) => s.inputs);
  const setInputs = useAppStore((s) => s.setInputs);
  const activePolygon = useAppStore((s) => s.activePolygon);
  const selected = useAppStore((s) => s.selected);

  // Defer persisted store inputs until after hydration to prevent SSR mismatch.
  const inputs = hasMounted ? rawInputs : undefined;

  const bodyId = React.useId();
  const [isOpen, setIsOpen] = React.useState<boolean>(
    defaultOpen || isAnalyzing,
  );
  // Active analysis always reveals the body without calling setState in useEffect.
  const panelOpen = isAnalyzing || isOpen;

  const localeValue = String(
    (translation as { locale?: unknown }).locale ?? "en",
  );
  // Bangla needs more horizontal room and has no uppercase form.
  const isBangla = localeValue === "bn" || localeValue.startsWith("bn-");
  const labelCls = cn(
    "text-[10px] font-medium text-muted-foreground/80 sm:text-[11px]",
    isBangla ? "tracking-normal" : "font-mono uppercase tracking-[0.14em]",
  );

  const t = React.useCallback(
    (key: string): string => {
      const translator = (translation as { t?: unknown }).t;
      if (typeof translator === "function") {
        const result = (translator as (k: string) => unknown)(key);
        return typeof result === "string" ? result : key;
      }
      if (translator && typeof translator === "object") {
        const result = (translator as Record<string, unknown>)[key];
        if (typeof result === "string") return result;
      }
      return key;
    },
    [translation],
  );

  // Supports a function formatter, Intl.NumberFormat, or native locale fallback.
  const formatCount = React.useCallback(
    (value: number): string => {
      const dict = translation as {
        number?: unknown;
        formatNumber?: unknown;
      };
      const formatter = dict.number ?? dict.formatNumber;
      if (typeof formatter === "function") {
        return String((formatter as (n: number) => unknown)(value));
      }
      if (
        formatter &&
        typeof formatter === "object" &&
        "format" in formatter &&
        typeof (formatter as { format?: unknown }).format === "function"
      ) {
        return (formatter as { format: (n: number) => string }).format(value);
      }
      try {
        return new Intl.NumberFormat(isBangla ? "bn-BD" : undefined).format(
          value,
        );
      } catch {
        return String(value);
      }
    },
    [translation, isBangla],
  );

  /* ----------------------------- Crop lists ------------------------------ */

  const { crops: allCrops, isReady: cropsReady } = useCropLibrary();

  // Current crop: first N as quick picks, the rest (no overlap) in the overflow menu.
  const currentCropQuick = React.useMemo(
    () => allCrops.slice(0, CURRENT_CROP_QUICK_COUNT),
    [allCrops],
  );
  const currentCropOverflow = React.useMemo(
    () => allCrops.slice(CURRENT_CROP_QUICK_COUNT),
    [allCrops],
  );

  // Desired crops: preferred crops first, then everything else.
  const orderedDesiredCrops = React.useMemo(
    () => orderByPreference(allCrops),
    [allCrops],
  );
  const quickDesiredCrops = React.useMemo(
    () => orderedDesiredCrops.slice(0, DESIRED_CROP_QUICK_COUNT),
    [orderedDesiredCrops],
  );
  const desiredOverflowCrops = React.useMemo(
    () => orderedDesiredCrops.slice(DESIRED_CROP_QUICK_COUNT),
    [orderedDesiredCrops],
  );
  const defaultDesiredCrops = React.useMemo(
    () => orderedDesiredCrops.slice(0, DEFAULT_DESIRED_COUNT),
    [orderedDesiredCrops],
  );

  /* -------------------------------- State -------------------------------- */

  // Key local edits to `inputs` so store hydration or external resets sync automatically
  // without needing setState inside useEffect.
  const [draft, setDraft] = React.useState<DraftState>(() => ({
    source: inputs,
  }));
  const activeDraft = React.useMemo<DraftState>(
    () => (draft.source === inputs ? draft : { source: inputs }),
    [draft, inputs],
  );

  // `null` in the store means "None / Fallow", which the UI represents as "".
  const rawCurrentCrop =
    activeDraft.currentCrop !== undefined
      ? activeDraft.currentCrop
      : !inputs || inputs.currentCrop === undefined
        ? DEFAULT_CURRENT_CROP
        : (inputs.currentCrop ?? "");

  const currentCrop = React.useMemo(() => {
    if (!rawCurrentCrop) return "";
    if (!cropsReady || allCrops.includes(rawCurrentCrop)) return rawCurrentCrop;
    return allCrops.includes(DEFAULT_CURRENT_CROP)
      ? DEFAULT_CURRENT_CROP
      : (allCrops[0] ?? "");
  }, [rawCurrentCrop, cropsReady, allCrops]);

  const desiredCrops = React.useMemo(() => {
    const raw =
      activeDraft.desiredCrops ??
      (inputs?.desiredCrops?.length
        ? inputs.desiredCrops
        : defaultDesiredCrops);
    if (!cropsReady) return raw;
    const valid = raw.filter((crop) => allCrops.includes(crop));
    return valid.length >= MIN_DESIRED_CROPS ? valid : defaultDesiredCrops;
  }, [
    activeDraft.desiredCrops,
    inputs,
    defaultDesiredCrops,
    cropsReady,
    allCrops,
  ]);

  const irrigation: IrrigationOption =
    activeDraft.irrigation ?? inputs?.irrigation ?? "limited";

  const soilType: SoilOption =
    activeDraft.soilType ?? inputs?.soilType ?? "unknown";

  const setCurrentCrop = React.useCallback(
    (nextCrop: string) => {
      setDraft((prev) => ({
        ...(prev.source === inputs ? prev : { source: inputs }),
        currentCrop: nextCrop,
      }));
    },
    [inputs],
  );

  const setIrrigation = React.useCallback(
    (nextIrrigation: IrrigationOption) => {
      setDraft((prev) => ({
        ...(prev.source === inputs ? prev : { source: inputs }),
        irrigation: nextIrrigation,
      }));
    },
    [inputs],
  );

  const setSoilType = React.useCallback(
    (nextSoil: SoilOption) => {
      setDraft((prev) => ({
        ...(prev.source === inputs ? prev : { source: inputs }),
        soilType: nextSoil,
      }));
    },
    [inputs],
  );

  const toggleDesiredCrop = React.useCallback(
    (crop: string) => {
      setDraft((prev) => {
        const base = prev.source === inputs ? prev : { source: inputs };
        const currentList = base.desiredCrops ?? desiredCrops;
        if (currentList.includes(crop)) {
          if (currentList.length <= MIN_DESIRED_CROPS) return base;
          return {
            ...base,
            desiredCrops: currentList.filter((c) => c !== crop),
          };
        }
        return {
          ...base,
          desiredCrops: [...currentList, crop],
        };
      });
    },
    [inputs, desiredCrops],
  );

  /* ------------------------------- Derived -------------------------------- */

  const candidateCount = formatCount(desiredCrops.length);
  const currentCropLabel = currentCrop ? t(currentCrop) : t("Fallow");
  const currentCropIsOverflow =
    Boolean(currentCrop) && !currentCropQuick.includes(currentCrop);
  const atMinimum = desiredCrops.length <= MIN_DESIRED_CROPS;
  const canAnalyze = desiredCrops.length >= MIN_DESIRED_CROPS;
  const overflowSelectedCount = desiredCrops.filter((crop) =>
    desiredOverflowCrops.includes(crop),
  ).length;

  const variantState = isAnalyzing
    ? "active-analysis"
    : panelOpen
      ? "expanded"
      : "default";

  const handleToggleOpen = () => {
    if (isAnalyzing) return;
    setIsOpen((open) => !open);
  };

  const handleRun = () => {
    if (!canAnalyze || isAnalyzing) return;

    const { lat, lng, area, polygon } = extractFieldMeta(
      activePolygon,
      selected,
      inputs,
    );

    const priorities = {
      soil: inputs?.priorities?.soil ?? 25,
      water: inputs?.priorities?.water ?? 35,
      climate: inputs?.priorities?.climate ?? 20,
      income: inputs?.priorities?.income ?? 20,
    };

    const payload = {
      ...(inputs ?? {}),
      latitude: lat,
      longitude: lng,
      area,
      areaUnit: inputs?.areaUnit ?? "hectares",
      currentCrop: currentCrop || null,
      desiredCrops,
      irrigation,
      soilType,
      priorities,
      polygon,
    } as Parameters<typeof setInputs>[0];

    setInputs(payload);
    onAnalyze();
  };

  return (
    <Card
      data-state={variantState}
      className="no-print gap-0 overflow-hidden rounded-2xl border-white/10 bg-card/70 p-0 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all"
    >
      {/* Header — Row, Space Between (phrasing elements only inside <button>) */}
      <button
        type="button"
        onClick={handleToggleOpen}
        aria-expanded={panelOpen}
        aria-controls={panelOpen ? bodyId : undefined}
        className="flex w-full cursor-pointer select-none items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/40 sm:p-5"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          </span>
          <span
            className={cn(
              "truncate text-xs font-semibold text-foreground sm:text-sm",
              !isBangla && "font-mono uppercase tracking-wider",
            )}
          >
            {t("Farmer Profile & Preferences")}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          <span className="inline-flex max-w-[52vw] items-center gap-1.5 truncate rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-normal text-muted-foreground sm:max-w-none sm:text-[10px]">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400",
                isAnalyzing && "animate-pulse bg-amber-300",
              )}
            />
            <span className="truncate">
              {currentCropLabel} - {candidateCount} {t("candidates")}
            </span>
          </span>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-muted-foreground">
            {panelOpen ? (
              <ChevronUp className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </span>
      </button>

      {panelOpen && (
        <div
          id={bodyId}
          role="region"
          aria-label={t("Farmer Profile & Preferences")}
          className="flex flex-col gap-5 border-t border-white/5 px-4 pb-5 pt-5 sm:px-6 sm:pb-6"
        >
          {/* Section 1 — Current Field Crop */}
          <section
            className="space-y-2.5"
            aria-label={t("Current Field Crop (Previous harvest)")}
          >
            <span className={cn(labelCls, "block")}>
              {t("Current Field Crop (Previous harvest)")}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {currentCropQuick.map((crop) => {
                const isSelected = currentCrop === crop;
                return (
                  <button
                    key={crop}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setCurrentCrop(crop)}
                    className={cn(
                      chipBase,
                      isSelected ? chipCurrentActive : chipIdle,
                    )}
                  >
                    {isSelected && (
                      <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                    )}
                    <span>{t(crop)}</span>
                  </button>
                );
              })}

              {/* Distinct neutral outlined pill */}
              <button
                type="button"
                aria-pressed={!currentCrop}
                onClick={() => setCurrentCrop("")}
                className={cn(
                  chipBase,
                  !currentCrop ? chipFallowActive : chipFallow,
                )}
              >
                {!currentCrop ? (
                  <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : (
                  <Ban className="h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                <span>{t("None / Fallow")}</span>
              </button>

              {/* Surfaced selection when the user picked from the overflow menu */}
              {currentCropIsOverflow && (
                <button
                  type="button"
                  aria-pressed={true}
                  onClick={() => setCurrentCrop("")}
                  title={t("Clear")}
                  className={cn(chipBase, chipCurrentActive)}
                >
                  <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{t(currentCrop)}</span>
                  <X
                    className="h-3 w-3 shrink-0 opacity-60"
                    aria-hidden="true"
                  />
                </button>
              )}

              {currentCropOverflow.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={iconBtn}
                      title={t("More crops")}
                      aria-label={t("More crops")}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className={menuCls}
                  >
                    {currentCropOverflow.map((crop) => {
                      const isSelected = currentCrop === crop;
                      return (
                        <DropdownMenuItem
                          key={crop}
                          onSelect={() => setCurrentCrop(crop)}
                          className={cn(
                            "flex items-center justify-between rounded-md text-xs",
                            isSelected && "bg-amber-400/15 text-amber-200",
                          )}
                        >
                          <span>{t(crop)}</span>
                          {isSelected && (
                            <Check
                              className="h-3.5 w-3.5 text-amber-300"
                              aria-hidden="true"
                            />
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </section>

          {/* Section 2 — Crops Under Consideration */}
          <section
            className="space-y-2.5"
            aria-label={t("Crops Under Consideration")}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={labelCls}>
                {t("Crops Under Consideration")} ({candidateCount})
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/60 sm:text-[11px]">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    atMinimum ? "bg-amber-400" : "bg-emerald-400",
                  )}
                />
                {t("Select at least 2")}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {quickDesiredCrops.map((crop) => {
                const isSelected = desiredCrops.includes(crop);
                const locked = isSelected && atMinimum;
                return (
                  <button
                    key={crop}
                    type="button"
                    aria-pressed={isSelected}
                    aria-disabled={locked || undefined}
                    title={locked ? t("Select at least 2") : undefined}
                    onClick={() => toggleDesiredCrop(crop)}
                    className={cn(
                      chipBase,
                      isSelected ? chipDesiredActive : chipIdle,
                      locked && "cursor-not-allowed opacity-90",
                    )}
                  >
                    {isSelected && (
                      <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
                    )}
                    <span>{t(crop)}</span>
                  </button>
                );
              })}

              {desiredOverflowCrops.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(iconBtn, "relative")}
                      title={t("More crops")}
                      aria-label={t("More crops")}
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                      {overflowSelectedCount > 0 && (
                        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-emerald-400 text-[9px] font-bold text-black">
                          {formatCount(overflowSelectedCount)}
                        </span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className={menuCls}
                  >
                    {desiredOverflowCrops.map((crop) => {
                      const isSelected = desiredCrops.includes(crop);
                      const locked = isSelected && atMinimum;
                      return (
                        <DropdownMenuItem
                          key={crop}
                          disabled={locked}
                          // Multi-select: keep the menu open after toggling.
                          onSelect={(event) => {
                            event.preventDefault();
                            if (!locked) toggleDesiredCrop(crop);
                          }}
                          className={cn(
                            "flex items-center justify-between rounded-md text-xs",
                            isSelected && "bg-emerald-400/15 text-emerald-200",
                            locked && "opacity-70",
                          )}
                        >
                          <span className="flex items-center gap-1.5">
                            {/* Always rendered so the label doesn't shift on select */}
                            <Check
                              className={cn(
                                "h-3.5 w-3.5",
                                isSelected ? "text-emerald-300" : "opacity-0",
                              )}
                              aria-hidden="true"
                            />
                            <span>{t(crop)}</span>
                          </span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </section>

          {/* Section 3 — Environmental Context */}
          <section
            className="space-y-2.5"
            aria-label={t("Environmental Context")}
          >
            <span className={cn(labelCls, "block")}>
              {t("Environmental Context")}
            </span>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Irrigation sub-card */}
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 sm:p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Droplets
                    className="h-3.5 w-3.5 shrink-0 text-cyan-300"
                    aria-hidden="true"
                  />
                  <span className={labelCls}>{t("Irrigation Access")}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
                  {IRRIGATION_OPTIONS.map((irr) => {
                    const isSelected = irrigation === irr;
                    return (
                      <button
                        key={irr}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setIrrigation(irr)}
                        className={cn(
                          segmentBase,
                          !isBangla && "capitalize",
                          isSelected
                            ? "bg-cyan-400/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                        )}
                      >
                        {t(irr)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Soil sub-card */}
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 sm:p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Layers
                    className="h-3.5 w-3.5 shrink-0 text-amber-300"
                    aria-hidden="true"
                  />
                  <span className={labelCls}>{t("Soil Texture")}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/20 p-1 sm:grid-cols-4">
                  {SOIL_OPTIONS.map((soil) => {
                    const isSelected = soilType === soil;
                    return (
                      <button
                        key={soil}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSoilType(soil)}
                        className={cn(
                          segmentBase,
                          !isBangla && "capitalize",
                          isSelected
                            ? "bg-amber-400/15 text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35)]"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                        )}
                      >
                        {soil === "unknown" ? t("Auto") : t(soil)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Footer CTA Bar */}
          <div className="border-t border-white/5 pt-5">
            <Button
              type="button"
              onClick={handleRun}
              disabled={isAnalyzing || !canAnalyze}
              aria-busy={isAnalyzing}
              className={cn(
                "group flex h-auto min-h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 px-4 py-2.5 text-xs font-semibold whitespace-normal text-black shadow-[0_10px_30px_-10px_rgba(251,191,36,0.6)] transition-all hover:from-amber-200 hover:via-amber-300 hover:to-amber-400 hover:shadow-[0_14px_36px_-10px_rgba(251,191,36,0.75)] focus-visible:ring-2 focus-visible:ring-amber-200 sm:min-h-11 sm:text-sm",
                isAnalyzing && "cursor-wait from-amber-400/80 to-amber-500/80",
              )}
            >
              {isAnalyzing ? (
                <>
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                  <span className="leading-tight">
                    {t("Querying NASA POWER & Satellite Grid...")}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles
                    className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110"
                    aria-hidden="true"
                  />
                  <span className="leading-tight">
                    {t("Analyze Field & Generate Rotation")} ({candidateCount}{" "}
                    {t("Crops")})
                  </span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
