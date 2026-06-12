import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface SatNogsTransmitter {
  uuid: string;
  norad_cat_id?: number;
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

// ── Filesystem cache (survives server restarts) ────────────────────────────────
const CACHE_DIR = path.join(os.tmpdir(), 'sat-freq-cache');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_RESULTS = 200; // cap payload size; virtual scroller handles big lists

function getCachePath(id: string) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  return path.join(CACHE_DIR, `${id}.json`);
}

function readFsCache(id: string): SatelliteFrequency[] | null {
  try {
    const p = getCachePath(id);
    if (!fs.existsSync(p)) return null;
    const { timestamp, data } = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Date.now() - timestamp > CACHE_TTL_MS) return null;
    return data as SatelliteFrequency[];
  } catch {
    return null;
  }
}

function writeFsCache(id: string, data: SatelliteFrequency[]) {
  try {
    fs.writeFileSync(getCachePath(id), JSON.stringify({ timestamp: Date.now(), data }));
  } catch { /* non-fatal */ }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Invalid NORAD ID' }, { status: 400 });
    }

    // 1. Return filesystem-cached result if still fresh
    const cached = readFsCache(id);
    if (cached) {
      return NextResponse.json(cached);
    }

    // 2. Fetch from SatNOGS and filter by norad_cat_id ourselves.
    //    Their API ignores the filter param and returns everything (~4.5 MB).
    //    We deliberately skip Next.js fetch cache — it rejects responses > 2 MB.
    const satnogsUrl = `https://db.satnogs.org/api/transmitters/?format=json&active=true`;

    const response = await fetch(satnogsUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'SatelliteTracker3D/1.0 (Ham Radio Integration)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`SatNOGS API returned ${response.status} for NORAD ID ${id}`);
      return NextResponse.json([]);
    }

    const noradNum = Number(id);
    const raw = (await response.json()) as SatNogsTransmitter[];

    // 3. Strict filter + shape for UI
    const transmitters: SatelliteFrequency[] = raw
      .filter((t) => t.norad_cat_id === noradNum && (t.downlink_low || t.downlink_high))
      .map((t) => ({
        uuid: t.uuid,
        description: t.description || 'Unknown Transmitter',
        frequency: (t.downlink_low ?? t.downlink_high)!,
        uplink: t.uplink_low ?? t.uplink_high ?? null,
        mode: t.mode || 'FM',
        baud: t.baud ?? null,
        service: t.service || 'data',
        alive: !!t.alive,
      }))
      .sort((a, b) => a.frequency - b.frequency)
      .slice(0, MAX_RESULTS);

    // 4. Persist to filesystem cache for next request / server restart
    writeFsCache(id, transmitters);

    return NextResponse.json(transmitters);

  } catch (error: unknown) {
    console.error('Error fetching SatNOGS frequencies:', error);
    return NextResponse.json([]);
  }
}
