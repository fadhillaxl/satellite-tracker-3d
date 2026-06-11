import * as satellite from 'satellite.js';

const satrecCache = new Map<string, satellite.SatRec>();

export function getSatRec(line1: string, line2: string): satellite.SatRec {
  const key = `${line1.trim()}|${line2.trim()}`;
  let satrec = satrecCache.get(key);
  if (!satrec) {
    satrec = satellite.twoline2satrec(line1, line2);
    satrecCache.set(key, satrec);
    // Limit cache size to prevent memory growth if switching satellites
    if (satrecCache.size > 50) {
      const firstKey = satrecCache.keys().next().value;
      if (firstKey) satrecCache.delete(firstKey);
    }
  }
  return satrec;
}

export interface SatellitePosition {
  x: number;
  y: number;
  z: number;
  lat: number;
  lng: number;
  alt: number; // in km
  velocity: number; // in km/s
  timeString: string;
}

export const EARTH_RADIUS_KM = 6378.137;
export const GLOBE_RADIUS_THREE = 5; // Three.js units for the Earth radius

/**
 * Converts Geodetic coordinates (lat/lng in degrees, alt in km) to 3D Cartesian coordinates
 * aligned with standard Three.js sphere wrapping (centered at 0,0,0).
 */
export function latLngAltToVector3(lat: number, lng: number, alt: number): { x: number; y: number; z: number } {
  const phi = ((lng + 180) * Math.PI) / 180;
  const theta = ((90 - lat) * Math.PI) / 180;

  const r = GLOBE_RADIUS_THREE * (1 + alt / EARTH_RADIUS_KM);

  return {
    x: -r * Math.cos(phi) * Math.sin(theta),
    y: r * Math.cos(theta),
    z: r * Math.sin(phi) * Math.sin(theta),
  };
}

/**
 * Propagates TLE for a specific date and returns geodetic and Cartesian coordinates.
 */
export function getSatellitePositionAtTime(
  line1: string,
  line2: string,
  date: Date
): SatellitePosition | null {
  try {
    const satrec = getSatRec(line1, line2);
    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity || !positionAndVelocity.position || !positionAndVelocity.velocity) {
      return null;
    }

    const positionEci = positionAndVelocity.position;
    const velocityEci = positionAndVelocity.velocity;

    if (typeof positionEci === 'boolean' || typeof velocityEci === 'boolean') {
      return null;
    }

    const gmst = satellite.gstime(date);
    const positionGc = satellite.eciToGeodetic(
      positionEci as satellite.EciVec3<number>,
      gmst
    );

    const lat = satellite.degreesLat(positionGc.latitude);
    const lng = satellite.degreesLong(positionGc.longitude);
    const alt = positionGc.height; // altitude in km

    // Velocity in km/s
    const vx = (velocityEci as satellite.EciVec3<number>).x;
    const vy = (velocityEci as satellite.EciVec3<number>).y;
    const vz = (velocityEci as satellite.EciVec3<number>).z;
    const velocity = Math.sqrt(vx * vx + vy * vy + vz * vz);

    // Convert to Three.js Cartesian coordinate system
    const vec = latLngAltToVector3(lat, lng, alt);

    return {
      x: vec.x,
      y: vec.y,
      z: vec.z,
      lat,
      lng,
      alt,
      velocity,
      timeString: date.toLocaleTimeString(),
    };
  } catch (err) {
    console.error('Error propagating satellite position:', err);
    return null;
  }
}

export interface LookAngles {
  azimuth: number;
  elevation: number;
  range: number;
}

/**
 * Calculates Look Angles (Azimuth, Elevation, Range) relative to an observer.
 */
