"use client";

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Thermometer,
  CloudRain,
  Sprout,
  Calendar,
  Plus,
  X,
  Check,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Search,
  Droplets,
  Layers,
  Leaf,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { FullAnalysis } from '@/lib/store';
import { useTranslation } from '@/lib/locale';

interface CropComparisonItem {
  cropName: string;
  scientificName: string;
  category: string;
  season: string;
  growingDays: number;
  nitrogenEffect: 'fixer' | 'depleter' | 'neutral';
  fieldAtmosphere: {
    temperatureC: number;
    rainfallMm: number;
    heatStressDays: number;
    rootZoneSoilMoisturePct: number;
    soilDeficitMm: number;
    ndviVigor: number;
  };
  cropRequirements: {
    tempRange: [number, number, number, number];
    waterRangeMm: [number, number, number, number];
    rootDepth: string;
    tolerances: {
      heat: string;
      drought: string;
      flood: string;
    };
    soilTextures: string[];
  };
  crossCheck: {
    tempSuitability: number;
    waterSuitability: number;
    tempStatus: 'optimal' | 'marginal' | 'extreme';
    waterStatus: 'adequate' | 'deficit' | 'excess';
    waterDeficitMm: number;
    soilTextureMatch: boolean;
    isPlantableNow: boolean;
    monthsUntilPlant: number;
  };
  benefits: string;
}

interface ComparisonResponse {
  fieldLocation: {
    latitude: number;
    longitude: number;
    soilType: string;
    irrigation: string;
  };
  nasaAtmosphericBaseline: {
    growingSeasonAvgTempC: number;
    heatStressDays: number;
    annualRainfallMm: number;
    growingSeasonRainfallMm: number;
    soilMoisturePct: number;
    soilDeficitMm: number;
    vegetationNdvi: number;
    source: string;
  };
  comparisons: CropComparisonItem[];
  insights: {
    plantableNow: string[];
    nitrogenFixers: string[];
    lowestWaterDeficitCrop?: string;
    highestThermalMatchCrop?: string;
  };
}

