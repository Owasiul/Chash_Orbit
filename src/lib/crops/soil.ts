import type { SoilType } from './types';

/**
 * Infer a default soil type from regional / climatic signals when farmer
 * doesn't know it. This is a derived estimate, never claimed as NASA data.
 */
export function inferSoilType(lat: number, _lng: number): SoilType {
  const absLat = Math.abs(lat);

  if (absLat < 23) return 'clay';
  if (absLat < 30) return 'loamy';
  return 'sandy';
}
