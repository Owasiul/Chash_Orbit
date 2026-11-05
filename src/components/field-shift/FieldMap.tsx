"use client";

import * as React from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from '@/lib/locale';

export type MapLayer = 'streets' | 'satellite' | 'ndvi';

const tiles: Record<MapLayer, { url: string; attribution: string; maxNativeZoom?: number; maxZoom?: number }> = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19,
  },
  ndvi: {
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
    attribution: 'NASA EOSDIS GIBS',
    maxNativeZoom: 9, // Native MODIS resolution ends at zoom 9
    maxZoom: 19,       // Leaflet will scale/stretch tiles when zoomed in
  },
};

function PinPicker({ onPick }: { onPick?: (point: { latitude: number; longitude: number }) => void }) {
  useMapEvents({
    click(e) {
      onPick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

/** Automatically re-centers the map when latitude/longitude/zoom props change */
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center[0], center[1], zoom]);
  return null;
}

/** Keeps Leaflet in sync with container resizes & fixes initial render glitches */
function ResizeHandler() {
  const map = useMap();
  React.useEffect(() => {
    // Invalidate immediately and after a short tick to prevent gray/unrendered tiles
    map.invalidateSize();
    const timeout = setTimeout(() => map.invalidateSize(), 150);

    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

export default function FieldMap({
  latitude = 24.3745,
  longitude = 88.6042,
  zoom = 16, // Zoom 16-17 shows individual plots, roads, and buildings
  onPick,
  height = 'clamp(280px, 55dvh, 480px)',
  className,
}: {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  onPick?: (point: { latitude: number; longitude: number }) => void;
  height?: number | string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [layer, setLayer] = React.useState<MapLayer>('streets');
  const point: [number, number] = React.useMemo(() => [latitude, longitude], [latitude, longitude]);
  const tile = tiles[layer];

  // MODIS Terra NDVI 8-day composite
  const ndviDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tileUrl = layer === 'ndvi' ? tile.url.replace('{time}', ndviDate) : tile.url;

  const markerIcon = React.useMemo(
    () =>
      L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:#f59e0b;box-shadow:0 1px 8px #000"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    []
  );

  return (
    <div
      className={`field-map relative isolate w-full max-w-full overflow-hidden rounded-2xl border border-white/10 ${className ?? ''}`}
      style={{ height }}
    >
      {/* Layer switcher */}
      <div className="absolute right-2 top-2 z-[1000] flex max-w-[calc(100%-4rem)] gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/80 p-1 sm:right-3 sm:top-3 sm:max-w-[calc(100%-5rem)]">
        {(['streets', 'satellite', 'ndvi'] as MapLayer[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={layer === value}
            onClick={() => setLayer(value)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-2 text-[11px] capitalize sm:px-3 sm:py-1.5 sm:text-xs ${
              layer === value ? 'bg-amber-300 text-black' : 'text-white'
            }`}
          >
            {t(value === 'ndvi' ? 'Vegetation' : value)}
          </button>
        ))}
      </div>

      <MapContainer center={point} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer
          key={layer}
          url={tileUrl}
          attribution={tile.attribution}
          maxZoom={tile.maxZoom ?? 19}
          maxNativeZoom={tile.maxNativeZoom}
        />
        <Marker position={point} icon={markerIcon} />
        <PinPicker onPick={onPick} />
        <MapController center={point} zoom={zoom} />
        <ResizeHandler />
      </MapContainer>

      {onPick && (
        <div className="pointer-events-none absolute bottom-9 left-2 z-[1000] max-w-[calc(100%-1rem)] truncate rounded bg-black/75 px-2 py-1 text-[10px] text-white sm:bottom-2 sm:max-w-[50%]">
          {t('Click map to place field pin')}
          <span className="hidden lg:inline"> · {tile.attribution.replace(/<[^>]*>/g, '')}</span>
        </div>
      )}
    </div>
  );
}

export { L };