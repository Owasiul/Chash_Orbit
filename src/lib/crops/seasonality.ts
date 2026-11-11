import type { CropSpec } from './types';

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Return planting months adjusted for hemisphere. For the Southern Hemisphere
 * (lat < 0), shift each NH month by +6 (wrapping). For year-round crops or
 * Northern Hemisphere, return as-is.
 */
export function getAdjustedPlantingMonths(crop: CropSpec, lat: number): number[] {
  if (crop.season === 'year_round') return crop.plantingMonths;
  if (lat >= 0) return crop.plantingMonths;
  return crop.plantingMonths.map(m => ((m + 5) % 12) + 1);
}

/** Return harvest months adjusted for hemisphere. */
export function getAdjustedHarvestMonths(crop: CropSpec, lat: number): number[] {
  if (crop.season === 'year_round') return crop.harvestMonths;
  if (lat >= 0) return crop.harvestMonths;
  return crop.harvestMonths.map(m => ((m + 5) % 12) + 1);
}

/** Is the current calendar month within ±1 of the crop's planting window? */
export function isCurrentlyPlantable(crop: CropSpec, lat: number, month?: number): boolean {
  const currentMonth = month ?? (new Date().getMonth() + 1);
  const plantingMs = getAdjustedPlantingMonths(crop, lat);

  for (const pm of plantingMs) {
    const dist = Math.min(
      Math.abs(currentMonth - pm),
      12 - Math.abs(currentMonth - pm),
    );
    if (dist <= 1) return true;
  }

  return false;
}

/** Calendar months from typical planting through harvest (hemisphere-adjusted). */
export function getGrowingWindowMonths(crop: CropSpec, lat: number): number[] {
  if (crop.season === 'year_round') {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }

  const plantMonths = getAdjustedPlantingMonths(crop, lat);
  const harvestMonths = getAdjustedHarvestMonths(crop, lat);
  const allMonths = new Set<number>();

  if (plantMonths.length >= 1 && harvestMonths.length >= 1) {
    let m = plantMonths[0]!;
    const end = harvestMonths[harvestMonths.length - 1]!;

    for (let i = 0; i < 12; i++) {
      allMonths.add(m);
      if (m === end) break;
      m = (m % 12) + 1;
    }
  }

  plantMonths.forEach(pm => allMonths.add(pm));
  harvestMonths.forEach(hm => allMonths.add(hm));
  return Array.from(allMonths).sort((a, b) => a - b);
}

/** Is the current calendar month within the crop's growing or planting window? */
export function isInGrowingWindow(crop: CropSpec, lat: number, month?: number): boolean {
  const currentMonth = month ?? (new Date().getMonth() + 1);
  return getGrowingWindowMonths(crop, lat).includes(currentMonth);
}

/** Is the current month within ±1 of the crop's harvest window? */
export function isInHarvestWindow(crop: CropSpec, lat: number, month?: number): boolean {
  if (crop.season === 'year_round') return true;

  const currentMonth = month ?? (new Date().getMonth() + 1);
  const harvestMs = getAdjustedHarvestMonths(crop, lat);

  for (const hm of harvestMs) {
    const dist = Math.min(
      Math.abs(currentMonth - hm),
      12 - Math.abs(currentMonth - hm),
    );
    if (dist <= 1) return true;
  }

  return false;
}

/**
 * Human-readable planting season label, e.g. "Jun–Jul" or "Oct–Nov".
 * Adjusted for hemisphere.
 */
export function getPlantingLabel(crop: CropSpec, lat: number): string {
  const ms = getAdjustedPlantingMonths(crop, lat);
  if (ms.length === 12) return 'Year-round';
  if (ms.length === 0) return 'Unknown';

  const first = MONTH_ABBR[ms[0] - 1];
  const last = MONTH_ABBR[ms[ms.length - 1] - 1];
  return first === last ? first : `${first}–${last}`;
}

/** Human-readable harvest season label. */
export function getHarvestLabel(crop: CropSpec, lat: number): string {
  const ms = getAdjustedHarvestMonths(crop, lat);
  if (ms.length === 12) return 'Year-round';
  if (ms.length === 0) return 'Unknown';

  const first = MONTH_ABBR[ms[0] - 1];
  const last = MONTH_ABBR[ms[ms.length - 1] - 1];
  return first === last ? first : `${first}–${last}`;
}

/**
 * Returns the number of months until the next planting window. 0 means
 * the crop is plantable right now.
 */
export function monthsUntilPlanting(crop: CropSpec, lat: number, month?: number): number {
  const currentMonth = month ?? (new Date().getMonth() + 1);
  const plantMonths = getAdjustedPlantingMonths(crop, lat);

  if (plantMonths.length === 12) return 0;

  let minDist = 12;
  for (const pm of plantMonths) {
    const dist = pm >= currentMonth ? pm - currentMonth : 12 - currentMonth + pm;
    if (dist < minDist) minDist = dist;
  }

  return minDist;
}
