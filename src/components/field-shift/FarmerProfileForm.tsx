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
import { Badge } from "@/components/ui/badge";
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


const MIN_DESIRED_CROPS = 2;

const CURRENT_CROP_QUICK: string[] = ["Rice", "Wheat", "Maize", "Potato"];
const DESIRED_OVERFLOW_CROPS: string[] = ["Vegetables", "Fruit", "Other"];
const PREFERRED_DEFAULT_CROPS: string[] = [
  "Wheat",
  "Maize",
  "Potato",
  "Tomato",
  "Chickpea",
  "Lentil",
  "Mustard",
];

const QUICK_DESIRED_CROPS: string[] = ONBOARDING_CROP_OPTIONS.filter(
  (crop) => !DESIRED_OVERFLOW_CROPS.includes(crop),
) as string[];

const CURRENT_CROP_OVERFLOW: string[] = ONBOARDING_CROP_OPTIONS.filter(
  (crop) => !CURRENT_CROP_QUICK.includes(crop),
) as string[];

// Seven-candidate default from the design, but resolved against the real crop
// catalog so we never preselect a key that cannot be rendered.
const DEFAULT_CROPS: string[] = (() => {
  const pool = QUICK_DESIRED_CROPS.length
    ? QUICK_DESIRED_CROPS
    : [...ONBOARDING_CROP_OPTIONS];
  const preferred = PREFERRED_DEFAULT_CROPS.filter((crop) =>
    pool.includes(crop),
  );
  const rest = pool.filter((crop) => !preferred.includes(crop));
  const defaults = [...preferred, ...rest].slice(0, 7);
  return defaults.length >= MIN_DESIRED_CROPS
    ? defaults
    : pool.slice(0, MIN_DESIRED_CROPS);
})();

const chipBase =
  "inline-flex min-h-9 select-none items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] leading-tight whitespace-normal transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 sm:text-xs";
const chipIdle =
  "border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground";
const chipCurrentActive =
  "border-amber-400/50 bg-amber-400/15 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.08)]";
const chipFallow =
  "border-dashed border-white/20 bg-transparent text-muted-foreground hover:border-white/35 hover:bg-white/5 hover:text-foreground";
const chipFallowActive = "border-dashed border-white/40 bg-white/10 text-foreground";
const chipDesiredActive =
  "border-emerald-400/50 bg-emerald-400/15 text-emerald-100 shadow-[0_0_0_1px_rgba(52,211,153,0.08)]";
const iconBtn =
  "inline-flex size-9 shrink-0 select-none items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-muted-foreground transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50";
const segmentBase =
  "min-h-8 rounded-md px-1.5 py-1.5 text-center text-[10px] leading-tight whitespace-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 sm:text-[11px]";
const menuCls =
  "max-h-64 w-56 overflow-y-auto rounded-xl border-white/10 bg-card/95 p-1.5 shadow-2xl backdrop-blur sm:w-60";

/* -------------------------------------------------------------------------- */

