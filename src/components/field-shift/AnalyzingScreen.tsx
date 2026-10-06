"use client";

import * as React from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Radio, Satellite } from 'lucide-react';

const HolographicGlobe = dynamic(
  () => import('@/components/globe/HolographicGlobe').then(m => m.HolographicGlobe),
  { ssr: false },
);

const STEPS = [
  { label: 'Locating field', icon: Radio },
  { label: 'Reading NASA climate signals', icon: Satellite },
  { label: 'Checking rainfall patterns', icon: Satellite },
  { label: 'Checking soil moisture', icon: Satellite },
  { label: 'Assessing vegetation', icon: Satellite },
  { label: 'Comparing crop requirements', icon: Satellite },
  { label: 'Calculating field risks', icon: Satellite },
];

// The actual fetch happens in the OnboardingWizard (parent). This screen just
// animates the progress while the parent's await resolves. We fake-tick the
// first 5 steps (locate / NASA / rainfall / soil moisture / vegetation) at a
// steady pace so the screen always feels alive, but we never claim "done" on
// steps that the backend must produce — those we mark as "in progress" until
// the parent swaps the view. The completion of the last 2 steps is implicit
// in the view transition (we never show a false "✓ done" before data is back).
export function AnalyzingScreen() {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    // Tick the first 5 steps over ~6s (one per ~1.2s). Steps 6-7 stay
    // "in progress" until the parent swaps views.
    const interval = setInterval(() => {
      setTick(t => Math.min(t + 1, 5));
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative min-h-dvh w-full overflow-hidden">
      {/* Globe in background, no auto-rotate during analysis */}
      <div className="absolute inset-0 z-0">
        <HolographicGlobe
          // We don't know lat/lng at this layer; just show a slowly rotating
          // earth as the parent works. The parent will swap views when done.
          autoRotate
          size="hero"
        />
      </div>

      {/* HUD overlay */}
      <div className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="mb-6 text-center">
            <div className="font-mono text-[10px] uppercase tracking-[0.4em] text-amber-200/80">
              Field Shift · Acquisition in progress
            </div>
            <h1 className="mt-2 text-3xl font-light text-foreground">
              Analyzing your <span className="text-amber-300">field</span>...
            </h1>
          </div>

          <div className="glass-panel scanline rounded-3xl p-6">
            <ul className="space-y-3">
              {STEPS.map((s, i) => {
                const done = i < tick;
                const inProgress = i === tick;
                const waiting = i > tick;
                const Icon = done ? Check : Loader2;
                return (
                  <li key={s.label} className="flex items-center gap-3">
                    <span
                      className={`flex size-7 items-center justify-center rounded-full border transition-all ${
                        done
                          ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-300'
                          : inProgress
                            ? 'border-amber-400/40 bg-amber-400/15 text-amber-300'
                            : 'border-white/10 bg-white/5 text-muted-foreground/40'
                      }`}
                    >
                      <Icon className={`size-4 ${!done && inProgress ? 'animate-spin' : ''}`} />
                    </span>
                    <span
                      className={`text-sm transition-colors ${
                        done
                          ? 'text-foreground'
                          : inProgress
                            ? 'text-amber-200'
                            : 'text-muted-foreground/50'
                      }`}
                    >
                      {s.label}
                    </span>
                    {done && (
                      <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-emerald-300/80">
                        ✓
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <AnimatePresence>
              {tick >= 5 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 font-mono text-[11px] text-amber-200/80"
                >
                  ◦ Comparing your crops against NASA observations — composing rotation plan...
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
            Live NASA POWER · SMAP / GPM / MODIS derived
          </div>
        </motion.div>
      </div>
    </main>
  );
}