export function getLookAngles(
  line1: string,
  line2: string,
  date: Date,
  observerLat: number,
  observerLng: number,
  observerAltMeters: number
): LookAngles | null {
  try {
    const satrec = getSatRec(line1, line2);
    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity || !positionAndVelocity.position) {
      return null;
    }

    const positionEci = positionAndVelocity.position;
    const gmst = satellite.gstime(date);
    const positionEcf = satellite.eciToEcf(positionEci as satellite.EciVec3<number>, gmst);

    const observerGeodetic = {
      latitude: satellite.degreesToRadians(observerLat),
      longitude: satellite.degreesToRadians(observerLng),
      height: observerAltMeters / 1000 // height in km
    };
    const look = satellite.ecfToLookAngles(observerGeodetic, positionEcf);

    const azimuth = satellite.radiansToDegrees(look.azimuth);
    const elevation = satellite.radiansToDegrees(look.elevation);
    const range = look.rangeSat; // distance in km

    return {
      azimuth,
      elevation,
      range
    };
  } catch (err) {
    console.error('Error calculating look angles:', err);
    return null;
  }
}

export interface SatellitePass {
  aos: Date;
  los: Date;
  maxElevation: number;
  durationMinutes: number;
}

/**
 * Predicts next 3 satellite passes (AOS/LOS/Max El) over the observer's horizon.
 */
export function getUpcomingPasses(
  line1: string,
  line2: string,
  startDate: Date,
  observerLat: number,
  observerLng: number,
  observerAltMeters: number,
  hoursLookahead = 24
): SatellitePass[] {
  const passes: SatellitePass[] = [];
  const limitMs = hoursLookahead * 60 * 60 * 1000;
  const stepMs = 60 * 1000; // 1-minute steps for prediction
  
  let timeMs = startDate.getTime();
  const endTimeMs = timeMs + limitMs;
  
  let inPass = false;
  let currentPassAos: Date | null = null;
  let currentPassMaxEl = -90;

  while (timeMs < endTimeMs) {
    const checkDate = new Date(timeMs);
    const look = getLookAngles(line1, line2, checkDate, observerLat, observerLng, observerAltMeters);
    
    if (look) {
      const el = look.elevation;
      if (el > 0) {
        if (!inPass) {
          inPass = true;
          currentPassAos = checkDate;
          currentPassMaxEl = el;
        } else {
          if (el > currentPassMaxEl) {
            currentPassMaxEl = el;
          }
        }
      } else {
        if (inPass && currentPassAos) {
          inPass = false;
          const durationMinutes = Math.round((timeMs - currentPassAos.getTime()) / 60000);
          passes.push({
            aos: currentPassAos,
            los: checkDate,
            maxElevation: currentPassMaxEl,
            durationMinutes: durationMinutes
          });
          currentPassMaxEl = -90;
          currentPassAos = null;
          
          if (passes.length >= 3) break; // Return next 3 passes
        }
      }
    }
    
    timeMs += stepMs;
  }

  // Handle case where we end the lookahead window while in a pass
  if (inPass && currentPassAos) {
    const durationMinutes = Math.round((endTimeMs - currentPassAos.getTime()) / 60000);
    passes.push({
      aos: currentPassAos,
      los: new Date(endTimeMs),
      maxElevation: currentPassMaxEl,
      durationMinutes: durationMinutes
    });
  }

  return passes;
}


/**
 * If the satellite is currently above the horizon, finds the exact AOS (past) and LOS (future) times.
 */
export interface PassBoundaries {
  aos: Date;
  los: Date;
}

