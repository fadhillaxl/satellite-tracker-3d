import { NextResponse } from 'next/server';

// In-memory cache for Celestrak responses to protect their servers (rate limiting)
interface CacheEntry {
  data: {
    name: string;
    line1: string;
    line2: string;
    noradId: string;
    intlDes: string;
    epochYear: number;
    epochDay: number;
    inclination: number;
    eccentricity: number;
    meanMotion: number;
    periodMinutes: number;
    launchYear: number;
  };
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours cache TTL

function parseTLE(lines: string[]) {
  const name = lines[0].trim();
  const line1 = lines[1].trim();
  const line2 = lines[2].trim();

  // Extract catalog number
  const noradId = line1.substring(2, 7).trim();

  // Extract international designator (cols 10-17 of line 1)
  const intlDes = line1.substring(9, 17).trim();
  const launchYearRaw = parseInt(line1.substring(9, 11).trim(), 10);
  const launchYear = launchYearRaw < 57 ? 2000 + launchYearRaw : 1900 + launchYearRaw;

  // Extract epoch info
  const epochYearRaw = parseInt(line1.substring(18, 20).trim(), 10);
  const epochYear = epochYearRaw < 57 ? 2000 + epochYearRaw : 1900 + epochYearRaw;
  const epochDay = parseFloat(line1.substring(20, 32).trim());

  // Extract orbital elements from Line 2
  const inclination = parseFloat(line2.substring(8, 16).trim());
  const eccentricity = parseFloat('0.' + line2.substring(26, 33).trim());
  const meanMotion = parseFloat(line2.substring(52, 63).trim()); // revs per day
  
  // Calculate period in minutes: 1440 / meanMotion
  const periodMinutes = meanMotion > 0 ? 1440 / meanMotion : 0;

  return {
    name,
    line1,
    line2,
    noradId,
    intlDes,
    epochYear,
    epochDay,
    inclination,
    eccentricity,
    meanMotion,
    periodMinutes,
    launchYear,
  };
}

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

    const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${id}&FORMAT=TLE`;
    const response = await fetch(url, {
      next: { revalidate: 7200 }, // also cache at Next.js fetch layer (2 hours)
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SatelliteTracker3DClone/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Celestrak returned status ${response.status}` },
        { status: 502 }
      );
    }

    const text = await response.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

    if (lines.length < 3) {
      return NextResponse.json(
        { error: 'Satellite not found or invalid TLE returned from Celestrak' },
        { status: 404 }
      );
    }

    const parsedData = parseTLE(lines);
    
    // Store in cache
    cache.set(id, {
      data: parsedData,
      timestamp: Date.now(),
    });

    return NextResponse.json(parsedData);
  } catch (error: unknown) {
    console.error('Error fetching satellite details:', error);
    const errMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errMsg },
      { status: 500 }
    );
  }
}
