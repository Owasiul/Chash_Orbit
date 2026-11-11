"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, ArrowRight, Sprout, Flame, Droplets, CloudRain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataSourceBadge } from "@/components/field-shift/DataSourceBadge";
import type { FullAnalysis } from "@/lib/store";
import { useTranslation } from "@/lib/locale";

export function VerdictCard({ analysis }: { analysis: FullAnalysis }) {
  const { t, number } = useTranslation();
  const { recommendations, rotationPlan, risks, environment } = analysis;

  // Determine next crop and following crop from rotation plan or ranked recommendations
  const firstCrop = rotationPlan.years[0]?.crop ?? recommendations[0]?.crop ?? "Pulse / Legume";
  const secondCrop = rotationPlan.years[1]?.crop ?? recommendations[1]?.crop ?? "Cereal";

  // Determine dominant environmental risk
  const { heatRisk, droughtRisk, floodRisk } = risks;
  const maxRisk = Math.max(heatRisk, droughtRisk, floodRisk);

  let riskLabel = "";
  let riskDetail = "";
  let RiskIcon = AlertTriangle;
  let riskColor = "text-amber-400";

  if (maxRisk === heatRisk && heatRisk >= 35) {
    riskLabel = t("Elevated heat stress");
    riskDetail = `${environment.temperature.heatStressDays} ${t("heat-stress days")} (${number(heatRisk)}/100)`;
    RiskIcon = Flame;
    riskColor = "text-rose-400";
  } else if (maxRisk === droughtRisk && droughtRisk >= 35) {
    riskLabel = t("Seasonal moisture deficit");
    riskDetail = `${t("soil moisture deficit")} (${number(droughtRisk)}/100)`;
    RiskIcon = Droplets;
    riskColor = "text-amber-400";
  } else if (maxRisk === floodRisk && floodRisk >= 35) {
    riskLabel = t("Monsoon flood / waterlogging");
    riskDetail = `${t("high rainfall intensity")} (${number(floodRisk)}/100)`;
    RiskIcon = CloudRain;
    riskColor = "text-cyan-400";
  } else {
    riskLabel = t("Low climate risk");
    riskDetail = `${t("stable conditions")} (${number(maxRisk)}/100)`;
    RiskIcon = CheckCircle2;
    riskColor = "text-emerald-400";
  }

  return (
    <Card className="verdict-print-card relative overflow-hidden border-amber-400/30 bg-gradient-to-br from-amber-400/[0.08] via-card/70 to-card/90 p-5 sm:p-6 shadow-[0_0_25px_-5px_rgba(251,191,36,0.15)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber-300">
          <CheckCircle2 className="size-3.5 text-amber-400" />
          <span>{t("EXECUTIVE FIELD VERDICT")}</span>
        </div>
        <DataSourceBadge source={environment.overallSource} size="sm" />
      </div>

      {/* Main one-sentence verdict */}
      <div className="mt-3 text-lg font-normal leading-snug text-foreground sm:text-xl">
        <span>{t("Plant")}{" "}</span>
        <strong className="font-semibold text-amber-300">{t(firstCrop)}</strong>
        <span>{" "}{t("next, then")}{" "}</span>
        <strong className="font-semibold text-emerald-300">{t(secondCrop)}</strong>
        <span>; {t("main risk:")}{" "}</span>
        <span className="font-medium text-rose-300">
          {riskLabel} ({riskDetail})
        </span>
        .
      </div>

      {/* Quick summary chips */}
      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-400/10 text-amber-300">
            <Sprout className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
              {t("Year 1 Next Crop")}
            </div>
            <div className="truncate text-xs font-medium text-foreground">{t(firstCrop)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-400/10 text-emerald-300">
            <ArrowRight className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
              {t("Year 2 Next Crop")}
            </div>
            <div className="truncate text-xs font-medium text-foreground">{t(secondCrop)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
          <div className={`flex size-7 shrink-0 items-center justify-center rounded-md bg-white/5 ${riskColor}`}>
            <RiskIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
              {t("Primary Risk")}
            </div>
            <div className="truncate text-xs font-medium text-foreground">{riskLabel}</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