export function FarmerProfileForm({
  onAnalyze,
  isAnalyzing = false,
  defaultOpen = true,
}: {
  onAnalyze: () => void;
  isAnalyzing?: boolean;
  defaultOpen?: boolean;
}) {
  const { t, number, locale } = useTranslation();
  const inputs = useAppStore((s) => s.inputs);
  const setInputs = useAppStore((s) => s.setInputs);
  const activePolygon = useAppStore((s) => s.activePolygon);
  const selected = useAppStore((s) => s.selected);

  const bodyId = React.useId();
  const [isOpen, setIsOpen] = React.useState(defaultOpen || isAnalyzing);

  // "Active Analysis" always reveals the body.
  React.useEffect(() => {
    if (isAnalyzing) setIsOpen(true);
  }, [isAnalyzing]);

  // Bangla needs more horizontal room and has no uppercase form.
  const isBangla = locale === "bn-BD";
  const labelCls = cn(
    "text-[10px] font-medium text-muted-foreground/80 sm:text-[11px]",
    isBangla ? "tracking-normal" : "font-mono uppercase tracking-[0.14em]",
  );

  // `number` is usually a formatter fn, but support Intl.NumberFormat too.
  const formatCount = (value: number) => {
    const formatter: unknown = number;
    if (typeof formatter === "function") {
      return (formatter as (n: number) => string)(value);
    }
    if (
      formatter &&
      typeof formatter === "object" &&
      "format" in formatter &&
      typeof (formatter as { format?: unknown }).format === "function"
    ) {
      return (formatter as { format: (n: number) => string }).format(value);
    }
    return String(value);
  };

  const [currentCrop, setCurrentCrop] = React.useState<string>(
    inputs?.currentCrop ?? "Rice",
  );
  const [desiredCrops, setDesiredCrops] = React.useState<string[]>(
    inputs?.desiredCrops ?? DEFAULT_CROPS,
  );
  const [irrigation, setIrrigation] = React.useState<IrrigationType>(
    inputs?.irrigation ?? "limited",
  );
  const [soilType, setSoilType] = React.useState<SoilType>(
    inputs?.soilType ?? "unknown",
  );
  // Kept in the payload even though the redesign has no priority controls.
  const [priorities] = React.useState({
    soil: inputs?.priorities?.soil ?? 25,
    water: inputs?.priorities?.water ?? 35,
    climate: inputs?.priorities?.climate ?? 20,
    income: inputs?.priorities?.income ?? 20,
  });

  const candidateCount = formatCount(desiredCrops.length);
  const currentCropLabel = currentCrop ? t(currentCrop) : t("Fallow");
  const currentCropIsOverflow =
    !!currentCrop && !CURRENT_CROP_QUICK.includes(currentCrop);
  const atMinimum = desiredCrops.length <= MIN_DESIRED_CROPS;
  const overflowSelectedCount = desiredCrops.filter((crop) =>
    DESIRED_OVERFLOW_CROPS.includes(crop),
  ).length;

  const variantState = isAnalyzing
    ? "active-analysis"
    : isOpen
      ? "expanded"
      : "default";

  const toggleDesiredCrop = (crop: string) => {
    setDesiredCrops((prev) => {
      if (prev.includes(crop)) {
        if (prev.length <= MIN_DESIRED_CROPS) return prev;
        return prev.filter((c) => c !== crop);
      }
      return [...prev, crop];
    });
  };

  const handleRun = () => {
    if (desiredCrops.length < MIN_DESIRED_CROPS) return;

    const lat = activePolygon?.centroid[1] ?? selected?.latitude ?? 24.3745;
    const lng = activePolygon?.centroid[0] ?? selected?.longitude ?? 88.6039;
    const area = activePolygon?.areaHa ?? 2.5;

    setInputs({
      latitude: lat,
      longitude: lng,
      area,
      areaUnit: "hectares",
      currentCrop: currentCrop || null,
      desiredCrops,
      irrigation,
      soilType,
      priorities,
      polygon: activePolygon?.coordinates ?? null,
    });

    onAnalyze();
  };

  return (
    <Card
      data-state={variantState}
      className="no-print overflow-hidden rounded-2xl border-white/10 bg-card/70 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all"
    >
      {/* Header — Row, Space Between */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? bodyId : undefined}
        className="flex w-full cursor-pointer select-none items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/40 sm:p-5"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-amber-400/20 bg-amber-400/10 text-amber-300">
            <SlidersHorizontal className="size-4" />
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
          <Badge
            variant="outline"
            className="max-w-[52vw] gap-1.5 truncate border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-normal text-muted-foreground sm:max-w-none sm:text-[10px]"
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full bg-emerald-400",
                isAnalyzing && "animate-pulse bg-amber-300",
              )}
            />
            <span className="truncate">
              {currentCropLabel} - {candidateCount} {t("candidates")}
            </span>
          </Badge>
          <span className="grid size-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/[0.03] text-muted-foreground">
            {isOpen ? (
              <ChevronUp className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
          </span>
        </span>
      </button>

      {isOpen && (
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
              {CURRENT_CROP_QUICK.map((crop) => {
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
                    {isSelected && <Check className="size-3 shrink-0" />}
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
                  <Check className="size-3 shrink-0" />
                ) : (
                  <Ban className="size-3 shrink-0" />
                )}
                <span>{t("None / Fallow")}</span>
              </button>

              {/* Surfaced selection when the user picked from the overflow menu */}
              {currentCropIsOverflow && (
                <button
                  type="button"
                  onClick={() => setCurrentCrop("")}
                  title={t("Clear")}
                  className={cn(chipBase, chipCurrentActive)}
                >
                  <Check className="size-3 shrink-0" />
                  <span>{t(currentCrop)}</span>
                  <X className="size-3 shrink-0 opacity-60" />
                </button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={iconBtn}
                    title={t("More crops")}
                    aria-label={t("More crops")}
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8} className={menuCls}>
                  {CURRENT_CROP_OVERFLOW.map((crop) => {
                    const isSelected = currentCrop === crop;
                    return (
                      <DropdownMenuItem
                        key={crop}
                        onClick={() => setCurrentCrop(crop)}
                        className={cn(
                          "flex items-center justify-between rounded-md text-xs",
                          isSelected && "bg-amber-400/15 text-amber-200",
                        )}
                      >
                        <span>{t(crop)}</span>
                        {isSelected && (
                          <Check className="size-3.5 text-amber-300" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuItem
                    onClick={() => setCurrentCrop("")}
                    className={cn(
                      "flex items-center justify-between rounded-md text-xs",
                      !currentCrop && "bg-white/10 text-foreground",
                    )}
                  >
                    <span>{t("None / Fallow")}</span>
                    {!currentCrop && <Check className="size-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                    "size-1.5 rounded-full",
                    atMinimum ? "bg-amber-400" : "bg-emerald-400",
                  )}
                />
                {t("Select at least 2")}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {QUICK_DESIRED_CROPS.map((crop) => {
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
                    {isSelected && <Check className="size-3 shrink-0" />}
                    <span>{t(crop)}</span>
                  </button>
                );
              })}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(iconBtn, "relative")}
                    title={t("More crops")}
                    aria-label={t("More crops")}
                  >
                    <MoreHorizontal className="size-4" />
                    {overflowSelectedCount > 0 && (
                      <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-emerald-400 text-[9px] font-bold text-black">
                        {formatCount(overflowSelectedCount)}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={8} className={menuCls}>
                  {DESIRED_OVERFLOW_CROPS.map((crop) => {
                    const isSelected = desiredCrops.includes(crop);
                    const locked = isSelected && atMinimum;
                    return (
                      <DropdownMenuItem
                        key={crop}
                        onClick={() => toggleDesiredCrop(crop)}
                        className={cn(
                          "flex items-center justify-between rounded-md text-xs",
                          isSelected && "bg-emerald-400/15 text-emerald-200",
                          locked && "opacity-70",
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          {isSelected && (
                            <Check className="size-3.5 text-emerald-300" />
                          )}
                          {t(crop)}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </section>

          {/* Section 3 — Environmental Context */}
          <section className="space-y-2.5" aria-label={t("Environmental Context")}>
            <span className={cn(labelCls, "block")}>
              {t("Environmental Context")}
            </span>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Irrigation sub-card */}
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 sm:p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Droplets className="size-3.5 shrink-0 text-cyan-300" />
                  <span className={labelCls}>{t("Irrigation Access")}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
                  {(["rainfed", "limited", "reliable"] as IrrigationType[]).map(
                    (irr) => {
                      const isSelected = irrigation === irr;
                      return (
                        <button
                          key={irr}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setIrrigation(irr)}
                          className={cn(
                            segmentBase,
                            isSelected
                              ? "bg-cyan-400/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.35)]"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                          )}
                        >
                          {t(irr)}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              {/* Soil sub-card */}
              <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5 sm:p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Layers className="size-3.5 shrink-0 text-amber-300" />
                  <span className={labelCls}>{t("Soil Texture")}</span>
                </div>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/20 p-1 sm:grid-cols-4">
                  {(["unknown", "sandy", "loamy", "clay"] as SoilType[]).map(
                    (soil) => {
                      const isSelected = soilType === soil;
                      return (
                        <button
                          key={soil}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setSoilType(soil)}
                          className={cn(
                            segmentBase,
                            isSelected
                              ? "bg-amber-400/15 text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.35)]"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                          )}
                        >
                          {soil === "unknown" ? t("Auto") : t(soil)}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Footer CTA Bar */}
          <div className="border-t border-white/5 pt-5">
            <Button
              onClick={handleRun}
              disabled={isAnalyzing}
              aria-busy={isAnalyzing}
              className={cn(
                "group flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 px-4 text-xs font-semibold text-black shadow-[0_10px_30px_-10px_rgba(251,191,36,0.6)] transition-all hover:from-amber-200 hover:via-amber-300 hover:to-amber-400 hover:shadow-[0_14px_36px_-10px_rgba(251,191,36,0.75)] focus-visible:ring-2 focus-visible:ring-amber-200 sm:h-11 sm:text-sm",
                isAnalyzing && "cursor-wait from-amber-400/80 to-amber-500/80",
              )}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                  <span className="leading-tight">
                    {t("Querying NASA POWER & Satellite Grid...")}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4 shrink-0 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
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