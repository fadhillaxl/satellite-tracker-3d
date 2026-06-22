/**
 * ISL (Inter-Satellite Link) computation — pure TypeScript.
 * Extracted from palatine-space/static/js/isl.js
 */

import { SatellitePosition, computeMinDot } from './walkerOrbit';

export interface ISLLink {
  from: number; // index into ascSats or allSatPositions
  to: number;
}

export interface CrossLink {
  asc: number;  // index into ascSats
  desc: number; // index into descSats
}

export interface ISLResult {
  crossLinks: CrossLink[];
  rightLeftLinks: CrossLink[];
  intraLinks: ISLLink[];
  interLinks: ISLLink[];
}

// Distinct hue palettes for up to 6 constellations
export const CONSTELLATION_COLORS = [
  { asc: '#64FF64', desc: '#FFA03C', orbit2DAsc: '#64C8FF', orbit2DDesc: '#FFA03C' },
  { asc: '#50DCFF', desc: '#FF6B8A', orbit2DAsc: '#50DCFF', orbit2DDesc: '#FF6B8A' },
  { asc: '#FFD740', desc: '#B388FF', orbit2DAsc: '#FFD740', orbit2DDesc: '#B388FF' },
  { asc: '#69F0AE', desc: '#FF8A65', orbit2DAsc: '#69F0AE', orbit2DDesc: '#FF8A65' },
  { asc: '#40C4FF', desc: '#FF5252', orbit2DAsc: '#40C4FF', orbit2DDesc: '#FF5252' },
  { asc: '#EEFF41', desc: '#E040FB', orbit2DAsc: '#EEFF41', orbit2DDesc: '#E040FB' },
] as const;

export type ConstellationColor = typeof CONSTELLATION_COLORS[number];

// ─── Satellite Classification ─────────────────────────────────────────────────

export function classifySatellites(positions: SatellitePosition[]): {
  ascSats: SatellitePosition[];
  descSats: SatellitePosition[];
} {
  const ascSats = positions.filter(s => s.isAscending);
  const descSats = positions.filter(s => !s.isAscending);
  return { ascSats, descSats };
}

// ─── Cross-Plane ISL (Voronoi nearest ascending ↔ descending) ─────────────────

export function computeCrossPlaneISL(
  ascSats: SatellitePosition[],
  descSats: SatellitePosition[],
  minDot: number,
): CrossLink[] {
  const links: CrossLink[] = [];
  for (let i = 0; i < ascSats.length; i++) {
    const a = ascSats[i];
    let best = -1, bestDot = -2;
    for (let j = 0; j < descSats.length; j++) {
      const d = descSats[j];
      const dot = a.px * d.px + a.py * d.py + a.pz * d.pz;
      if (dot > bestDot) { bestDot = dot; best = j; }
    }
    if (best >= 0 && bestDot >= minDot) links.push({ asc: i, desc: best });
  }
  return links;
}

// ─── Right-Left ISL (complementary Voronoi pairs) ────────────────────────────

export function computeRightLeftISL(
  ascSats: SatellitePosition[],
  descSats: SatellitePosition[],
  crossLinks: CrossLink[],
  minDot: number,
  includeCross: boolean,
): CrossLink[] {
  const links: CrossLink[] = [];
  const voronoiPairs = new Set<string>();
  if (includeCross) {
    for (const lk of crossLinks) {
      voronoiPairs.add(`${ascSats[lk.asc].satIdx}-${descSats[lk.desc].satIdx}`);
    }
  }
  for (let j = 0; j < descSats.length; j++) {
    const d = descSats[j];
    let bestAsc = -1, bestDot = -2;
    for (let i = 0; i < ascSats.length; i++) {
      const a = ascSats[i];
      const dot = a.px * d.px + a.py * d.py + a.pz * d.pz;
      if (dot > bestDot) { bestDot = dot; bestAsc = i; }
    }
    if (bestAsc < 0 || bestDot < minDot) continue;
    const pairKey = `${ascSats[bestAsc].satIdx}-${d.satIdx}`;
    if (voronoiPairs.has(pairKey)) continue;
    links.push({ asc: bestAsc, desc: j });
  }
  return links;
}