export function getCurrentPassBoundaries(
  line1: string,
  line2: string,
  now: Date,
  observerLat: number,
  observerLng: number,
  observerAltMeters: number
): PassBoundaries | null {
  try {
    const currentLook = getLookAngles(line1, line2, now, observerLat, observerLng, observerAltMeters);
    if (!currentLook || currentLook.elevation <= 0) {
      return null;
    }

    const stepMs = 30 * 1000; // 30-second steps
    const maxSearchMs = 45 * 60 * 1000; // 45 minutes search limit

    // 1. Search backwards to find AOS
    let aos = new Date(now);
    let searchTimeMs = now.getTime();
    while (searchTimeMs > now.getTime() - maxSearchMs) {
      searchTimeMs -= stepMs;
      const checkDate = new Date(searchTimeMs);
      const look = getLookAngles(line1, line2, checkDate, observerLat, observerLng, observerAltMeters);
      if (!look || look.elevation <= 0) {
        aos = new Date(searchTimeMs + stepMs);
        break;
      }
    }

    // 2. Search forwards to find LOS
    let los = new Date(now);
    searchTimeMs = now.getTime();
    while (searchTimeMs < now.getTime() + maxSearchMs) {
      searchTimeMs += stepMs;
      const checkDate = new Date(searchTimeMs);
      const look = getLookAngles(line1, line2, checkDate, observerLat, observerLng, observerAltMeters);
      if (!look || look.elevation <= 0) {
        los = new Date(searchTimeMs - stepMs);
        break;
      }
    }

    return { aos, los };
  } catch (err) {
    console.error('Error calculating current pass boundaries:', err);
    return null;
  }
}

export interface DopplerInfo {
  offsetHz: number;
  dopplerFrequencyHz: number;
  rangeRateKmS: number;
}

/**
 * Calculates Doppler Shift frequency based on relative velocity (range rate).
 * Returns offset (Hz) and compensated frequency (Hz).
 */
export function getDopplerShift(
  line1: string,
  line2: string,
  date: Date,
  observerLat: number,
  observerLng: number,
  observerAltMeters: number,
  nominalFrequencyHz: number
): DopplerInfo | null {
  try {
    const look1 = getLookAngles(line1, line2, date, observerLat, observerLng, observerAltMeters);
    if (!look1) return null;

    const nextSec = new Date(date.getTime() + 1000);
    const look2 = getLookAngles(line1, line2, nextSec, observerLat, observerLng, observerAltMeters);
    if (!look2) return null;

    const rangeRateKmS = look2.range - look1.range; // km/s
    const speedOfLightKmS = 299792.458;

    const offsetHz = -nominalFrequencyHz * (rangeRateKmS / speedOfLightKmS);
    const dopplerFrequencyHz = nominalFrequencyHz + offsetHz;

    return {
      offsetHz,
      dopplerFrequencyHz: Math.round(dopplerFrequencyHz),
      rangeRateKmS
    };
  } catch (err) {
    console.error('Error calculating Doppler shift:', err);
    return null;
  }
}

/**
 * Generates an array of points representing one full orbital period.
 * Useful for drawing the 3D orbital path on the globe.
 */
export function getOrbitPath(
  line1: string,
  line2: string,
  startDate: Date,
  periodMinutes: number,
  numPoints = 120
): { x: number; y: number; z: number; lat: number; lng: number }[] {
  const points: { x: number; y: number; z: number; lat: number; lng: number }[] = [];
  
  if (periodMinutes <= 0) return points;

  const satrec = getSatRec(line1, line2);
  const stepMs = (periodMinutes * 60 * 1000) / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const time = new Date(startDate.getTime() + i * stepMs);
    const positionAndVelocity = satellite.propagate(satrec, time);
    if (positionAndVelocity && positionAndVelocity.position && typeof positionAndVelocity.position === 'object') {
      const positionEci = positionAndVelocity.position;
      const gmst = satellite.gstime(time);
      const positionGc = satellite.eciToGeodetic(
        positionEci as satellite.EciVec3<number>,
        gmst
      );

      const lat = satellite.degreesLat(positionGc.latitude);
      const lng = satellite.degreesLong(positionGc.longitude);
      const alt = positionGc.height;

      const vec = latLngAltToVector3(lat, lng, alt);
      points.push({
        x: vec.x,
        y: vec.y,
        z: vec.z,
        lat,
        lng,
      });
    }
  }

  return points;
}

