// Land/water check using Natural Earth 1:50m land and lake outlines (public domain).
// It catches oceans, seas and large lakes. Rivers and small ponds are too narrow
// for this resolution and are caught by the NDVI check instead.
import mask from '@/data/water-mask.json';

type Poly = { b: [number, number, number, number]; r: number[][][] };
const land = mask.land as unknown as Poly[];
const lakes = mask.lakes as unknown as Poly[];

function inRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolys(lng: number, lat: number, polys: Poly[]): boolean {
  for (const p of polys) {
    const [x0, y0, x1, y1] = p.b;
    if (lng < x0 || lng > x1 || lat < y0 || lat > y1) continue;
    if (!inRing(lng, lat, p.r[0])) continue;
    let hole = false;
    for (let k = 1; k < p.r.length; k++) if (inRing(lng, lat, p.r[k])) { hole = true; break; }
    if (!hole) return true;
  }
  return false;
}

export type SurfaceKind = 'land' | 'sea' | 'lake';

function rawSurface(lat: number, lng: number): SurfaceKind {
  if (inPolys(lng, lat, lakes)) return 'lake';
  // Antarctica's southern edge is outside the land polygons' latitude range; treat as land.
  if (lat < -85) return 'land';
  return inPolys(lng, lat, land) ? 'land' : 'sea';
}

/**
 * The outlines are accurate to a few km, so a point only counts as water when
 * the points around it (about 5 km sea, 2 km lake) are water too. This keeps
 * coastal and lakeside farms from being rejected.
 */
export function surfaceAt(lat: number, lng: number): SurfaceKind {
  const centre = rawSurface(lat, lng);
  if (centre === 'land') return 'land';
  const step = centre === 'sea' ? 0.05 : 0.02;
  for (const dy of [-step, 0, step]) {
    for (const dx of [-step, 0, step]) {
      if (rawSurface(lat + dy, lng + dx) === 'land') return 'land';
    }
  }
  return centre;
}