// ─── Intra-Plane ISL (consecutive sats in same plane) ────────────────────────

export function computeIntraPlaneISL(
  positions: SatellitePosition[],
  totalSats: number,
  numPlanes: number,
  minDot: number,
): ISLLink[] {
  const links: ISLLink[] = [];
  const satsPerPlane = Math.ceil(totalSats / numPlanes);
  if (satsPerPlane < 2) return links;

  for (let pl = 0; pl < numPlanes; pl++) {
    for (let s = 0; s < satsPerPlane; s++) {
      const ci = s * numPlanes + pl;
      const ni = ((s + 1) % satsPerPlane) * numPlanes + pl;
      if (ci >= totalSats || ni >= totalSats) continue;
      const sa = positions[ci], sb = positions[ni];
      if (sa && sb) {
        const dot = sa.px * sb.px + sa.py * sb.py + sa.pz * sb.pz;
        if (dot < minDot) continue;
      }
      links.push({ from: ci, to: ni });
    }
  }
  return links;
}

// ─── Inter-Plane ISL (adjacent planes) ───────────────────────────────────────

export function computeInterPlaneISL(
  positions: SatellitePosition[],
  totalSats: number,
  numPlanes: number,
  minDot: number,
): ISLLink[] {
  const links: ISLLink[] = [];
  if (numPlanes < 2) return links;

  const ascByPlane: number[][] = Array.from({ length: numPlanes }, () => []);
  const descByPlane: number[][] = Array.from({ length: numPlanes }, () => []);

  for (let i = 0; i < totalSats; i++) {
    const sat = positions[i];
    if (sat.isAscending) ascByPlane[sat.planeIdx].push(i);
    else descByPlane[sat.planeIdx].push(i);
  }

  const linkPlanes = (listA: number[], listB: number[]) => {
    if (!listA.length || !listB.length) return;
    for (const ci of listA) {
      const sc = positions[ci];
      let best = -1, bestD = -2;
      for (const ri of listB) {
        const sr = positions[ri];
        const dot = sc.px * sr.px + sc.py * sr.py + sc.pz * sr.pz;
        if (dot > bestD) { bestD = dot; best = ri; }
      }
      if (best >= 0 && bestD >= minDot) links.push({ from: ci, to: best });
    }
  };

  for (let p = 0; p < numPlanes; p++) {
    const pr = (p + 1) % numPlanes;
    linkPlanes(ascByPlane[p], ascByPlane[pr]);
    linkPlanes(descByPlane[p], descByPlane[pr]);
  }
  return links;
}

// ─── All ISL Links at Once ────────────────────────────────────────────────────

export interface ISLOptions {
  showCross: boolean;
  showRightLeft: boolean;
  showIntra: boolean;
  showInter: boolean;
}

export function computeAllISL(
  positions: SatellitePosition[],
  totalSats: number,
  numPlanes: number,
  altitudeKm: number,
  opts: ISLOptions,
): ISLResult {
  const minDot = computeMinDot(altitudeKm);
  const { ascSats, descSats } = classifySatellites(positions);

  const crossLinks = opts.showCross || opts.showRightLeft
    ? computeCrossPlaneISL(ascSats, descSats, minDot)
    : [];

  const rightLeftLinks = opts.showRightLeft
    ? computeRightLeftISL(ascSats, descSats, crossLinks, minDot, opts.showCross)
    : [];

  const intraLinks = opts.showIntra
    ? computeIntraPlaneISL(positions, totalSats, numPlanes, minDot)
    : [];

  const interLinks = opts.showInter
    ? computeInterPlaneISL(positions, totalSats, numPlanes, minDot)
    : [];

  return { crossLinks, rightLeftLinks, intraLinks, interLinks };
}
