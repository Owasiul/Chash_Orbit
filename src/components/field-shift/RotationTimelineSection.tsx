"use client";

import * as React from "react";
import { Calendar, Sprout, ArrowRight, ShieldCheck, Droplets, Sun, Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FullAnalysis } from "@/lib/store";
import { useTranslation } from "@/lib/locale";

function RotationScoreChip({
  label,
  score,
  icon,
  color,
}: {
  label: string;
  score: number;
  icon: React.ReactNode;
  color: "emerald" | "cyan" | "amber" | "violet";
}) {
  const { t, number } = useTranslation();
  const colorMap = {
    emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
    cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
    amber: "border-amber-400/30 bg-amber-400/10 text-amber-200",
    violet: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono", colorMap[color])}>
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "size-3 shrink-0" })}
      <span className="text-[10px] uppercase tracking-wider">{t(label)}</span>
      <span className="font-semibold">{number(score)}</span>
    </div>
  );
}

export function RotationTimelineSection({ analysis }: { analysis: FullAnalysis }) {
  const { t, number } = useTranslation();
  const { rotationPlan } = analysis;
  const years = rotationPlan.years ?? [];

  return (
    <Card className="border-white/10 bg-card/50 p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300">
          <Calendar className="size-3.5 text-amber-400" />
          <span>{t("4-YEAR SUSTAINABLE ROTATION TIMELINE")}</span>
        </div>
        <div className="font-mono text-sm font-light text-amber-300">
          {t("Plan Score:")} <strong className="font-normal text-lg">{number(rotationPlan.overallScore)}</strong>/100
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("Alternates nitrogen-fixing legumes with cereals to restore soil fertility, prevent disease carryover, and maintain income stability.")}
      </p>

      {/* Rotation Sub-Scores */}
      <div className="flex flex-wrap items-center gap-2">
        <RotationScoreChip label="Soil" score={rotationPlan.soilScore} icon={<Sprout />} color="emerald" />
        <RotationScoreChip label="Water" score={rotationPlan.waterScore} icon={<Droplets />} color="cyan" />
        <RotationScoreChip label="Climate" score={rotationPlan.climateScore} icon={<Sun />} color="amber" />
        <RotationScoreChip label="Income" score={rotationPlan.incomeScore} icon={<Coins />} color="violet" />
      </div>

      {/* 4 Years Timeline Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {years.map((y, idx) => {
          const isLegume = /lentil|chickpea|mung|pea|bean|soybean|gram|pigeon/i.test(y.crop);
          return (
            <div
              key={y.year}
              className={cn(
                "relative rounded-lg border p-3.5 flex flex-col justify-between transition-colors",
                isLegume
                  ? "border-emerald-400/30 bg-emerald-400/[0.04]"
                  : "border-cyan-400/20 bg-cyan-400/[0.02]"
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
                    {t("Year {year}", { year: y.year })}
                  </span>
                  <span className="font-mono text-lg font-light text-foreground/90">
                    {number(y.score)}
                  </span>
                </div>

                <div className="mt-2">
                  <div className="text-base font-medium text-foreground">{t(y.crop)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] font-mono",
                        isLegume
                          ? "border-emerald-400/40 text-emerald-300 bg-emerald-400/10"
                          : "border-cyan-400/40 text-cyan-300 bg-cyan-400/10"
                      )}
                    >
                      {isLegume ? t("Nitrogen Fixer") : t("Cereal / Depleter")}
                    </Badge>
                    {y.irrigationLevel && (
                      <Badge variant="outline" className="border-white/10 text-[9px] font-mono capitalize">
                        {t(y.irrigationLevel)}
                      </Badge>
                    )}
                  </div>
                </div>

                {y.plantingSeason && y.harvestSeason && (
                  <div className="mt-2 text-[10px] text-muted-foreground font-mono">
                    {t("Plant:")} {t(y.plantingSeason)} · {t("Harvest:")} {t(y.harvestSeason)}
                  </div>
                )}

                {y.coverCrop && (
                  <div className="mt-2 rounded bg-amber-400/10 border border-amber-400/20 px-2 py-1 text-[10px] text-amber-200 font-mono">
                    {t("Cover Crop:")} {t(y.coverCrop)}
                  </div>
                )}
              </div>

              {y.reason && (
                <div className="mt-3 border-t border-white/5 pt-2 text-xs text-foreground/75 leading-relaxed">
                  {t(y.reason)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
