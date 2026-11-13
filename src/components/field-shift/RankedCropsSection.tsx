"use client";

import * as React from "react";
import { Calendar, Droplets, Sun, Sprout, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FullAnalysis } from "@/lib/store";
import { useTranslation } from "@/lib/locale";
import { getCropByName } from "@/lib/crops";

function SubFitPill({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  const { t, number } = useTranslation();
  const color =
    score >= 75
      ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10"
      : score >= 50
        ? "text-amber-300 border-amber-400/30 bg-amber-400/10"
        : "text-rose-300 border-rose-400/30 bg-rose-400/10";

  return (
    <div className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs", color)}>
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "size-2.5 shrink-0" })}
      <span>{t(label)}</span>
      <span className="font-semibold">{number(score)}</span>
    </div>
  );
}

export function RankedCropsSection({ analysis }: { analysis: FullAnalysis }) {
  const { t, number } = useTranslation();
  const { cropCompatibility, recommendations } = analysis;

  // Data-quality and confidence assessment based on data sources and resolution
  const vegSource = analysis?.environment?.vegetation?.source || "demo";
  const isLiveQuality = vegSource === "live" || vegSource === "cached";
  const isDerivedQuality = vegSource === "derived";

  const qualityLabel = isLiveQuality
    ? "high-quality"
    : isDerivedQuality
      ? "derived-regional-model"
      : "demo-simulation";

  const resolutionText = isLiveQuality
    ? "250m MODIS · 0.5° POWER"
    : isDerivedQuality
      ? "0.5° MERRA-2 calibrated"
      : "Demo grid";

  const confidenceNote = isLiveQuality
    ? "high-confidence-note"
    : isDerivedQuality
      ? "calibrated-confidence-note"
      : "demo-confidence-note";

  // Use compatibility items (which contain the 4 detailed sub-scores) or recommendations
  const rankedItems = React.useMemo(() => {
    if (cropCompatibility && cropCompatibility.length > 0) {
      return cropCompatibility.slice(0, 5);
    }
    return recommendations.slice(0, 5).map((r) => ({
      crop: r.crop,
      overallFit: r.score,
      climateFit: r.score,
      waterFit: r.score,
      soilFit: r.score,
      rotationFit: r.score,
      seasonFit: r.score,
      reasons: [r.why],
      plantingSeason: "Seasonal",
      harvestSeason: "Standard",
      isPlantableNow: true,
      monthsUntilPlant: 0,
    }));
  }, [cropCompatibility, recommendations]);

  return (
    <Card className="border-white/10 bg-card/50 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-amber-300">
          <Sprout className="size-3.5 text-amber-400" />
          <span>{t("RANKED CROPS & FIT SCORES")}</span>
        </div>
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground/60">
          {t("Weighted by your priorities")}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("Scored across climate suitability, crop water requirements, soil texture matching, and rotational disease/nutrient benefits.")}
      </p>

      <div className="space-y-3">
        {rankedItems.map((c, idx) => {
          const isTop = idx === 0;
          const cropSpec = getCropByName(c.crop);
          return (
            <div
              key={c.crop}
              className={cn(
                "rounded-lg border p-3.5 transition-colors",
                isTop
                  ? "border-amber-400/40 bg-amber-400/[0.04]"
                  : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-6 items-center justify-center rounded-full bg-white/5 font-mono text-xs font-semibold text-amber-300">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium text-foreground">{t(c.crop)}</span>
                      {isTop && (
                        <Badge variant="outline" className="border-amber-400/50 bg-amber-400/15 text-xs text-amber-200">
                          {t("Top Fit")}
                        </Badge>
                      )}
                      {c.isPlantableNow ? (
                        <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-xs text-emerald-200">
                          {t("Plantable now")}
                        </Badge>
                      ) : c.monthsUntilPlant > 0 ? (
                        <span className="text-xs text-muted-foreground font-mono">
                          {t("in {m} mo", { m: c.monthsUntilPlant })}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <span>{t("Plant:")} {t(c.plantingSeason)}</span>
                      <span>·</span>
                      <span>{t("Harvest:")} {t(c.harvestSeason)}</span>
                    </div>
                  </div>
                </div>

                {/* Overall Score */}
                <div className="text-right">
                  <div className="font-mono text-2xl font-light text-amber-300 tabular-nums leading-none">
                    {number(c.overallFit)}
                  </div>
                  <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground mt-0.5">
                    {t("Fit Score")}
                  </div>
                  {(() => {
                    const rec = recommendations.find((r) => r.crop === c.crop);
                    const range = rec?.range;
                    return range ? (
                      <>
                        <div className="font-mono text-xs text-muted-foreground tabular-nums" title={t("Score range if each priority weight changes by 10 points")}>
                          {range[0]}–{range[1]}
                        </div>
                        {rec?.confidence && (
                          <div className="font-mono text-xs text-muted-foreground" title={t("Confidence reflects which inputs were measured and which were estimated")}>
                            {t("Confidence")}: {t(rec.confidence)}
                          </div>
                        )}
                      </>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* 4 Fit Sub-Scores */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <SubFitPill label="Climate" score={c.climateFit} icon={<Sun />} />
                <SubFitPill label="Water" score={c.waterFit} icon={<Droplets />} />
                <SubFitPill label="Soil" score={c.soilFit} icon={<Sprout />} />
                <SubFitPill label="Rotation" score={c.rotationFit} icon={<ShieldCheck />} />
              </div>

              {/* Why this score bullet points */}
              {c.reasons && c.reasons.length > 0 && (
                <div className="mt-2.5 border-t border-white/5 pt-2">
                  <ul className="space-y-1">
                    {c.reasons.slice(0, 3).map((r, rIdx) => (
                      <li key={rIdx} className="flex items-start gap-1.5 text-xs text-foreground/80">
                        <span className="mt-1 size-1 shrink-0 rounded-full bg-amber-400/80" />
                        <span>{t(r)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Data-quality indicator & confidence note per recommendation */}
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 font-mono text-xs">
                <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground/80">
                  <span
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      isLiveQuality
                        ? "bg-emerald-400"
                        : isDerivedQuality
                          ? "bg-cyan-400"
                          : "bg-amber-400"
                    )}
                  />
                  <span>{t("data-quality")}</span>
                  <span className="font-semibold text-foreground/90">{t(qualityLabel)}</span>
                  <span className="text-muted-foreground/50">({resolutionText})</span>
                  {cropSpec && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-muted-foreground/70" title={cropSpec.sourceCitation}>
                        {t("crop-source")} <strong className="text-amber-300/90">{cropSpec.source}</strong>
                      </span>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground/75 italic">
                  {t(confidenceNote)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
