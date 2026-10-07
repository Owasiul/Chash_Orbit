"use client";

import * as React from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, Plus, X,
  Sprout, Droplets, Sun, ShieldCheck, Coins, Trash2, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import {
  ONBOARDING_CROP_OPTIONS,
  type CropSpec,
} from '@/lib/crops';
import { fetchEnvironment } from '@/lib/nasa/environment';

const HolographicGlobe = dynamic(
  () => import('@/components/globe/HolographicGlobe').then(m => m.HolographicGlobe),
  { ssr: false },
);

// ── Types ───────────────────────────────────────────────────────────────────
type CropRole = 'primary' | 'secondary' | 'considering';
interface CropSelection { name: string; role: CropRole; }

type Irrigation = 'rainfed' | 'limited' | 'reliable';
type Soil = 'unknown' | 'sandy' | 'loamy' | 'clay';

// ── Fetch crop library ─────────────────────────────────────────────────────
function useCropLibrary() {
  const [crops, setCrops] = React.useState<CropSpec[]>([]);
  React.useEffect(() => {
    fetch('/api/crops')
      .then(r => r.json())
      .then((d: { crops: CropSpec[] }) => setCrops(d.crops ?? []))
      .catch(() => {});
  }, []);
  return crops;
}

// ── Step indicator ──────────────────────────────────────────────────────────
function StepHeader({ step }: { step: number }) {
  const steps = ['What do you grow?', 'Farm information', 'What matters most?'];
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border font-mono text-xs transition-all',
                  i < step && 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300',
                  i === step && 'border-amber-400/60 bg-amber-400/20 text-amber-200 shadow-[0_0_12px_2px_rgba(251,191,36,0.3)]',
                  i > step && 'border-white/10 bg-white/5 text-muted-foreground/60',
                )}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'font-mono text-[10px] uppercase tracking-wider transition-colors',
                  i === step ? 'text-amber-200' : 'text-muted-foreground/60',
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="mx-2 h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Step 1 — crops ──────────────────────────────────────────────────────────
function CropStep({
  selections, setSelections,
}: {
  selections: CropSelection[];
  setSelections: (s: CropSelection[]) => void;
}) {
  const [custom, setCustom] = React.useState('');
  const allCrops = ONBOARDING_CROP_OPTIONS;
  const selectedNames = new Set(selections.map(s => s.name));

  const toggle = (name: string, role: CropRole = 'considering') => {
    if (selectedNames.has(name)) {
      setSelections(selections.filter(s => s.name !== name));
    } else {
      setSelections([...selections, { name, role }]);
    }
  };

  const setRole = (name: string, role: CropRole) => {
    setSelections(selections.map(s => (s.name === name ? { ...s, role } : s)));
  };

  const addCustom = () => {
    const n = custom.trim();
    if (n && !selectedNames.has(n)) {
      setSelections([...selections, { name: n, role: 'considering' }]);
      setCustom('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">What do you want to grow?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick your primary crops, secondary crops, and any crops you're considering.
          We'll match each one to your field's signals.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {allCrops.map(name => {
          const sel = selections.find(s => s.name === name);
          const active = !!sel;
          return (
            <button
              key={name}
              type="button"
              onClick={() => toggle(name)}
              className={cn(
                'group rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.3)]'
                  : 'border-white/10 bg-white/5 text-foreground/80 hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-100',
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn(
                  'flex size-4 items-center justify-center rounded-full border',
                  active ? 'border-amber-300 bg-amber-300 text-black' : 'border-white/20',
                )}>
                  {active && <Check className="size-3" />}
                </span>
                {name}
              </div>
            </button>
          );
        })}
      </div>

      {/* Add custom crop */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Add another crop..."
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-amber-400/40"
        />
        <button
          type="button"
          onClick={addCustom}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-amber-400/10 hover:text-amber-200"
        >
          <Plus className="size-4" /> Add
        </button>
      </div>

      {/* Selected crops with role controls */}
      {selections.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Your selected crops ({selections.length})
          </div>
          <div className="space-y-2">
            {selections.map(s => (
              <div key={s.name} className="flex items-center gap-3 rounded-xl bg-white/5 p-2.5">
                <span className="flex-1 text-sm font-medium text-foreground">{s.name}</span>
                <div className="flex gap-1">
                  {(['primary', 'secondary', 'considering'] as CropRole[]).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRole(s.name, role)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-all',
                        s.role === role
                          ? 'bg-amber-400/20 text-amber-200'
                          : 'bg-white/5 text-muted-foreground/60 hover:bg-white/10',
                      )}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => toggle(s.name)}
                  className="rounded-lg p-1 text-muted-foreground/60 hover:bg-rose-500/20 hover:text-rose-300"
                  aria-label="Remove"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 2 — farm info ───────────────────────────────────────────────────────
function FarmStep({
  area, setArea, areaUnit, setAreaUnit,
  currentCrop, setCurrentCrop,
  irrigation, setIrrigation,
  soil, setSoil,
}: {
  area: string; setArea: (v: string) => void;
  areaUnit: 'acres' | 'hectares'; setAreaUnit: (v: 'acres' | 'hectares') => void;
  currentCrop: string; setCurrentCrop: (v: string) => void;
  irrigation: Irrigation; setIrrigation: (v: Irrigation) => void;
  soil: Soil; setSoil: (v: Soil) => void;
}) {
  const currentOptions = ['Rice', 'Wheat', 'Maize', 'Vegetables', 'Other', 'None / fallow'];
  const irrigationOptions: { v: Irrigation; label: string; desc: string; icon: React.ReactNode }[] = [
    { v: 'rainfed', label: 'Rainfed', desc: 'No irrigation infrastructure.', icon: <Droplets className="size-4" /> },
    { v: 'limited', label: 'Limited irrigation', desc: 'Some supplemental watering in dry spells.', icon: <Droplets className="size-4" /> },
    { v: 'reliable', label: 'Reliable irrigation', desc: 'Steady water access through the season.', icon: <Droplets className="size-4" /> },
  ];
  const soilOptions: { v: Soil; label: string; desc: string }[] = [
    { v: 'unknown', label: "I don't know", desc: "We'll infer it from regional signals." },
    { v: 'sandy', label: 'Sandy', desc: 'Drains fast, low water retention.' },
    { v: 'loamy', label: 'Loamy', desc: 'Balanced texture, generally fertile.' },
    { v: 'clay', label: 'Clay', desc: 'Heavy, high water retention, slow drain.' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Farm information</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A few details about your land. If you're unsure about soil, we'll infer it from regional signals.
        </p>
      </div>

      {/* Farm size */}
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Farm size</label>
        <div className="mt-2 flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.1"
            value={area}
            onChange={e => setArea(e.target.value)}
            placeholder="e.g. 5"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none focus:border-amber-400/40"
          />
          <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
            {(['acres', 'hectares'] as const).map(u => (
              <button
                key={u}
                type="button"
                onClick={() => setAreaUnit(u)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all',
                  areaUnit === u ? 'bg-amber-400/20 text-amber-200' : 'text-muted-foreground/70 hover:text-foreground',
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Current crop */}
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Current crop</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {currentOptions.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrentCrop(c)}
              className={cn(
                'rounded-xl border px-3.5 py-2 text-sm transition-all',
                currentCrop === c
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-100'
                  : 'border-white/10 bg-white/5 text-foreground/80 hover:border-amber-400/30 hover:bg-amber-400/10',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Irrigation */}
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Irrigation</label>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {irrigationOptions.map(o => (
            <button
              key={o.v}
              type="button"
              onClick={() => setIrrigation(o.v)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all',
                irrigation === o.v
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-100'
                  : 'border-white/10 bg-white/5 text-foreground/80 hover:border-amber-400/30',
              )}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span className={irrigation === o.v ? 'text-amber-300' : 'text-muted-foreground'}>{o.icon}</span>
                {o.label}
              </div>
              <span className="text-xs text-muted-foreground">{o.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Soil type */}
      <div>
        <div className="flex items-center justify-between">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Soil type</label>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
            <Info className="size-3" /> Not required — we'll infer it if you don't know.
          </span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {soilOptions.map(o => (
            <button
              key={o.v}
              type="button"
              onClick={() => setSoil(o.v)}
              className={cn(
                'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all',
                soil === o.v
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-100'
                  : 'border-white/10 bg-white/5 text-foreground/80 hover:border-amber-400/30',
              )}
            >
              <span className="text-sm font-medium">{o.label}</span>
              <span className="text-[11px] text-muted-foreground">{o.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Step 3 — priorities ────────────────────────────────────────────────────
function PrioritiesStep({
  priorities, setPriorities,
}: {
  priorities: { soil: number; water: number; climate: number; income: number };
  setPriorities: (p: { soil: number; water: number; climate: number; income: number }) => void;
}) {
  const total = priorities.soil + priorities.water + priorities.climate + priorities.income;
  const ok = total === 100;

  const items = [
    { key: 'soil' as const, label: 'Soil health', icon: <Sprout className="size-4" />, color: 'bg-green-400' },
    { key: 'water' as const, label: 'Water conservation', icon: <Droplets className="size-4" />, color: 'bg-cyan-400' },
    { key: 'climate' as const, label: 'Climate resilience', icon: <Sun className="size-4" />, color: 'bg-amber-400' },
    { key: 'income' as const, label: 'Income stability', icon: <Coins className="size-4" />, color: 'bg-violet-400' },
  ];

  const normalize = () => {
    if (total === 0) {
      setPriorities({ soil: 25, water: 25, climate: 25, income: 25 });
      return;
    }
    const f = 100 / total;
    setPriorities({
      soil: Math.round(priorities.soil * f),
      water: Math.round(priorities.water * f),
      climate: Math.round(priorities.climate * f),
      income: 100 - Math.round(priorities.soil * f) - Math.round(priorities.water * f) - Math.round(priorities.climate * f),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">What matters most to you?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Assign a weight to each priority. The total should equal 100%. We weight crop
          recommendations accordingly.
        </p>
      </div>

      {/* 100% meter */}
      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Total</span>
          <span className={cn(
            'font-mono text-lg font-semibold tabular-nums',
            ok ? 'text-emerald-300' : 'text-amber-300',
          )}>
            {total}%
          </span>
        </div>
        <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/5">
          <div className="bg-emerald-500" style={{ width: `${priorities.soil}%` }} />
          <div className="bg-cyan-500" style={{ width: `${priorities.water}%` }} />
          <div className="bg-amber-500" style={{ width: `${priorities.climate}%` }} />
          <div className="bg-violet-500" style={{ width: `${priorities.income}%` }} />
        </div>
        {!ok && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-amber-300/80">Total must equal 100% (currently {total}%)</span>
            <button
              type="button"
              onClick={normalize}
              className="rounded-lg bg-amber-400/15 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-400/25"
            >
              Normalize to 100%
            </button>
          </div>
        )}
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        {items.map(it => (
          <div key={it.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={cn('flex size-9 items-center justify-center rounded-xl bg-white/5', it.color.replace('bg-', 'text-'))}>
                  {it.icon}
                </span>
                <div>
                  <div className="text-sm font-medium text-foreground">{it.label}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                    {priorities[it.key]}% weight
                  </div>
                </div>
              </div>
              <span className="font-mono text-2xl font-light tabular-nums text-foreground">{priorities[it.key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={priorities[it.key]}
              onChange={e => setPriorities({ ...priorities, [it.key]: parseInt(e.target.value, 10) })}
              className="mt-3 w-full accent-amber-400"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main wizard ─────────────────────────────────────────────────────────────
export function OnboardingWizard() {
  const selected = useAppStore(s => s.selected);
  const setView = useAppStore(s => s.setView);
  const runAnalysis = useAppStore(s => s.runAnalysis);

  const crops = useCropLibrary();
  const [step, setStep] = React.useState(0);

  // Step 1
  const [cropSelections, setCropSelections] = React.useState<CropSelection[]>([]);
  // Step 2
  const [area, setArea] = React.useState('5');
  const [areaUnit, setAreaUnit] = React.useState<'acres' | 'hectares'>('acres');
  const [currentCrop, setCurrentCrop] = React.useState('Rice');
  const [irrigation, setIrrigation] = React.useState<Irrigation>('limited');
  const [soil, setSoil] = React.useState<Soil>('unknown');
  // Step 3
  const [priorities, setPriorities] = React.useState({ soil: 35, water: 30, climate: 20, income: 15 });

  if (!selected) {
    // Should never happen — but guard anyway.
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted-foreground">
        <button onClick={() => setView('home')} className="text-amber-300 underline">
          Select a location first.
        </button>
      </div>
    );
  }

  const canContinue = () => {
    if (step === 0) return cropSelections.length > 0;
    if (step === 1) return !!area && parseFloat(area) > 0;
    if (step === 2) {
      const t = priorities.soil + priorities.water + priorities.climate + priorities.income;
      return t === 100;
    }
    return false;
  };

  const next = () => {
    if (step < 2) setStep(step + 1);
    else submit();
  };
  const back = () => {
    if (step === 0) setView('home');
    else setStep(step - 1);
  };

  const submit = () =>
    runAnalysis(
      {
        latitude: selected.latitude,
        longitude: selected.longitude,
        area: parseFloat(area) || undefined,
        areaUnit,
        currentCrop: currentCrop === 'None / fallow' ? null : currentCrop,
        desiredCrops: cropSelections.map(s => s.name),
        irrigation,
        soilType: soil,
        priorities,
      },
      {
        locationName: [selected.name, selected.admin1, selected.country].filter(Boolean).join(', '),
        country: selected.country || undefined,
      },
    );

  return (
    <div className="relative min-h-dvh w-full overflow-hidden">
      {/* Compact globe in background */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-50">
        <HolographicGlobe
          selectedLat={selected.latitude}
          selectedLng={selected.longitude}
          locationName={selected.name}
          size="compact"
          autoRotate
        />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-10">
        <button
          type="button"
          onClick={back}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-white/10 hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back
        </button>
        <div className="font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
          {selected.name} · {Math.abs(selected.latitude).toFixed(2)}°{selected.latitude >= 0 ? 'N' : 'S'} {Math.abs(selected.longitude).toFixed(2)}°{selected.longitude >= 0 ? 'E' : 'W'}
        </div>
      </header>

      {/* Wizard card */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-2xl flex-col justify-center px-4 py-6">
        <div className="glass-panel scanline rounded-3xl p-6 sm:p-8">
          <StepHeader step={step} />
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
            >
              {step === 0 && <CropStep selections={cropSelections} setSelections={setCropSelections} />}
              {step === 1 && (
                <FarmStep
                  area={area} setArea={setArea}
                  areaUnit={areaUnit} setAreaUnit={setAreaUnit}
                  currentCrop={currentCrop} setCurrentCrop={setCurrentCrop}
                  irrigation={irrigation} setIrrigation={setIrrigation}
                  soil={soil} setSoil={setSoil}
                />
              )}
              {step === 2 && <PrioritiesStep priorities={priorities} setPriorities={setPriorities} />}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={back}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              {step === 0 ? 'Globe' : 'Back'}
            </button>
            <button
              type="button"
              disabled={!canContinue()}
              onClick={next}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-medium transition-all',
                canContinue()
                  ? 'border-amber-400/50 bg-amber-400/20 text-amber-100 hover:bg-amber-400/30'
                  : 'border-white/10 bg-white/5 text-muted-foreground/40 cursor-not-allowed',
              )}
            >
              {step === 2 ? (
                <>
                  <ShieldCheck className="size-4" />
                  Analyze my field
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
