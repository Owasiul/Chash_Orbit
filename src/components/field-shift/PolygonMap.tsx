"use client";

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Map, NavigationControl, AttributionControl, setWorkerUrl, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Configure same-origin MapLibre Web Worker for Next.js / Turbopack
if (typeof window !== 'undefined') {
  try {
    setWorkerUrl(new URL('/maplibre-gl-worker.mjs', window.location.origin).toString());
  } catch {
    setWorkerUrl('/maplibre-gl-worker.mjs');
  }
}
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import {
  validatePolygon,
  createPolygonFeature,
  createPresetField,
  formatArea,
  type PolygonValidationResult,
} from '@/lib/polygon';
import { useTranslation } from '@/lib/locale';
import { Layers, Globe2, MapPin, Trash2, Edit3, CheckCircle2, AlertTriangle, Maximize2, Compass, RotateCcw, Square, X, Sprout } from "lucide-react";
import { cn } from '@/lib/utils';

const HolographicGlobe = dynamic(
  () => import('@/components/globe/HolographicGlobe').then((m) => m.HolographicGlobe),
  { ssr: false },
);

export type MapLayer = 'satellite' | 'streets' | 'ndvi';
export type DrawMode = 'polygon' | 'select' | 'static';

function isWebGL2Available(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGL2RenderingContext &&
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false })
    );
  } catch {
    return false;
  }
}

export interface PolygonMapProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  height?: number | string;
  className?: string;
  enableDrawing?: boolean;
  showToolbar?: boolean;
  initialPolygon?: [number, number][];
  onPolygonChange?: (result: PolygonValidationResult | null, feature: any) => void;
  onLocationSelect?: (point: { latitude: number; longitude: number }) => void;
  showBottomHelper?: boolean;
  globeTarget?: { latitude: number; longitude: number; name?: string | null } | null;
}

