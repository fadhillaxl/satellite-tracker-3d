/**
 * Walker Constellation Orbital Mechanics
 * Pure TypeScript — no DOM dependencies.
 * Extracted from palatine-space/static/js/orbit.js
 */

export interface OrbitParams {
  satellites: number;
  orbital_planes: number;
  beam_size: number;
  inclination: number; // degrees
}

export interface SatellitePosition {
  lat: number;  // degrees
  lon: number;  // degrees
  latRad: number;
  lonRad: number;
  /** Unit vector components for fast dot-product ISL checks */
  px: number;
  py: number;
  pz: number;
  isAscending: boolean;
  planeIdx: number;
  satIdx: number;
}

export interface MapParams {
  mapWidth: number;
  mapHeight: number;
  mapOffsetX: number;
  mapOffsetY: number;
}

export interface Vec2 { x: number; y: number }

// Earth radius constant (km)
export const EARTH_RADIUS_KM = 6371;

// Default LEO orbit altitude (km) – Starlink shell 1
export const DEFAULT_ALTITUDE_KM = 550;

// ─── Orbital Mechanics ──────────────────────────────────────────────────────

/**
 * Compute the Cartesian lat/lon position of a satellite in a Walker Delta
 * constellation at a given simulation time offset (radians).
 */
export function getSatellitePosition(
  satIndex: number,
  totalSats: number,
  numPlanes: number,
  inclinationDeg: number,
  timeOffset: number,
): SatellitePosition {
  const inclination = (inclinationDeg * Math.PI) / 180;
  const satsPerPlane = Math.ceil(totalSats / numPlanes);
  const planeIdx = satIndex % numPlanes;
  const satIdxInPlane = Math.floor(satIndex / numPlanes);

  // Right Ascension of Ascending Node
  const raan = (planeIdx / numPlanes) * 2 * Math.PI;

  // Mean anomaly with plane phase offset
  let anomaly = (satIdxInPlane / satsPerPlane) * 2 * Math.PI;
  anomaly += planeIdx * 0.5; // phase offset between planes
  anomaly += timeOffset;

  // Lat/Lon from inclination + anomaly
  const sinLat = Math.sin(inclination) * Math.sin(anomaly);
  const latRad = Math.asin(Math.max(-1, Math.min(1, sinLat)));

  const y = Math.cos(inclination) * Math.sin(anomaly);
  const x = Math.cos(anomaly);
  const lonRad = Math.atan2(y, x) + raan;

  let lonDeg = (lonRad * 180) / Math.PI;
  const latDeg = (latRad * 180) / Math.PI;

  // Normalize longitude to [-180, 180]
  lonDeg = ((lonDeg + 180) % 360 + 360) % 360 - 180;

  // Unit vector on unit sphere (for ISL dot-product checks)
  const px = Math.cos(latRad) * Math.cos(lonRad);
  const py = Math.cos(latRad) * Math.sin(lonRad);
  const pz = Math.sin(latRad);

  const isAscending = Math.cos(anomaly) > 0;

  return { lat: latDeg, lon: lonDeg, latRad, lonRad, px, py, pz, isAscending, planeIdx, satIdx: satIndex };
}

/**
 * Build the full satellite position array for a constellation at `timeOffset`.
 */
export function buildConstellationPositions(
  params: OrbitParams,
  timeOffset: number,
): SatellitePosition[] {
  const positions: SatellitePosition[] = [];
  const { satellites, orbital_planes, inclination } = params;
  for (let i = 0; i < satellites; i++) {
    positions.push(getSatellitePosition(i, satellites, orbital_planes, inclination, timeOffset));
  }
  return positions;
}

// ─── 2D Mercator Projection ──────────────────────────────────────────────────

/**
 * Map lat/lon (degrees) to canvas pixel coordinates within the 2:1 map area.
 */
export function latLonToXY(lat: number, lon: number, map: MapParams): Vec2 {
  return {
    x: map.mapOffsetX + ((lon + 180) / 360) * map.mapWidth,
    y: map.mapOffsetY + ((90 - lat) / 180) * map.mapHeight,
  };
}

/**
 * Compute map layout given container width/height (maintains 2:1 aspect ratio).
 */
export function computeMapParams(containerWidth: number, containerHeight: number): MapParams {
  const targetAspect = 2.0;
  const containerAspect = containerWidth / containerHeight;
  let mapWidth: number, mapHeight: number;

  if (containerAspect > targetAspect) {
    mapHeight = containerHeight;
    mapWidth = containerHeight * targetAspect;
  } else {
    mapWidth = containerWidth;
    mapHeight = containerWidth / targetAspect;
  }

  return {
    mapWidth,
    mapHeight,
    mapOffsetX: (containerWidth - mapWidth) / 2,
    mapOffsetY: (containerHeight - mapHeight) / 2,
  };
}

// ─── 3D Spherical Coordinates ────────────────────────────────────────────────

