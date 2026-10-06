"use client";

import * as React from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Satellite, Sparkles, Globe2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { LocationSearch } from './LocationSearch';
import { SAMPLE_FARMS } from '@/lib/location';
import { cn } from '@/lib/utils';

const HolographicGlobe = dynamic(
  () => import('@/components/globe/HolographicGlobe').then(m => m.HolographicGlobe),
  {
    ssr: false,
    loading: () => <GlobeLoading />,
  },
);

function GlobeLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground/70">
        <div className="size-12 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-300" />
        <span className="font-mono text-xs tracking-widest">INITIALIZING EARTH OBSERVATION SYSTEM</span>
      </div>
    </div>
  );
}

export function HomeScreen() {
  const setSelected = useAppStore(s => s.setSelected);
  const selected = useAppStore(s => s.selected);
  const setView = useAppStore(s => s.setView);
  const [globeReady, setGlobeReady] = React.useState(false);

  const handleSelect = React.useCallback(
    (r: import('@/lib/location').GeoResult) => {
      setSelected(r);
    },
    [setSelected],
  );

  const handleSample = (id: string) => {
    const s = SAMPLE_FARMS.find(f => f.id === id);
    if (!s) return;
    handleSelect({
      id: 0,
      name: s.name,
      latitude: s.latitude,
      longitude: s.longitude,
      country: s.country,
      countryCode: '',
      featureCode: 'PCLI',
    });
  };

  return (
    <main className="relative min-h-dvh w-full overflow-hidden">
      {/* Globe background — fills viewport */}
      <div className="absolute inset-0 z-0">
        <HolographicGlobe
          selectedLat={selected?.latitude ?? null}
          selectedLng={selected?.longitude ?? null}
          locationName={selected?.name ?? null}
          onReady={() => setGlobeReady(true)}
          size="hero"
          autoRotate
        />
      </div>

      {/* Top — brand + mission tag */}
      <header className="relative z-10 flex items-start justify-between px-6 pt-6 sm:px-10 sm:pt-8">
        <div className="flex items-center gap-2">
          <Satellite className="size-5 text-amber-300" />
          <span className="font-mono text-xs tracking-[0.3em] text-amber-200/90">FIELD SHIFT</span>
        </div>
        <div className="hidden items-center gap-2 font-mono text-[10px] tracking-widest text-muted-foreground/70 sm:flex">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
          EARTH OBSERVATION INTERFACE · v1.0
        </div>
      </header>

      {/* Center — headline + search */}
      <section className="relative z-10 flex min-h-[calc(100dvh-12rem)] flex-col items-center justify-center px-4 py-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl"
        >
          <h1 className="font-sans text-4xl font-light tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Where is your <span className="text-amber-300">field</span>?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground/80 sm:text-base">
            Tell us where your farm is. We analyze NASA Earth-observation data — temperature,
            rainfall, soil moisture, vegetation — and turn it into a transparent
            4-year crop rotation plan.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-8 w-full max-w-2xl"
        >
          <LocationSearch onSelect={handleSelect} autoFocus />
        </motion.div>

        {/* Sample farms */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-5 flex flex-wrap items-center justify-center gap-2"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Quick pick
          </span>
          {SAMPLE_FARMS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleSample(f.id)}
              className={cn(
                'group rounded-full border px-3 py-1 text-xs transition-all',
                selected?.name === f.name
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:border-amber-400/30 hover:bg-amber-400/10 hover:text-amber-200',
              )}
            >
              <span className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-400/60 group-hover:bg-amber-300" />
              {f.name}
            </button>
          ))}
        </motion.div>
      </section>

      {/* Bottom — selected location card + Analyze this area CTA */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            className="absolute inset-x-0 bottom-0 z-20 px-4 pb-6 sm:px-6 sm:pb-8"
          >
            <div className="glass-panel scanline mx-auto flex max-w-2xl flex-col gap-4 rounded-3xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-10 items-center justify-center rounded-2xl bg-amber-400/15">
                    <Globe2 className="size-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
                      Selected Field
                    </div>
                    <div className="text-lg font-semibold text-foreground">
                      {[selected.name, selected.admin1, selected.country].filter(Boolean).join(', ')}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {Math.abs(selected.latitude).toFixed(4)}° {selected.latitude >= 0 ? 'N' : 'S'}
                      {' · '}
                      {Math.abs(selected.longitude).toFixed(4)}° {selected.longitude >= 0 ? 'E' : 'W'}
                    </div>
                  </div>
                </div>
                <div className="hidden shrink-0 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-emerald-300 sm:block">
                  ◦ Awaiting farmer profile
                </div>
              </div>

              <button
                type="button"
                onClick={() => setView('onboarding')}
                className="group flex w-full items-center justify-between rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-400/20 via-amber-300/15 to-amber-400/20 px-5 py-3.5 text-left transition-all hover:border-amber-300/60 hover:from-amber-400/30 hover:to-amber-400/30"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="size-5 text-amber-300" />
                  <div>
                    <div className="font-sans text-base font-medium text-amber-100">
                      Analyze this area
                    </div>
                    <div className="text-xs text-amber-200/60">
                      Tell us what you grow · 90-second onboarding
                    </div>
                  </div>
                </div>
                <ArrowRight className="size-5 text-amber-300 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