export function PolygonMap({
  latitude = 15,
  longitude = 15,
  zoom = 1.0,
  height = '100%',
  className,
  enableDrawing = true,
  showToolbar = true,
  initialPolygon,
  onPolygonChange,
  onLocationSelect,
  showBottomHelper = false,
  globeTarget = null,
}: PolygonMapProps) {
  const { t } = useTranslation();
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<Map | null>(null);
  const drawRef = React.useRef<TerraDraw | null>(null);
  const polygonModeRef = React.useRef<TerraDrawPolygonMode | null>(null);

  const [activeLayer, setActiveLayer] = React.useState<MapLayer>('satellite');
  const [isGlobe, setIsGlobe] = React.useState(false);
  const [currentMode, setCurrentMode] = React.useState<DrawMode>('select');
  const [validation, setValidation] = React.useState<PolygonValidationResult | null>(null);
  const [activeFeatureId, setActiveFeatureId] = React.useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = React.useState(false);
  const [webglError, setWebglError] = React.useState<string | null>(null);

  const currentModeRef = React.useRef<DrawMode>(currentMode);
  React.useEffect(() => {
    currentModeRef.current = currentMode;
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const canvas = map.getCanvas();
    if (canvas) {
      canvas.style.cursor = currentMode === 'polygon' ? 'crosshair' : '';
    }
    if (currentMode === 'polygon') {
      map.doubleClickZoom.disable();
    } else {
      map.doubleClickZoom.enable();
    }
  }, [currentMode, mapLoaded]);

  const isProgrammaticUpdateRef = React.useRef(false);
  const lastReportedCoordsStr = React.useRef<string>('');
  const onPolygonChangeRef = React.useRef(onPolygonChange);
  React.useEffect(() => {
    onPolygonChangeRef.current = onPolygonChange;
  }, [onPolygonChange]);

  // Conservative recent date for MODIS Terra NDVI 8-day composite
  const ndviDate = React.useMemo(() => {
    const d = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  }, []);

  const mapStyle: StyleSpecification = React.useMemo(() => ({
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Esri, Maxar, Earthstar Geographics',
        maxzoom: 19,
      },
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors',
        maxzoom: 19,
      },
      ndvi: {
        type: 'raster',
        tiles: [
          // NASA EOSDIS GIBS MODIS Terra NDVI 8-day composite layer.
          `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${ndviDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
        ],
        tileSize: 256,
        attribution: 'NASA EOSDIS GIBS',
        maxzoom: 9,
      },
    },
    layers: [
      {
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: 'visible' },
      },
      {
        id: 'osm-layer',
        type: 'raster',
        source: 'osm',
        layout: { visibility: 'none' },
      },
      {
        id: 'ndvi-layer',
        type: 'raster',
        source: 'ndvi',
        layout: { visibility: 'none' },
      },
    ],
  }), [ndviDate]);

  // Keep layer visibility synchronized with activeLayer state
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    try {
      if (map.getLayer('satellite-layer')) {
        map.setLayoutProperty('satellite-layer', 'visibility', activeLayer === 'satellite' ? 'visible' : 'none');
      }
      if (map.getLayer('osm-layer')) {
        map.setLayoutProperty('osm-layer', 'visibility', activeLayer === 'streets' ? 'visible' : 'none');
      }
      if (map.getLayer('ndvi-layer')) {
        map.setLayoutProperty('ndvi-layer', 'visibility', activeLayer === 'ndvi' ? 'visible' : 'none');
      }
    } catch {
      // safe no-op if layers are in-transition
    }
  }, [activeLayer, mapLoaded]);

  // Initialize MapLibre GL map & Terra Draw
  React.useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!isWebGL2Available()) {
      setWebglError('WebGL2 graphics acceleration is required for 3D satellite mapping.');
      return;
    }

    let map: Map | null = null;
    let draw: TerraDraw | null = null;

    try {
      map = new Map({
        container: mapContainerRef.current,
        style: mapStyle,
        center: [longitude, latitude],
        zoom,
        minZoom: 1,
        maxZoom: 19,
        pitch: 0,
        attributionControl: false,
      });

      map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new NavigationControl({ showCompass: true }), 'bottom-right');

      map.on('load', () => {
        setMapLoaded(true);

        if (enableDrawing) {
          try {
            const adapter = new TerraDrawMapLibreGLAdapter({ map: map! });
            const polygonMode = new TerraDrawPolygonMode({
              showCoordinatePoints: true,
              pointerDistance: 50,
              styles: {
                fillColor: '#f59e0b',
                fillOpacity: 0.35,
                outlineColor: '#fbbf24',
                outlineWidth: 3,
                coordinatePointColor: '#f59e0b',
                coordinatePointWidth: 6,
                coordinatePointOutlineColor: '#ffffff',
                coordinatePointOutlineWidth: 2,
                closingPointColor: '#10b981',
                closingPointWidth: 9,
                closingPointOutlineColor: '#ffffff',
                closingPointOutlineWidth: 2.5,
              },
              cursors: {
                start: 'crosshair',
                close: 'pointer',
              },
            });
            polygonModeRef.current = polygonMode;

            const selectMode = new TerraDrawSelectMode({
              flags: {
                polygon: {
                  feature: {
                    draggable: true,
                    coordinates: {
                      midpoints: true,
                      draggable: true,
                      deletable: true,
                    },
                  },
                },
              },
              styles: {
                selectedPolygonColor: '#f59e0b',
                selectedPolygonFillOpacity: 0.35,
                selectedPolygonOutlineColor: '#fbbf24',
                selectedPolygonOutlineWidth: 3,
                selectionPointColor: '#ffffff',
                selectionPointOutlineColor: '#f59e0b',
                selectionPointWidth: 6,
                selectionPointOutlineWidth: 2,
                midPointColor: '#38bdf8',
                midPointOutlineColor: '#ffffff',
                midPointWidth: 5,
                midPointOutlineWidth: 1.5,
              },
            });

            draw = new TerraDraw({
              adapter,
              modes: [polygonMode, selectMode],
            });

            draw.start();
            drawRef.current = draw;
            if (typeof window !== 'undefined') {
              (window as any).__draw = draw;
            }

            // Single active polygon enforcement helper
            const enforceSinglePolygon = (latestId?: string) => {
              if (!draw || isProgrammaticUpdateRef.current) return null;
              const snapshot = draw.getSnapshot();
              const polygons = snapshot.filter(f => f.geometry.type === 'Polygon');
              if (polygons.length === 0) {
                if (lastReportedCoordsStr.current !== '') {
                  lastReportedCoordsStr.current = '';
                  setValidation(null);
                  setActiveFeatureId(null);
                  onPolygonChangeRef.current?.(null, null);
                }
                return null;
              }

              const chosen = latestId
                ? (polygons.find(p => p.id === latestId) || polygons[polygons.length - 1])
                : polygons[polygons.length - 1];

              // Remove any other polygons so there is strictly one active polygon
              const otherIds = polygons.filter(p => p.id !== chosen.id).map(p => p.id as string);
              if (otherIds.length > 0) {
                isProgrammaticUpdateRef.current = true;
                draw.removeFeatures(otherIds);
                isProgrammaticUpdateRef.current = false;
              }

              const coords = (chosen.geometry as any).coordinates?.[0] as [number, number][];
              const coordsStr = JSON.stringify(coords ?? []);
              if (coordsStr === lastReportedCoordsStr.current) {
                return chosen;
              }
              lastReportedCoordsStr.current = coordsStr;

              const valResult = validatePolygon(chosen);
              setValidation(valResult);
              setActiveFeatureId(chosen.id ? String(chosen.id) : null);
              onPolygonChangeRef.current?.(valResult, chosen);
              return chosen;
            };

            draw.on('finish', (id) => {
              const poly = enforceSinglePolygon(String(id));
              // Switch to select mode to expose vertex edit handles
              if (draw) {
                draw.setMode('select');
                setCurrentMode('select');
                const targetId = poly?.id ? String(poly.id) : String(id);
                try {
                  draw.selectFeature(targetId);
                } catch {}
              }
            });

            draw.on('change', () => {
              // Only enforce in select mode when editing an existing completed polygon.
              // Never validate/delete during in-progress drawing!
              if (draw && draw.getMode() === 'select') {
                enforceSinglePolygon();
              }
            });

            // Load initial polygon if provided
            if (initialPolygon && initialPolygon.length >= 4) {
              isProgrammaticUpdateRef.current = true;
              const initialFeature = createPolygonFeature(initialPolygon);
              draw.addFeatures([initialFeature as never]);
              isProgrammaticUpdateRef.current = false;
              lastReportedCoordsStr.current = JSON.stringify(initialPolygon);
              const valResult = validatePolygon(initialFeature);
              setValidation(valResult);
              setActiveFeatureId(String(initialFeature.id));
              onPolygonChangeRef.current?.(valResult, initialFeature);
              draw.setMode('select');
              setCurrentMode('select');
              try {
                draw.selectFeature(String(initialFeature.id));
              } catch {}
            } else {
              draw.setMode('select');
              setCurrentMode('select');
            }
          } catch (e) {
            console.error('[PolygonMap] Failed to initialize Terra Draw:', e);
          }
        }
      });

      map.on('dblclick', (e) => {
        if (currentModeRef.current === 'polygon' && polygonModeRef.current) {
          e.preventDefault();
          try {
            if (((polygonModeRef.current as any).currentCoordinate || 0) >= 3) {
              (polygonModeRef.current as unknown as { close(): void }).close();
            }
          } catch {}
        }
      });

      map.on('click', (e) => {
        const target = e.originalEvent.target;
        if (!(target instanceof Node) || !map || !map.getCanvasContainer().contains(target)) return;
        if (currentModeRef.current === 'polygon') return;
        onLocationSelect?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
      });

      mapRef.current = map;
      if (typeof window !== 'undefined') {
        (window as any).__map = map;
      }

      // Observe container resizes and synchronize map dimensions
      const observer = new ResizeObserver(() => {
        if (mapRef.current) {
          try {
            mapRef.current.resize();
          } catch {}
        }
      });
      observer.observe(mapContainerRef.current);

      return () => {
        observer.disconnect();
        if (draw) {
          try {
            draw.stop();
          } catch {}
        }
        if (map) {
          try {
            map.remove();
          } catch {}
        }
        mapRef.current = null;
        drawRef.current = null;
      };
    } catch (err: any) {
      console.warn('[PolygonMap] WebGL2 MapLibre initialization failed:', err);
      setWebglError(err?.message || 'WebGL2 hardware acceleration is required to display 3D map');
      return;
    }
  }, []); // Run once on mount

  // Fly to location when latitude, longitude, or zoom props change
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.flyTo({
      center: [longitude, latitude],
      zoom: zoom,
      essential: true,
      duration: 1800,
    });
  }, [latitude, longitude, zoom, mapLoaded]);

  // Update polygon when initialPolygon prop changes
  React.useEffect(() => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map || !mapLoaded) return;

    if (!initialPolygon || initialPolygon.length < 4) {
      if (lastReportedCoordsStr.current !== '') {
        isProgrammaticUpdateRef.current = true;
        draw.clear();
        isProgrammaticUpdateRef.current = false;
        lastReportedCoordsStr.current = '';
        setValidation(null);
        setActiveFeatureId(null);
        onPolygonChangeRef.current?.(null, null);
      }
      return;
    }

    const currentCoordsStr = JSON.stringify(initialPolygon);
    if (currentCoordsStr === lastReportedCoordsStr.current) {
      return;
    }
    lastReportedCoordsStr.current = currentCoordsStr;

    isProgrammaticUpdateRef.current = true;
    draw.clear();
    const feat = createPolygonFeature(initialPolygon);
    draw.addFeatures([feat as never]);
    isProgrammaticUpdateRef.current = false;

    const valResult = validatePolygon(feat);
    setValidation(valResult);
    setActiveFeatureId(String(feat.id));
    onPolygonChangeRef.current?.(valResult, feat);

    if (valResult.valid && valResult.bbox) {
      map.fitBounds(valResult.bbox, {
        padding: { top: 60, bottom: 80, left: 60, right: 60 },
        duration: 1200,
        essential: true,
      });
    }
    draw.setMode('select');
    setCurrentMode('select');
    try {
      draw.selectFeature(String(feat.id));
    } catch {}
  }, [initialPolygon, mapLoaded]);

  // Drawing Toolbar Actions
  const handleStartDraw = () => {
    const draw = drawRef.current;
    if (!draw) return;
    try {
      // Clear any prior polygon so user can immediately draw a fresh boundary
      isProgrammaticUpdateRef.current = true;
      draw.clear();
      isProgrammaticUpdateRef.current = false;
      lastReportedCoordsStr.current = '';
      setValidation(null);
      setActiveFeatureId(null);
      onPolygonChangeRef.current?.(null, null);

      draw.setMode('polygon');
      setCurrentMode('polygon');
    } catch (e) {
      console.error('[PolygonMap] handleStartDraw error:', e);
    }
  };

  const handleFinishDraw = () => {
    const draw = drawRef.current;
    const polyMode = polygonModeRef.current;
    if (!draw || !polyMode) return;
    try {
      const coordsCount = (polyMode as any).currentCoordinate || 0;
      if (coordsCount >= 3) {
        (polyMode as unknown as { close(): void }).close();
      } else {
        alert(t('Please click at least 3 points on the satellite map to outline your field boundary.'));
      }
    } catch (e) {
      console.warn('[PolygonMap] handleFinishDraw error:', e);
    }
  };

  const handleCancelDraw = () => {
    const draw = drawRef.current;
    if (!draw) return;
    try {
      isProgrammaticUpdateRef.current = true;
      draw.clear();
      isProgrammaticUpdateRef.current = false;
      lastReportedCoordsStr.current = '';
      setValidation(null);
      setActiveFeatureId(null);
      onPolygonChangeRef.current?.(null, null);

      draw.setMode('select');
      setCurrentMode('select');
    } catch (e) {
      console.error('[PolygonMap] handleCancelDraw error:', e);
    }
  };

  const handleDropPresetField = () => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw || !map) return;

    try {
      const center = map.getCenter();
      const coords = createPresetField(center.lng, center.lat, 1.0);
      const feat = createPolygonFeature(coords);

      isProgrammaticUpdateRef.current = true;
      draw.clear();
      draw.addFeatures([feat as never]);
      isProgrammaticUpdateRef.current = false;

      lastReportedCoordsStr.current = JSON.stringify(coords);
      const valResult = validatePolygon(feat);
      setValidation(valResult);
      setActiveFeatureId(feat.id as string);
      onPolygonChangeRef.current?.(valResult, feat);

      if (valResult.bbox) {
        map.fitBounds(valResult.bbox, {
          padding: { top: 60, bottom: 80, left: 60, right: 60 },
          duration: 800,
          essential: true,
        });
      }

      draw.setMode('select');
      setCurrentMode('select');
      try {
        draw.selectFeature(feat.id as string);
      } catch {}
    } catch (e) {
      console.error('[PolygonMap] handleDropPresetField error:', e);
    }
  };

  const handleSelectMode = () => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.setMode('select');
    setCurrentMode('select');
    if (activeFeatureId) {
      try {
        draw.selectFeature(activeFeatureId);
      } catch {}
    }
  };

  const handleClear = () => {
    const draw = drawRef.current;
    if (!draw) return;
    isProgrammaticUpdateRef.current = true;
    draw.clear();
    isProgrammaticUpdateRef.current = false;
    lastReportedCoordsStr.current = '';
    setValidation(null);
    setActiveFeatureId(null);
    onPolygonChangeRef.current?.(null, null);
    draw.setMode('select');
    setCurrentMode('select');
  };

  const handleZoomToField = () => {
    const map = mapRef.current;
    if (!map || !validation?.bbox) return;
    map.fitBounds(validation.bbox, {
      padding: { top: 60, bottom: 80, left: 60, right: 60 },
      duration: 800,
    });
  };

  return (
    <div
      className={cn(
        'polygon-map relative isolate w-full max-w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950',
        className,
      )}
      style={{ height }}
    >
      {/* Keep the planar map mounted so its field boundary survives globe toggles. */}
      <div
        ref={mapContainerRef}
        className={cn('h-full w-full', isGlobe && 'invisible')}
        aria-hidden={isGlobe}
      />

      {isGlobe && (
        <div className="absolute inset-0 z-[5] bg-black" role="region" aria-label={t('Interactive 3D Earth globe')}>
          <HolographicGlobe
            selectedLat={globeTarget?.latitude ?? null}
            selectedLng={globeTarget?.longitude ?? null}
            locationName={globeTarget?.name}
            size="hero"
            autoRotate={!globeTarget}
            enableZoom
          />
        </div>
      )}

      {/* WebGL2 Hardware Acceleration Offline Fallback */}
      {webglError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center backdrop-blur-sm">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300 mb-3 shadow-[0_0_20px_rgba(251,191,36,0.15)]">
            <Globe2 className="size-6 text-amber-400" />
          </div>
          <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-amber-200">
            {t('3D Satellite Imagery Offline')}
          </h3>
          <p className="mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
            {t('WebGL2 graphics acceleration is currently unavailable in this browser session. You can still use the location search, quick jumps, farmer profile form, and full NASA decision engine!')}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3.5 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/20 transition-colors"
            >
              <RotateCcw className="size-3.5 text-amber-400" />
              <span>{t('Retry 3D Satellite Map')}</span>
            </button>
          </div>
          <div className="mt-3 font-mono text-xs text-muted-foreground/60">
            {t('Target Coordinates')}: {Math.abs(latitude).toFixed(4)}° {latitude >= 0 ? 'N' : 'S'},{' '}
            {Math.abs(longitude).toFixed(4)}° {longitude >= 0 ? 'E' : 'W'}
          </div>
        </div>
      )}

      {/* Top Floating Control Bar: Layers & Globe Projection */}
      <div className="absolute right-3 top-3 z-10 flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-black/85 p-1 backdrop-blur-md">
        {!isGlobe && (['satellite', 'streets', 'ndvi'] as MapLayer[]).map((layer) => (
          <button
            key={layer}
            type="button"
            onClick={() => setActiveLayer(layer)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-all',
              activeLayer === layer
                ? 'bg-amber-400 text-black shadow-sm'
                : 'text-white/80 hover:bg-white/10 hover:text-white',
            )}
          >
            {layer === 'ndvi' ? 'NDVI' : t(layer)}
          </button>
        ))}

        <div className="mx-0.5 h-4 w-px bg-white/20" />

        <button
          type="button"
          onClick={() => setIsGlobe((prev) => !prev)}
          title={isGlobe ? 'Switch to 2D Planar Map' : 'Switch to 3D Earth Globe'}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
            isGlobe
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
              : 'text-white/80 hover:bg-white/10 hover:text-white',
          )}
        >
          <Globe2 className="size-3.5" />
          <span className="hidden sm:inline">{isGlobe ? '3D Globe' : '2D Map'}</span>
        </button>
      </div>

      {/* Polygon Drawing Controls */}
      {!isGlobe && showToolbar && enableDrawing && (
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-2 max-w-[calc(100%-1.5rem)]">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-black/85 p-1.5 shadow-lg backdrop-blur-md">
            {currentMode === 'polygon' ? (
              <>
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black shadow-md">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
                  </span>
                  <span>{t('Drawing Boundary...')}</span>
                </div>

                <button
                  type="button"
                  onClick={handleFinishDraw}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-all shadow-sm"
                >
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  <span>{t('Complete Field')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelDraw}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/15 hover:text-white transition-all"
                >
                  <X className="size-3.5" />
                  <span>{t('Cancel')}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStartDraw}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-white/15 transition-all"
                >
                  <Edit3 className="size-3.5 text-amber-400" />
                  <span>{t('Draw Field')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDropPresetField}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-400/20 transition-all"
                  title="Place 1.0 ha square field at center of satellite map"
                >
                  <Square className="size-3.5 text-amber-400" />
                  <span>{t('Preset Field (1 ha)')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSelectMode}
                  disabled={!activeFeatureId}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                    currentMode === 'select' && activeFeatureId
                      ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40'
                      : 'bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none',
                  )}
                >
                  <Maximize2 className="size-3.5" />
                  <span>{t('Edit Vertices')}</span>
                </button>

                {activeFeatureId && (
                  <>
                    <button
                      type="button"
                      onClick={handleZoomToField}
                      title="Zoom to field bounds"
                      className="rounded-lg bg-white/5 p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
                    >
                      <Compass className="size-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      title="Delete field polygon"
                      className="rounded-lg bg-white/5 p-1.5 text-rose-300 hover:bg-rose-500/20 hover:text-rose-200"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Drawing Guidance Hint */}
          {currentMode === 'polygon' && (
            <div className="rounded-xl border border-amber-400/30 bg-black/90 px-3 py-2 text-xs text-amber-200 shadow-xl backdrop-blur-md">
              <span className="font-semibold">{t('Drawing mode active')}:</span>{' '}
              {t('Click satellite map around your field. Click first green point, press Enter, or click "Complete Field" when done.')}
            </div>
          )}
        </div>
      )}

      {/* Validation Warning / Error Banner (floats cleanly below toolbar when boundary edges cross) */}
      {validation && !validation.valid && currentMode !== 'polygon' && validation.error && (
        <div className="absolute top-20 left-3 right-3 sm:right-auto z-20 max-w-md rounded-xl border border-rose-500/40 bg-rose-950/90 p-3 shadow-2xl backdrop-blur-md text-xs text-rose-200 flex items-start gap-2.5">
          <AlertTriangle className="size-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-rose-300">{t('Invalid Field Boundary')}</div>
            <p className="mt-0.5 text-xs text-rose-200/90 leading-relaxed">{validation.error}</p>
          </div>
        </div>
      )}

      {/* Optional Empty State / Bottom Helper */}
      {showBottomHelper && !validation && currentMode !== 'polygon' && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg bg-black/75 px-2.5 py-1.5 text-xs text-white/70 backdrop-blur-sm hidden sm:block">
          {t('Search your location above, then click "Draw Field" or "Preset Field (1 ha)" to outline your farm.')}
        </div>
      )}
    </div>
  );
}

export default PolygonMap;