/**
 * Convert lat/lon (degrees) to a 3D point on a sphere of given radius.
 * Returns { x, y, z } in Three.js coordinate convention.
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number,
): { x: number; y: number; z: number } {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: -(radius * Math.sin(phi) * Math.cos(theta)),
    y:   radius * Math.cos(phi),
    z:   radius * Math.sin(phi) * Math.sin(theta),
  };
}

// ─── Orbit Path Generation ───────────────────────────────────────────────────

export interface OrbitPathPoint {
  lat: number;
  lon: number;
  lonRaw: number; // unwrapped, for wrap-break detection
}

/**
 * Generate the ground track of one orbital plane (for 2D drawing).
 * Returns an array of lat/lon points along the orbit.
 */
export function getOrbitPathPoints(
  planeIdx: number,
  numPlanes: number,
  inclinationDeg: number,
  steps = 360,
): OrbitPathPoint[] {
  const inclination = (inclinationDeg * Math.PI) / 180;
  const raan = (planeIdx / numPlanes) * 2 * Math.PI;
  const points: OrbitPathPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const anomaly = (i / steps) * 2 * Math.PI;
    const sinLat = Math.sin(inclination) * Math.sin(anomaly);
    const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
    const yArg = Math.cos(inclination) * Math.sin(anomaly);
    const xArg = Math.cos(anomaly);
    const lon = Math.atan2(yArg, xArg) + raan;

    let lonDeg = (lon * 180) / Math.PI;
    const latDeg = (lat * 180) / Math.PI;
    const lonRaw = lonDeg; // before wrapping
    lonDeg = ((lonDeg + 180) % 360 + 360) % 360 - 180;

    points.push({ lat: latDeg, lon: lonDeg, lonRaw });
  }
  return points;
}

/**
 * Generate orbit circle points for 3D rendering.
 * Returns { x, y, z } triples.
 */
export function getOrbitCircle3D(
  planeIdx: number,
  numPlanes: number,
  inclinationDeg: number,
  orbitRadius: number,
  steps = 128,
): Array<{ x: number; y: number; z: number }> {
  const inclination = (inclinationDeg * Math.PI) / 180;
  const raan = (planeIdx / numPlanes) * 2 * Math.PI;
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const anomaly = (i / steps) * 2 * Math.PI;
    const sinLat = Math.sin(inclination) * Math.sin(anomaly);
    const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));
    const yArg = Math.cos(inclination) * Math.sin(anomaly);
    const xArg = Math.cos(anomaly);
    const lon = Math.atan2(yArg, xArg) + raan;
    const latDeg = (lat * 180) / Math.PI;
    const lonDeg = (lon * 180) / Math.PI;
    points.push(latLonToVector3(latDeg, lonDeg, orbitRadius));
  }
  return points;
}

// ─── Day/Night Terminator ────────────────────────────────────────────────────

/**
 * Compute the sun longitude and the night shadow longitude range
 * for a given simulation time (ms since epoch).
 */
export function getSunLon(simTimeMs: number): number {
  const date = new Date(simTimeMs);
  const utcDecimal = date.getUTCHours() + date.getUTCMinutes() / 60;
  let sunLon = (12 - utcDecimal) * 15;
  sunLon = ((sunLon + 180) % 360 + 360) % 360 - 180;
  return sunLon;
}

export function getNightLonRange(simTimeMs: number): { start: number; end: number } {
  const sunLon = getSunLon(simTimeMs);
  let nightLon = sunLon + 180;
  if (nightLon > 180) nightLon -= 360;
  return { start: nightLon - 90, end: nightLon + 90 };
}

// ─── Orbit Parameters ────────────────────────────────────────────────────────

/**
 * Compute orbital period (seconds) for a circular LEO orbit at given altitude.
 * Uses Kepler's third law.
 */
export function orbitalPeriodSeconds(altitudeKm: number): number {
  const GM = 3.986004418e14; // Earth's gravitational parameter (m^3/s^2)
  const r = (EARTH_RADIUS_KM + altitudeKm) * 1000; // m
  return 2 * Math.PI * Math.sqrt(r ** 3 / GM);
}

/**
 * Convert orbit altitude (km) to the 3D scene orbit radius,
 * given the scene earth radius (typically 5 scene units = 6371 km).
 */
export function altitudeToOrbitRadius(altitudeKm: number, sceneEarthRadius = 5): number {
  return sceneEarthRadius * (EARTH_RADIUS_KM + altitudeKm) / EARTH_RADIUS_KM;
}

/**
 * Compute min dot-product threshold for line-of-sight validation.
 * A link is valid when dot(satA, satB) >= minDot.
 */
export function computeMinDot(altitudeKm: number, minCommAltKm = 80): number {
  const rOrbit = EARTH_RADIUS_KM + altitudeKm;
  const rMin = EARTH_RADIUS_KM + minCommAltKm;
  if (rMin >= rOrbit) return 1; // no links possible
  const ratio = rMin / rOrbit;
  return 2 * ratio * ratio - 1;
}
