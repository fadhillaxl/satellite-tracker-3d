import { NextResponse } from 'next/server';

interface SatNogsTransmitter {
  uuid: string;
  description?: string;
  downlink_low?: number;
  downlink_high?: number;
  uplink_low?: number;
  uplink_high?: number;
  mode?: string;
  baud?: number;
  service?: string;
  alive?: boolean;
}

interface SatelliteFrequency {
  uuid: string;
  description: string;
  frequency: number;
  uplink: number | null;
  mode: string;
  baud: number | null;
  service: string;
  alive: boolean;
}

// Server-side cache for SatNOGS frequency responses
interface CacheEntry {
  data: SatelliteFrequency[];
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours cache TTL since frequencies are stable

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Invalid NORAD ID' }, { status: 400 });
    }

    const cached = cache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }

    const satnogsUrl = `https://db.satnogs.org/api/transmitters/?norad_cat_id=${id}&active=true`;
    
    const response = await fetch(satnogsUrl, {
      next: { revalidate: 21600 }, // Cache at Next.js layer for 6 hours
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SatelliteTracker3D/1.0 (Ham Radio Integration)',
      },
    });

    if (!response.ok) {
      // Return empty array instead of failing, to let the application run with fallback frequency input
      console.warn(`SatNOGS API returned status ${response.status} for NORAD ID ${id}`);
      return NextResponse.json([]);
    }

    const data = (await response.json()) as SatNogsTransmitter[];
    
    // Parse and clean up data for UI consumption
    const transmitters = data.map((t) => ({
      uuid: t.uuid,
      description: t.description || 'Unknown Transmitter',
      frequency: t.downlink_low || t.downlink_high || null,
      uplink: t.uplink_low || t.uplink_high || null,
      mode: t.mode || 'FM',
      baud: t.baud || null,
      service: t.service || 'data',
      alive: !!t.alive,
    })).filter((t): t is Omit<typeof t, 'frequency'> & { frequency: number } => t.frequency !== null); // Filter out transmitters without downlink frequencies

    // Sort by frequency (lowest to highest)
    transmitters.sort((a, b) => a.frequency - b.frequency);

    // Save to cache
    cache.set(id, {
      data: transmitters,
      timestamp: Date.now(),
    });

    return NextResponse.json(transmitters);
  } catch (error: unknown) {
    console.error('Error fetching SatNOGS frequencies:', error);
    // Return empty list on network error to allow manual inputs on client
    return NextResponse.json([]);
  }
}
