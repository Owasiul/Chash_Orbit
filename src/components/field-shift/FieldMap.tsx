"use client";

import * as React from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from '@/lib/locale';

export type MapLayer = 'streets' | 'satellite' | 'ndvi';

const tiles: Record<MapLayer, { url: string; attribution: string; opacity?: number }> = {
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
  },
  ndvi: {
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png',
    attribution: 'NASA EOSDIS GIBS',
  },
};

function PinPicker({ onPick }: { onPick?: (point: { latitude: number; longitude: number }) => void }) {
  useMapEvents({ click(e) { onPick?.({ latitude: e.latlng.lat, longitude: e.latlng.lng }); } });
  return null;
}

/** Keeps Leaflet in sync whenever its container changes size
 *  (orientation change, window resize, sidebar toggle, etc.). */
function ResizeHandler() {
  const map = useMap();
  React.useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** Client-only Leaflet map. Click anywhere to place the field pin. */
export default function FieldMap({
  latitude = 24.3745,
  longitude = 88.6042,
  onPick,
  height = 'clamp(280px, 55dvh, 480px)',
  className,
}: {
  latitude?: number;
  longitude?: number;
  onPick?: (point: { latitude: number; longitude: number }) => void;
  height?: number | string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [layer, setLayer] = React.useState<MapLayer>('streets');
  const point: [number, number] = [latitude, longitude];
  const tile = tiles[layer];
  // MODIS Terra NDVI is an 8-day composite; use a conservative recent date
  // rather than requesting today's not-yet-published composite.
  const ndviDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tileUrl = layer === 'ndvi' ? tile.url.replace('{time}', ndviDate) : tile.url;
  const markerIcon = React.useMemo(() => L.divIcon({
    className: '',
    html: '<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:#f59e0b;box-shadow:0 1px 8px #000"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  }), []);

  return (
    <div
      className={`field-map relative isolate w-full max-w-full overflow-hidden rounded-2xl border border-white/10 ${className ?? ''}`}
      style={{ height }}
    >
      {/* Layer switcher */}
      <div className="absolute right-2 top-2 z-[1000] flex max-w-[calc(100%-4rem)] gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/80 p-1 sm:right-3 sm:top-3 sm:max-w-[calc(100%-5rem)]">
        {(['streets', 'satellite', 'ndvi'] as MapLayer[]).map(value => (
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

      <MapContainer center={point} zoom={11} scrollWheelZoom className="h-full w-full">
        <TileLayer
          key={layer}
          url={tileUrl}
          attribution={tile.attribution}
          maxNativeZoom={layer === 'ndvi' ? 9 : undefined}
        />
        <Marker position={point} icon={markerIcon} />
        <PinPicker onPick={onPick} />
        <ResizeHandler />
      </MapContainer>

      {/* Hint */}
      <div className="pointer-events-none absolute bottom-9 left-2 z-[1000] max-w-[calc(100%-1rem)] truncate rounded bg-black/75 px-2 py-1 text-[10px] text-white sm:bottom-2 sm:max-w-[50%]">
        {t('Click map to place field pin')}
        <span className="hidden lg:inline"> · {tile.attribution.replace(/<[^>]*>/g, '')}</span>
      </div>
    </div>
  );
}

export { L };