export function CropAtmosphereComparison({ analysis }: { analysis: FullAnalysis }) {
  const { t, number } = useTranslation();
  const currentCrop = analysis.field.currentCrop || 'Rice';
  const topRec = analysis.recommendations[0]?.crop || 'Maize';
  const secondRec = analysis.recommendations[1]?.crop || 'Chickpea';

  const [selectedCrops, setSelectedCrops] = React.useState<string[]>([
    currentCrop,
    topRec,
    secondRec,
  ]);
  const [data, setData] = React.useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [customInput, setCustomInput] = React.useState<string>('');
  const [resolvingCustom, setResolvingCustom] = React.useState<boolean>(false);

  // Fetch comparison from API
  const fetchComparison = React.useCallback(async (crops: string[]) => {
    if (crops.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/crops/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: analysis.field.latitude,
          longitude: analysis.field.longitude,
          cropNames: crops,
          irrigation: analysis.field.irrigationType || 'rainfed',
          soilType: analysis.field.soilType || 'unknown',
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e) {
      console.error('Failed to load crop comparison:', e);
      toast.error('Failed to cross-check crop atmosphere data');
    } finally {
      setLoading(false);
    }
  }, [analysis]);

  React.useEffect(() => {
    void fetchComparison(selectedCrops);
  }, [fetchComparison, selectedCrops]);

  const handleAddCrop = async (cropToAdd: string) => {
    const trimmed = cropToAdd.trim();
    if (!trimmed) return;
    if (selectedCrops.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.info(`${trimmed} is already selected for comparison`);
      return;
    }
    if (selectedCrops.length >= 4) {
      toast.warning('Compare at most 4 crops at a time for optimal readability.');
      return;
    }

    setResolvingCustom(true);
    try {
      // First ensure crop exists or resolve via AI
      const res = await fetch('/api/crops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const json = await res.json();
      const resolvedName = json.crop?.name || trimmed;

      setSelectedCrops(prev => [...prev, resolvedName]);
      setCustomInput('');
      toast.success(`Added ${resolvedName} to atmospheric cross-check`);
    } catch (err) {
      console.error(err);
      setSelectedCrops(prev => [...prev, trimmed]);
      setCustomInput('');
    } finally {
      setResolvingCustom(false);
    }
  };

  const handleRemoveCrop = (cropToRemove: string) => {
    if (selectedCrops.length <= 1) {
      toast.warning('Keep at least one crop to view atmospheric cross-checks.');
      return;
    }
    setSelectedCrops(prev => prev.filter(c => c !== cropToRemove));
  };

  const quickCandidates = [
    'Rice', 'Wheat', 'Maize', 'Chickpea', 'Soybean', 'Mustard', 'Potato',
    'Tomato', 'Sorghum', 'Pearl Millet', 'Groundnut', 'Cotton', 'Banana', 'Moringa'
  ].filter(c => !selectedCrops.includes(c));

  // Chart data for comparing suitability
  const chartData = (data?.comparisons || []).map(c => ({
    name: c.cropName,
    'Thermal Suitability': c.crossCheck.tempSuitability,
    'Water Suitability': c.crossCheck.waterSuitability,
    'Water Deficit (mm)': c.crossCheck.waterDeficitMm,
  }));

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-300" />
              <h2 className="text-xl font-light text-foreground sm:text-2xl">
                {t('Crop Suitability vs NASA Earth-Science Data')}
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {t(
                'Cross-check any crop against real NASA atmospheric observations: surface temperature, rainfall, soil moisture, and vegetation vigor.'
              )}
            </p>
          </div>
          <Badge variant="outline" className="w-fit border-amber-400/40 bg-amber-400/10 text-amber-200">
            {t('FAO EcoCrop Validated')}
          </Badge>
        </div>

        {/* Field Atmospheric Summary Bar */}
        {data?.nasaAtmosphericBaseline && (
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 sm:grid-cols-4 sm:gap-4">
            <div className="space-y-0.5">
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                <Thermometer className="size-3 text-amber-400" /> {t('Field Temp (Avg)')}
              </span>
              <div className="text-base font-light text-foreground sm:text-lg">
                {number(data.nasaAtmosphericBaseline.growingSeasonAvgTempC)}°C
              </div>
              <span className="text-[10px] text-muted-foreground">
                {data.nasaAtmosphericBaseline.heatStressDays} heat stress days
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                <CloudRain className="size-3 text-cyan-400" /> {t('Season Rain')}
              </span>
              <div className="text-base font-light text-foreground sm:text-lg">
                {number(data.nasaAtmosphericBaseline.growingSeasonRainfallMm)} mm
              </div>
              <span className="text-[10px] text-muted-foreground">
                {number(data.nasaAtmosphericBaseline.annualRainfallMm)} mm/year
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                <Droplets className="size-3 text-emerald-400" /> {t('Root-Zone Moisture')}
              </span>
              <div className="text-base font-light text-foreground sm:text-lg">
                {number(data.nasaAtmosphericBaseline.soilMoisturePct)}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                Deficit: {number(data.nasaAtmosphericBaseline.soilDeficitMm)} mm
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                <Leaf className="size-3 text-lime-400" /> {t('Vegetation (NDVI)')}
              </span>
              <div className="text-base font-light text-foreground sm:text-lg">
                {number(data.nasaAtmosphericBaseline.vegetationNdvi)}
              </div>
              <span className="text-[10px] text-muted-foreground">
                NASA MODIS 250m
              </span>
            </div>
          </div>
        )}

        {/* Selected Crop Chips & Search */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              {t('Comparing crops:')}
            </span>
            {selectedCrops.map(crop => (
              <Badge
                key={crop}
                variant="outline"
                className="flex items-center gap-1.5 border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-sm text-amber-200"
              >
                <span>{t(crop)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCrop(crop)}
                  className="rounded-full p-0.5 hover:bg-amber-400/20"
                >
                  <X className="size-3 text-amber-300" />
                </button>
              </Badge>
            ))}
          </div>

          {/* Add custom crop input & quick chips */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAddCrop(customInput);
                  }
                }}
                placeholder={t('Type ANY crop to test (e.g. Barley, Cassava, Moringa, Sunflower)...')}
                className="h-9 border-white/10 bg-white/[0.04] pl-9 text-xs"
              />
            </div>
            <Button
              size="sm"
              disabled={resolvingCustom || !customInput.trim()}
              onClick={() => void handleAddCrop(customInput)}
              className="h-9 border border-amber-400/40 bg-amber-400/20 text-xs text-amber-100 hover:bg-amber-400/30"
            >
              {resolvingCustom ? (
                <span className="flex items-center gap-1">
                  <span className="size-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                  {t('Resolving...')}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Plus className="size-3.5" /> {t('Add Crop')}
                </span>
              )}
            </Button>
          </div>

          {/* Quick candidates */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
              {t('Quick add:')}
            </span>
            {quickCandidates.slice(0, 8).map(crop => (
              <button
                key={crop}
                type="button"
                onClick={() => void handleAddCrop(crop)}
                className="rounded-md border border-white/5 bg-white/[0.03] px-2 py-0.5 text-xs text-foreground/80 hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200"
              >
                + {t(crop)}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Comparison Grid Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(data?.comparisons || []).map((c, i) => {
          const tempEnvelope = c.cropRequirements.tempRange;
          const waterEnvelope = c.cropRequirements.waterRangeMm;
          const isOptimalTemp = c.crossCheck.tempStatus === 'optimal';
          const isFixer = c.nitrogenEffect === 'fixer';

          return (
            <motion.div
              key={c.cropName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
            >
              <Card className="flex h-full flex-col justify-between border-white/10 bg-card/60 p-4 sm:p-5">
                <div className="space-y-4">
                  {/* Title & Category */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-medium text-foreground">{t(c.cropName)}</span>
                        {c.crossCheck.isPlantableNow && (
                          <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-[10px] text-emerald-200">
                            {t('Plantable Now')}
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] italic text-muted-foreground">
                        {c.scientificName} · {t(c.category)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-2xl font-light text-amber-300">
                        {number(c.crossCheck.tempSuitability)}
                      </span>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">
                        {t('Temp Fit')}
                      </div>
                    </div>
                  </div>

                  <Separator className="bg-white/10" />

                  {/* Temperature Section */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
                        <Thermometer className="size-3 text-amber-400" /> {t('Temperature Window')}
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                          isOptimalTemp
                            ? 'bg-emerald-400/10 text-emerald-300'
                            : c.crossCheck.tempStatus === 'marginal'
                            ? 'bg-amber-400/10 text-amber-300'
                            : 'bg-rose-400/10 text-rose-300'
                        )}
                      >
                        {t(c.crossCheck.tempStatus)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{t('Optimal Growth:')}</span>
                      <span className="font-mono text-foreground">
                        {tempEnvelope[1]}°C – {tempEnvelope[2]}°C
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{t('Field NASA Temp:')}</span>
                      <span className="font-mono font-medium text-amber-300">
                        {number(c.fieldAtmosphere.temperatureC)}°C
                      </span>
                    </div>
                    {/* Visual range bar */}
                    <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="absolute inset-y-0 rounded-full bg-emerald-400/60"
                        style={{
                          left: `${Math.max(0, Math.min(100, (tempEnvelope[1] / 45) * 100))}%`,
                          width: `${Math.max(5, Math.min(100, ((tempEnvelope[2] - tempEnvelope[1]) / 45) * 100))}%`,
                        }}
                      />
                      <div
                        className="absolute -top-0.5 h-3 w-1.5 rounded-full bg-amber-300 ring-2 ring-background"
                        style={{
                          left: `${Math.max(2, Math.min(98, (c.fieldAtmosphere.temperatureC / 45) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Water & Rainfall Section */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
                        <CloudRain className="size-3 text-cyan-400" /> {t('Water & Irrigation')}
                      </span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                          c.crossCheck.waterDeficitMm === 0
                            ? 'bg-emerald-400/10 text-emerald-300'
                            : 'bg-rose-400/10 text-rose-300'
                        )}
                      >
                        {c.crossCheck.waterDeficitMm === 0 ? t('Covered') : t('Deficit')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{t('Optimal Water:')}</span>
                      <span className="font-mono text-foreground">
                        {waterEnvelope[1]} – {waterEnvelope[2]} mm
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{t('Field Season Rain:')}</span>
                      <span className="font-mono text-foreground">
                        {number(c.fieldAtmosphere.rainfallMm)} mm
                      </span>
                    </div>
                    {c.crossCheck.waterDeficitMm > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-rose-300">
                        <span>{t('Irrigation needed:')}</span>
                        <span className="font-mono font-medium">
                          +{number(c.crossCheck.waterDeficitMm)} mm
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Soil & Nutrient Impact */}
                  <div className="space-y-1.5 text-xs">
                    <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
                      <Layers className="size-3 text-emerald-400" /> {t('Soil & Nutrients')}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-normal',
                          isFixer
                            ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                            : 'border-white/10 text-muted-foreground'
                        )}
                      >
                        {isFixer ? t('✓ Nitrogen Fixer (+Soil)') : t('Nitrogen Depleter')}
                      </Badge>
                      <Badge variant="outline" className="border-white/10 text-[10px] font-normal text-muted-foreground">
                        {t('Root:')} {t(c.cropRequirements.rootDepth)}
                      </Badge>
                      {c.crossCheck.soilTextureMatch && (
                        <Badge variant="outline" className="border-cyan-400/30 text-[10px] font-normal text-cyan-200">
                          {t('Soil Match')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Benefits description */}
                  <div className="rounded border border-white/5 bg-white/[0.02] p-2 text-[11px] text-muted-foreground">
                    {t(c.benefits)}
                  </div>
                </div>

                {/* Footer status */}
                <div className="mt-4 border-t border-white/10 pt-2 text-[10px] text-muted-foreground">
                  {c.crossCheck.isPlantableNow ? (
                    <span className="text-emerald-300">
                      ● {t('Currently in the planting window for your field.')}
                    </span>
                  ) : (
                    <span className="text-amber-300/80">
                      ○ {t('Next planting window begins in {months} month(s).', { months: c.crossCheck.monthsUntilPlant })}
                    </span>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Comparative Bar Chart Card */}
      {chartData.length > 0 && (
        <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-medium text-foreground">{t('Atmospheric Fit Comparison')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('Comparing thermal suitability vs water deficit requirements')}
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Thermal Suitability" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Water Suitability" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Water Deficit (mm)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
