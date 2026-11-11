// src/lib/crops/normalize.ts
// Light-weight typo tolerance for crop names (e.g. "sugercane" -> "sugarcane").
// No external dependencies. Safe to use on both server and client.

/**
 * Common misspellings and local (Bangla) names -> canonical English crop name.
 * Keys must be lowercase. Extend this list as you see new typos in your logs.
 */
const KNOWN_MISSPELLINGS: Record<string, string> = {
  // misspellings
  sugercane: 'sugarcane',
  sugarcan: 'sugarcane',
  suger: 'sugarcane',
  'sugar cane': 'sugarcane',
  whaet: 'wheat',
  mazie: 'maize',
  potatoe: 'potato',
  tomatoe: 'tomato',
  lentel: 'lentil',
  mustred: 'mustard',
  // Bangla names
  'আখ': 'sugarcane',
  'ধান': 'rice',
  'গম': 'wheat',
  'পাট': 'jute',
  'ভুট্টা': 'maize',
  'আলু': 'potato',
  'টমেটো': 'tomato',
  'সরিষা': 'mustard',
  'মসুর': 'lentil',
  'বেগুন': 'brinjal',
  'পেঁয়াজ': 'onion',
};

/** Trim, collapse spaces, normalise unicode, and apply the known-misspelling map. */
export function correctCropSpelling(input: string): string {
  const cleaned = input.normalize('NFC').trim().replace(/\s+/g, ' ');
  return KNOWN_MISSPELLINGS[cleaned.toLowerCase()] ?? cleaned;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Returns the closest candidate to `input`, or null if nothing is close enough.
 * Conservative on purpose, so a genuinely new crop is not "corrected" into a wrong one:
 *  - names up to 4 chars: no fuzzy matching
 *  - 5-7 chars: max 1 edit
 *  - 8+ chars: max 2 edits
 *  - first letter must match
 */
export function findClosestName(
  input: string,
  candidates: readonly string[],
): string | null {
  const q = input.trim().toLowerCase();
  const maxDistance = q.length >= 8 ? 2 : q.length >= 5 ? 1 : 0;
  if (maxDistance === 0) return null;

  let best: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const candidate of candidates) {
    const c = candidate.trim().toLowerCase();
    if (!c || c[0] !== q[0]) continue;
    if (Math.abs(c.length - q.length) > maxDistance) continue;

    const d = levenshtein(q, c);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }

  return best;
}