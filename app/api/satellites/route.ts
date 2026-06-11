import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface SatelliteDataShort {
  n: string; // name
  i: string; // id
  1: string; // line 1
  2: string; // line 2
}

const CACHE_FILE = path.join(process.cwd(), 'active-satellites-cache.json');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours cache validity

// Parse standard 3-line TLE text
function parseTleText(text: string): SatelliteDataShort[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  const satellites: SatelliteDataShort[] = [];

  for (let i = 0; i < lines.length - 2; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (line1.startsWith('1 ') && line2.startsWith('2 ')) {
      const id = line1.substring(2, 7).trim();
      satellites.push({
        n: name,
        i: id,
        1: line1,
        2: line2,
      });
    } else {
      // If alignment is off, scan line-by-line
      i -= 2;
    }
  }
  return satellites;
}

const LOCAL_TLE_FILE = path.join(process.cwd(), 'active.txt');

export async function GET() {
  let cachedData: SatelliteDataShort[] | null = null;
  let cacheValid = false;

  // 0. Try to read from a local raw TLE file (active.txt) placed in the project root
  try {
    if (fs.existsSync(LOCAL_TLE_FILE)) {
      console.log('Found local active.txt raw TLE file. Parsing and caching...');
      const rawText = fs.readFileSync(LOCAL_TLE_FILE, 'utf-8');
      const satellites = parseTleText(rawText);
      if (satellites.length > 0) {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(satellites), 'utf-8');
        console.log(`Successfully parsed and cached ${satellites.length} satellites from local active.txt`);
        return NextResponse.json(satellites);
      }
    }
  } catch (err) {
    console.error('Error reading local active.txt raw TLE file:', err);
  }

  // 1. Try to read from local filesystem cache
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const stats = fs.statSync(CACHE_FILE);
      const fileContent = fs.readFileSync(CACHE_FILE, 'utf-8');
      cachedData = JSON.parse(fileContent);

      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs < CACHE_TTL_MS && cachedData && cachedData.length > 0) {
        cacheValid = true;
      }
    }
  } catch (err) {
    console.error('Error reading filesystem cache:', err);
  }

  // If cache is valid, serve it immediately
  if (cacheValid && cachedData) {
    console.log('Serving valid active satellites from filesystem cache');
    return NextResponse.json(cachedData);
  }

  // 2. Cache is expired or missing: fetch active group from Celestrak
  let satellites: SatelliteDataShort[] = [];
  try {
    console.log('Cache expired or missing. Fetching active group from Celestrak...');
    const url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle';
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SatelliteTracker3DClone/1.0',
      },
    });

    if (response.ok) {
      const text = await response.text();
      satellites = parseTleText(text);
    } else {
      console.warn(`Celestrak active group query returned HTTP ${response.status}`);
    }
  } catch (err) {
    console.error('Error fetching active group from Celestrak:', err);
  }

  // If we parsed valid active satellites, save to cache and return
  if (satellites.length > 0) {
    try {
      fs.writeFileSync(CACHE_FILE, JSON.stringify(satellites), 'utf-8');
      console.log(`Saved ${satellites.length} active satellites to cache file`);
    } catch (fsErr) {
      console.error('Failed to write cache file:', fsErr);
    }
    return NextResponse.json(satellites);
  }

  console.warn('Celestrak active group fetch failed or returned rate limit warning. Trying fallbacks...');
  
  // Serve stale cache if available
  if (cachedData && cachedData.length > 0) {
    console.log('Serving stale cache as rate limit fallback');
    return NextResponse.json(cachedData);
  }

  // 3. Cache doesn't exist and active is rate-limited: fetch starlink group instead
  try {
    console.log('No cache file exists. Attempting live fallback: fetching starlink group...');
    const starlinkUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle';
    const starlinkResponse = await fetch(starlinkUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SatelliteTracker3DClone/1.0',
      },
    });

    if (starlinkResponse.ok) {
      const starlinkText = await starlinkResponse.text();
      const starlinkSats = parseTleText(starlinkText);

      if (starlinkSats.length > 0) {
        try {
          fs.writeFileSync(CACHE_FILE, JSON.stringify(starlinkSats), 'utf-8');
          console.log(`Saved ${starlinkSats.length} Starlink satellites to cache file as fallback`);
        } catch (fsErr) {
          console.error('Failed to write fallback cache file:', fsErr);
        }
        return NextResponse.json(starlinkSats);
      }
    } else {
      console.warn(`Celestrak Starlink group query returned HTTP ${starlinkResponse.status}`);
    }
  } catch (err) {
    console.error('Error fetching Starlink group fallback:', err);
  }

  // 4. If Starlink also fails, try visual (brightest) group
  try {
    console.log('Starlink fallback failed. Attempting final fallback: fetching visual group...');
    const visualUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle';
    const visualResponse = await fetch(visualUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SatelliteTracker3DClone/1.0',
      },
    });

    if (visualResponse.ok) {
      const visualText = await visualResponse.text();
      const visualSats = parseTleText(visualText);

      if (visualSats.length > 0) {
        return NextResponse.json(visualSats);
      }
    } else {
      console.warn(`Celestrak Visual group query returned HTTP ${visualResponse.status}`);
    }
  } catch (err) {
    console.error('Error fetching Visual group fallback:', err);
  }

  // 5. Final attempt: stations (space stations)
  try {
    console.log('Visual fallback failed. Attempting final option: fetching stations group...');
    const stationsUrl = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle';
    const stationsResponse = await fetch(stationsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SatelliteTracker3DClone/1.0',
      },
    });

    if (stationsResponse.ok) {
      const stationsText = await stationsResponse.text();
      const stationsSats = parseTleText(stationsText);

      if (stationsSats.length > 0) {
        return NextResponse.json(stationsSats);
      }
    }
  } catch (err) {
    console.error('Error fetching Stations group fallback:', err);
  }

  return NextResponse.json(
    { error: 'All Celestrak queries and fallbacks failed' },
    { status: 502 }
  );
}
