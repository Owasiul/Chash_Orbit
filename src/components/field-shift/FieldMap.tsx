"use client";

import * as React from 'react';
import { PolygonMap, type PolygonMapProps } from './PolygonMap';
import type { PolygonValidationResult } from '@/lib/polygon';

export interface FieldMapProps extends Omit<PolygonMapProps, 'onLocationSelect'> {
  onPick?: (point: { latitude: number; longitude: number }) => void;
  onPolygonChange?: (result: PolygonValidationResult | null, feature: any) => void;
}

/**
 * FieldMap component upgraded to high-resolution Google Earth-like satellite imagery
 * with 3D globe projection, interactive polygon drawing, vertex editing, and live Turf area validation.
 */
export default function FieldMap({
  latitude = 15,
  longitude = 15,
  zoom = 1.0,
  onPick,
  onPolygonChange,
  height = 'clamp(280px, 55dvh, 480px)',
  className,
  enableDrawing = true,
  showToolbar = true,
  initialPolygon,
  showBottomHelper = false,
}: FieldMapProps) {
  return (
    <PolygonMap
      latitude={latitude}
      longitude={longitude}
      zoom={zoom}
      height={height}
      className={className}
      enableDrawing={enableDrawing}
      showToolbar={showToolbar}
      initialPolygon={initialPolygon}
      onPolygonChange={onPolygonChange}
      onLocationSelect={onPick}
      showBottomHelper={showBottomHelper}
    />
  );
}

export { PolygonMap };
