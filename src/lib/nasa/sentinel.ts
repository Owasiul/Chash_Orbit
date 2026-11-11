// Chash Orbit — Sentinel-2 L2A STAC Service
// STRETCH: Queries Microsoft Planetary Computer STAC for 10 m Sentinel-2 L2A
// multispectral satellite acquisition reference. Non-blocking with 3.5s timeout.

export interface Sentinel2SceneInfo {
  sceneId: string;
  datetime: string;
  cloudCoverPct: number;
}

/**
 * Searches for the most recent low-cloud Sentinel-2 L2A scene covering the bbox.
 * Returns null if unreachable or times out without throwing.
 */
export async function fetchLatestSentinel2Scene(
  bbox: [number, number, number, number],
  timeoutMs = 3500,
): Promise<Sentinel2SceneInfo | null> {
  try {
    const res = await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collections: ['sentinel-2-l2a'],
        bbox,
        limit: 1,
        query: {
          'eo:cloud_cover': { lt: 50 },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{
        id: string;
        properties?: {
          datetime?: string;
          'eo:cloud_cover'?: number;
        };
      }>;
    };

    const feat = data?.features?.[0];
    if (!feat || !feat.id) return null;

    return {
      sceneId: feat.id,
      datetime: feat.properties?.datetime || new Date().toISOString(),
      cloudCoverPct: Math.round((feat.properties?.['eo:cloud_cover'] ?? 0) * 10) / 10,
    };
  } catch {
    return null;
  }
}
