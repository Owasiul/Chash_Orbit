"use client";

import * as React from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

/** Client-only Leaflet map. Click anywhere to place the field pin. */
export default function FieldMap({
  latitude = 24.3745,
  longitude = 88.6042,
  onPick,
  height = 360,
  className,
}: {
  latitude?: number;
  longitude?: number;
  onPick?: (point: { latitude: number; longitude: number }) => void;
  height?: number | string;
  className?: string;
}) {
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
  return <div className={`relative overflow-hidden rounded-2xl border border-white/10 ${className ?? ''}`} style={{ height }}>
    <div className="absolute right-3 top-3 z-[1000] flex gap-1 rounded-xl border border-white/10 bg-black/80 p-1">
      {(['streets', 'satellite', 'ndvi'] as MapLayer[]).map(value => <button key={value} onClick={() => setLayer(value)} className={`rounded-lg px-3 py-1.5 text-xs capitalize ${layer === value ? 'bg-amber-300 text-black' : 'text-white'}`}>{value === 'ndvi' ? 'Vegetation' : value}</button>)}
    </div>
    <MapContainer center={point} zoom={11} scrollWheelZoom className="h-full w-full">
      <TileLayer key={layer} url={tileUrl} attribution={tile.attribution} />
      <Marker position={point} icon={markerIcon} />
      <PinPicker onPick={onPick} />
    </MapContainer>
    <div className="absolute bottom-2 left-2 z-[1000] rounded bg-black/75 px-2 py-1 text-[10px] text-white">Click map to place field pin · {tile.attribution.replace(/<[^>]*>/g, '')}</div>
  </div>;
}

export { L };
