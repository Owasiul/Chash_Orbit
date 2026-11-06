"use client";

import * as React from "react";
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Sprout,
  Droplets,
  Sun,
  ShieldCheck,
  Coins,
  Loader2,
  Check,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import {
  ONBOARDING_CROP_OPTIONS,
  type IrrigationType,
  type SoilType,
} from "@/lib/crops";
import { useTranslation } from "@/lib/locale";

const DEFAULT_CROPS = ["Wheat", "Chickpea", "Lentil", "Maize", "Potato"];

export function FarmerProfileForm({
  onAnalyze,
  isAnalyzing = false,
}: {
  onAnalyze: () => void;
  isAnalyzing?: boolean;
}) {
  const { t, number } = useTranslation();
  const inputs = useAppStore((s) => s.inputs);
  const setInputs = useAppStore((s) => s.setInputs);
  const activePolygon = useAppStore((s) => s.activePolygon);
  const selected = useAppStore((s) => s.selected);

  const [isOpen, setIsOpen] = React.useState(true);

  // Form states initialized from existing inputs or defaults
  const [currentCrop, setCurrentCrop] = React.useState<string>(inputs?.currentCrop ?? "Rice");
  const [desiredCrops, setDesiredCrops] = React.useState<string[]>(
    inputs?.desiredCrops ?? DEFAULT_CROPS
  );
  const [irrigation, setIrrigation] = React.useState<IrrigationType>(
    inputs?.irrigation ?? "limited"
  );
  const [soilType, setSoilType] = React.useState<SoilType>(inputs?.soilType ?? "unknown");
  const [priorities, setPriorities] = React.useState({
    soil: inputs?.priorities.soil ?? 25,
    water: inputs?.priorities.water ?? 35,
    climate: inputs?.priorities.climate ?? 20,
    income: inputs?.priorities.income ?? 20,
  });

  const toggleDesiredCrop = (crop: string) => {
    if (desiredCrops.includes(crop)) {
      if (desiredCrops.length > 2) {
        setDesiredCrops(desiredCrops.filter((c) => c !== crop));
      }
    } else {
      setDesiredCrops([...desiredCrops, crop]);
    }
  };

  const handleRun = () => {
    // Sync store inputs
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
    <Card className="no-print border-white/10 bg-card/60 backdrop-blur transition-all">
      {/* Collapsible Header */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center justify-between p-4 select-none hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-amber-400" />
          <span className="font-mono text-xs uppercase tracking-wider font-semibold text-foreground">
            {t("Farmer Profile & Preferences")}
          </span>
          <Badge variant="outline" className="ml-1 border-white/10 text-[9px] font-mono text-muted-foreground">
            {currentCrop ? `${currentCrop} · ` : ""}{desiredCrops.length} {t("candidates")}
          </Badge>
        </div>
        <Button variant="ghost" size="icon-sm" className="size-6 text-muted-foreground">
          {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>

      {isOpen && (
        <div className="border-t border-white/5 p-4 sm:p-5 space-y-4 text-xs">
          {/* Current Crop */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 block mb-1.5">
              {t("Current Field Crop (Previous harvest)")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {["Rice", "Wheat", "Maize", "Potato", "None / Fallow"].map((c) => {
                const isSelected = currentCrop === c || (c === "None / Fallow" && !currentCrop);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrentCrop(c === "None / Fallow" ? "" : c)}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs transition-colors",
                      isSelected
                        ? "border-amber-400/50 bg-amber-400/15 text-amber-200 font-medium"
                        : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
                    )}
                  >
                    {t(c)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Candidate Crops */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80">
                {t("Crops Under Consideration")} ({desiredCrops.length})
              </label>
              <span className="text-[10px] text-muted-foreground/60">{t("Select at least 2")}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ONBOARDING_CROP_OPTIONS.filter((c) => c !== "Other" && c !== "Fruit" && c !== "Vegetables").map((c) => {
                const isSelected = desiredCrops.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleDesiredCrop(c)}
                    className={cn(
                      "flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors",
                      isSelected
                        ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200 font-medium"
                        : "border-white/10 bg-white/5 text-muted-foreground/80 hover:bg-white/10"
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                    <span>{t(c)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Irrigation & Soil */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 block mb-1.5">
                {t("Irrigation Access")}
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(["rainfed", "limited", "reliable"] as IrrigationType[]).map((irr) => (
                  <button
                    key={irr}
                    type="button"
                    onClick={() => setIrrigation(irr)}
                    className={cn(
                      "rounded border py-1 px-1.5 text-center text-[11px] capitalize transition-colors",
                      irrigation === irr
                        ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200 font-medium"
                        : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
                    )}
                  >
                    {t(irr)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 block mb-1.5">
                {t("Soil Texture")}
              </label>
              <div className="grid grid-cols-4 gap-1">
                {(["unknown", "sandy", "loamy", "clay"] as SoilType[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSoilType(s)}
                    className={cn(
                      "rounded border py-1 px-1 text-center text-[10px] capitalize transition-colors truncate",
                      soilType === s
                        ? "border-amber-400/50 bg-amber-400/15 text-amber-200 font-medium"
                        : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"
                    )}
                  >
                    {s === "unknown" ? t("Auto") : t(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Priority Weights */}
          <div className="space-y-2 pt-1 border-t border-white/5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/80 block">
              {t("Farmer Priority Weights")}
            </span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                  <span>{t("Soil Health")}</span>
                  <span>{number(priorities.soil)}%</span>
                </div>
                <Slider
                  value={[priorities.soil]}
                  onValueChange={([val]) => setPriorities({ ...priorities, soil: val })}
                  max={60}
                  step={5}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                  <span>{t("Water Saving")}</span>
                  <span>{number(priorities.water)}%</span>
                </div>
                <Slider
                  value={[priorities.water]}
                  onValueChange={([val]) => setPriorities({ ...priorities, water: val })}
                  max={60}
                  step={5}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                  <span>{t("Climate Risk")}</span>
                  <span>{number(priorities.climate)}%</span>
                </div>
                <Slider
                  value={[priorities.climate]}
                  onValueChange={([val]) => setPriorities({ ...priorities, climate: val })}
                  max={60}
                  step={5}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
                  <span>{t("Income / Profit")}</span>
                  <span>{number(priorities.income)}%</span>
                </div>
                <Slider
                  value={[priorities.income]}
                  onValueChange={([val]) => setPriorities({ ...priorities, income: val })}
                  max={60}
                  step={5}
                />
              </div>
            </div>
          </div>

          {/* Action button */}
          <div className="pt-2">
            <Button
              onClick={handleRun}
              disabled={isAnalyzing}
              className="w-full bg-gradient-to-r from-amber-400 to-amber-500 font-semibold text-black hover:from-amber-300 hover:to-amber-400 h-10 shadow-[0_0_15px_rgba(251,191,36,0.25)]"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  <span>{t("Querying NASA POWER & Satellite Grid...")}</span>
                </>
              ) : (
                <>
                  <Sprout className="mr-2 size-4" />
                  <span>{t("Analyze Field & Generate Rotation")}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
