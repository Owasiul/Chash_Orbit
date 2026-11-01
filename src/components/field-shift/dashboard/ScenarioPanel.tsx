"use client";

import * as React from 'react';
import { Thermometer, CloudRain, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { FullAnalysis } from '@/lib/store';
import type { FarmerInputs } from '@/lib/decision/engine';
import type { IrrigationType, SoilType } from '@/lib/crops';
import { robustness, runScenario } from '@/lib/decision/scenario';
import { useTranslation } from '@/lib/locale';

function delta(n: number) {
  if (n === 0) return <span className="text-muted-foreground/60">0</span>;
  return (
    <span className={n > 0 ? 'text-emerald-300' : 'text-rose-300'}>
      {n > 0 ? '+' : ''}{n}
    </span>
  );
}

function RiskBar({ label, base, now }: { label: string; base: number; now: number }) {
  const { t, number } = useTranslation();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{t(label)}</span>
        <span className="tabular-nums">{number(base)} → {number(now)}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
        <div className="absolute inset-y-0 left-0 bg-white/20" style={{ width: `${base}%` }} />
        <div
          className={cn('absolute inset-y-0 left-0 opacity-80', now > base ? 'bg-rose-400' : 'bg-emerald-400')}
          style={{ width: `${now}%`, mixBlendMode: 'screen' }}
        />
      </div>
    </div>
  );
}

export function ScenarioPanel({ analysis }: { analysis: FullAnalysis }) {
  const { t, number } = useTranslation();
  const [tempC, setTempC] = React.useState(2);
  const [rainPct, setRainPct] = React.useState(-20);

  const f = analysis.field;
  const env = analysis.environment;

  const inputs = React.useMemo<FarmerInputs>(() => ({
    latitude: f.latitude,
    longitude: f.longitude,
    area: f.area ?? undefined,
    areaUnit: (f.areaUnit ?? undefined) as FarmerInputs['areaUnit'],
    currentCrop: f.currentCrop,
    desiredCrops: f.desiredCrops,
    irrigation: (f.irrigationType ?? 'rainfed') as IrrigationType,
    soilType: (f.soilType ?? 'unknown') as SoilType,
    priorities: f.priorities,
  }), [f]);

  const canRun = !!env.rawPower;

  const scenario = React.useMemo(
    () => ({ tempDeltaC: tempC, rainFactor: 1 + rainPct / 100 }),
    [tempC, rainPct],
  );

  const result = React.useMemo(
    () => (canRun ? runScenario(inputs, env, scenario) : null),
    [canRun, inputs, env, scenario],
  );

  const robust = React.useMemo(
    () => (canRun ? robustness(inputs, env) : null),
    [canRun, inputs, env],
  );

  if (!canRun || !result || !robust) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        {t('What-if analysis needs the NASA POWER daily series, which is not available for this field.')}
      </Card>
    );
  }

  const baseRank = new Map(analysis.recommendations.map(r => [r.crop, r]));
  const topRobust = robust.rows.slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-light tracking-wide text-amber-100">{t('What if the season changes?')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('Shift the observed NASA POWER year and the same scoring engine re-runs instantly. This is a stress test, not a forecast.')}
        </p>
      </div>

      {/* Sliders */}
      <Card className="grid gap-6 p-5 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm"><Thermometer className="size-4 text-amber-300" />{t('Warmer by')}</span>
            <span className="font-mono text-sm tabular-nums">+{number(tempC, { maximumFractionDigits: 1 })} °C</span>
          </div>
          <Slider min={0} max={4} step={0.5} value={[tempC]} onValueChange={v => setTempC(v[0] ?? 0)} />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm"><CloudRain className="size-4 text-cyan-300" />{t('Rainfall change')}</span>
            <span className="font-mono text-sm tabular-nums">{rainPct > 0 ? '+' : ''}{number(rainPct)} %</span>
          </div>
          <Slider min={-40} max={40} step={5} value={[rainPct]} onValueChange={v => setRainPct(v[0] ?? 0)} />
        </div>
      </Card>

      {/* Risk shift */}
      <Card className="space-y-4 p-5">
        <RiskBar label="Heat risk" base={analysis.risks.heatRisk} now={result.risks.heatRisk} />
        <RiskBar label="Drought risk" base={analysis.risks.droughtRisk} now={result.risks.droughtRisk} />
        <RiskBar label="Flood risk" base={analysis.risks.floodRisk} now={result.risks.floodRisk} />
      </Card>

      {/* Ranking shift */}
      <Card className="overflow-x-auto p-5">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {t('Top crops under this scenario')}
        </div>
        <table className="w-full min-w-[420px] text-sm">
          <thead className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr><th className="py-1">#</th><th>{t('Crop')}</th><th className="text-right">{t('Today')}</th><th className="text-right">{t('Scenario')}</th><th className="text-right">Δ</th></tr>
          </thead>
          <tbody>
            {result.recommendations.map(r => {
              const was = baseRank.get(r.crop);
              return (
                <tr key={r.crop} className="border-t border-white/5">
                  <td className="py-2 tabular-nums">{r.rank}</td>
                  <td>{t(r.crop)}</td>
                  <td className="text-right tabular-nums">{was ? number(was.score) : '—'}</td>
                  <td className="text-right tabular-nums">{number(r.score)}</td>
                  <td className="text-right tabular-nums">{was ? delta(r.score - was.score) : <Badge variant="outline">{t('new')}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {/* Robustness */}
      <Card className="overflow-x-auto p-5">
        <div className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-emerald-200">
          <ShieldCheck className="size-3.5" />{t('Most climate-robust crops')}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          {t('Every crop is scored under 9 climate cases (0 / +1 / +2 °C × 20 % drier / same / 20 % wetter). Ranked by worst case: the crop that holds up in a bad year.')}
        </p>
        <table className="w-full min-w-[480px] text-sm">
          <thead className="text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr><th className="py-1">{t('Crop')}</th><th className="text-right">{t('Today')}</th><th className="text-right">{t('Worst case')}</th><th className="text-right">{t('Spread')}</th><th>{t('Weakest when')}</th></tr>
          </thead>
          <tbody>
            {topRobust.map(r => (
              <tr key={r.crop} className="border-t border-white/5">
                <td className="py-2">{t(r.crop)}</td>
                <td className="text-right tabular-nums">{number(r.base)}</td>
                <td className="text-right tabular-nums text-emerald-200">{number(r.worst)}</td>
                <td className="text-right tabular-nums">{number(r.spread)}</td>
                <td className="pl-3 text-xs text-muted-foreground">{r.worstScenario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted-foreground/70">
        {t('Rainfall is scaled evenly across the year, so the timing of precipitation is unchanged, though wet-day counts may change. MODIS vegetation is observed and not re-modelled. Validate any change of crop with a local extension officer.')}
      </p>
    </div>
  );
}
