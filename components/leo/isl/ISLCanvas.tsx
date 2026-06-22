'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  buildConstellationPositions,
  latLonToXY,
  getOrbitPathPoints,
  computeMapParams,
  getNightLonRange,
  altitudeToOrbitRadius,
} from '@/lib/leo/walkerOrbit';
import {
  classifySatellites,
  computeCrossPlaneISL,
  computeIntraPlaneISL,
  computeInterPlaneISL,
  computeRightLeftISL,
  CONSTELLATION_COLORS,
} from '@/lib/leo/islCompute';
import { ConstellationConfig } from './ConstellationCard';

export interface ISLDisplayOptions {
  showAscending: boolean;
  showDescending: boolean;
  showGrid: boolean;
  showDots: boolean;
  showCrossISL: boolean;
  showIntraISL: boolean;
  showInterISL: boolean;
  showRightLeftISL: boolean;
  minCommAltKm: number;
}

interface Props {
  constellations: ConstellationConfig[];
  displayOpts: ISLDisplayOptions;
  isPlaying: boolean;
  speed: number;
  timeOffsetRef: React.MutableRefObject<number>;
  simTimeRef: React.MutableRefObject<number>;
}

export default function ISLCanvas({ constellations, displayOpts, isPlaying, speed, timeOffsetRef, simTimeRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const earthImgRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const mapRef = useRef(computeMapParams(800, 600));
  const staticDirtyRef = useRef(true);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width, h = rect.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!staticCanvasRef.current) staticCanvasRef.current = document.createElement('canvas');
    staticCanvasRef.current.width = canvas.width; staticCanvasRef.current.height = canvas.height;
    const sCtx = staticCanvasRef.current.getContext('2d')!;
    sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mapRef.current = computeMapParams(w, h);
    staticDirtyRef.current = true;
  }, []);

  useEffect(() => {
    const earth = new Image();
    earth.crossOrigin = 'anonymous';
    earth.onload = () => { earthImgRef.current = earth; staticDirtyRef.current = true; };
    earth.src = '/static/textures/8k_earth_daymap.jpg';
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  useEffect(() => { staticDirtyRef.current = true; }, [constellations, displayOpts]);

  const renderStaticLayer = useCallback(() => {
    const sc = staticCanvasRef.current;
    if (!sc) return;
    const sCtx = sc.getContext('2d')!;
    const { mapWidth, mapHeight, mapOffsetX, mapOffsetY } = mapRef.current;
    const w = canvasRef.current?.clientWidth ?? sc.width;
    const h = canvasRef.current?.clientHeight ?? sc.height;

    sCtx.fillStyle = '#080c14'; sCtx.fillRect(0, 0, w, h);

    if (earthImgRef.current) {
      sCtx.drawImage(earthImgRef.current, mapOffsetX, mapOffsetY, mapWidth, mapHeight);
    } else {
      sCtx.fillStyle = '#0a1628';
      sCtx.fillRect(mapOffsetX, mapOffsetY, mapWidth, mapHeight);
    }

    // Night shadow
    const { start, end } = getNightLonRange(simTimeRef.current);
    const lx = (lon: number) => mapOffsetX + ((lon + 180) / 360) * mapWidth;
    sCtx.fillStyle = 'rgba(0,0,0,0.3)';
    if (start < -180) { sCtx.fillRect(lx(start + 360), mapOffsetY, lx(180) - lx(start + 360), mapHeight); sCtx.fillRect(lx(-180), mapOffsetY, lx(end) - lx(-180), mapHeight); }
    else if (end > 180) { sCtx.fillRect(lx(start), mapOffsetY, lx(180) - lx(start), mapHeight); sCtx.fillRect(lx(-180), mapOffsetY, lx(end - 360) - lx(-180), mapHeight); }
    else sCtx.fillRect(lx(start), mapOffsetY, lx(end) - lx(start), mapHeight);

    if (displayOpts.showGrid) {
      sCtx.strokeStyle = 'rgba(255,255,255,0.07)'; sCtx.lineWidth = 0.5; sCtx.beginPath();
      for (let i = -180; i <= 180; i += 30) { const x = mapOffsetX + ((i + 180) / 360) * mapWidth; sCtx.moveTo(x, mapOffsetY); sCtx.lineTo(x, mapOffsetY + mapHeight); }
      for (let i = -90; i <= 90; i += 30) { const y = mapOffsetY + ((90 - i) / 180) * mapHeight; sCtx.moveTo(mapOffsetX, y); sCtx.lineTo(mapOffsetX + mapWidth, y); }
      sCtx.stroke();
      sCtx.strokeStyle = 'rgba(255,200,100,0.2)'; sCtx.lineWidth = 1; sCtx.beginPath();
      const ey = mapOffsetY + mapHeight / 2; sCtx.moveTo(mapOffsetX, ey); sCtx.lineTo(mapOffsetX + mapWidth, ey); sCtx.stroke();
    }

    // Orbit paths per constellation
    for (let ci = 0; ci < constellations.length; ci++) {
      const cfg = constellations[ci];
      const colors = CONSTELLATION_COLORS[ci % CONSTELLATION_COLORS.length];
      sCtx.lineWidth = 1;
      for (let p = 0; p < cfg.orbital_planes; p++) {
        const pts = getOrbitPathPoints(p, cfg.orbital_planes, cfg.inclination, 200);
        let prevLon = 0;
        // Ascending (green)
        if (displayOpts.showAscending) {
          sCtx.strokeStyle = colors.asc + '55'; sCtx.beginPath(); let first = true;
          for (const pt of pts.filter(pt => { const a = (pts.indexOf(pt) / pts.length) * 2 * Math.PI; return Math.cos(a - Math.PI / 2) > 0; })) {
            const pos = latLonToXY(pt.lat, pt.lon, mapRef.current);
            if (first || Math.abs(pt.lon - prevLon) > 180) { sCtx.moveTo(pos.x, pos.y); first = false; }
            else sCtx.lineTo(pos.x, pos.y);
            prevLon = pt.lon;
          }
          sCtx.stroke();
        }
        // Descending (orange)
        if (displayOpts.showDescending) {
          sCtx.strokeStyle = colors.desc + '55'; sCtx.beginPath(); let first = true; prevLon = 0;
          for (const pt of pts.filter(pt => { const a = (pts.indexOf(pt) / pts.length) * 2 * Math.PI; return Math.cos(a - Math.PI / 2) <= 0; })) {
            const pos = latLonToXY(pt.lat, pt.lon, mapRef.current);
            if (first || Math.abs(pt.lon - prevLon) > 180) { sCtx.moveTo(pos.x, pos.y); first = false; }
            else sCtx.lineTo(pos.x, pos.y);
            prevLon = pt.lon;
          }
          sCtx.stroke();
        }
      }
    }

    staticDirtyRef.current = false;
  }, [constellations, displayOpts, simTimeRef]);

  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    if (!lastFrameRef.current) lastFrameRef.current = timestamp;
    const delta = timestamp - lastFrameRef.current;
    lastFrameRef.current = timestamp;

    if (isPlaying) {
      const radPerSec = (2 * Math.PI) / 5760;
      timeOffsetRef.current += (delta / 1000) * radPerSec * speed;
      simTimeRef.current += delta * speed;
    }

    if (staticDirtyRef.current) renderStaticLayer();

    if (staticCanvasRef.current) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(staticCanvasRef.current, 0, 0);
      ctx.restore();
    }

    // Draw per-constellation ISL links + satellites
    for (let ci = 0; ci < constellations.length; ci++) {
      const cfg = constellations[ci];
      const colors = CONSTELLATION_COLORS[ci % CONSTELLATION_COLORS.length];
      const positions = buildConstellationPositions(
        { satellites: cfg.satellites, orbital_planes: cfg.orbital_planes, beam_size: 0, inclination: cfg.inclination },
        timeOffsetRef.current,
      );
      const { ascSats, descSats } = classifySatellites(positions);
      const { mapWidth } = mapRef.current;

      const drawLinks = (links: { from?: number; to?: number; asc?: number; desc?: number }[], colorStr: string, isAscDesc: boolean) => {
        ctx.strokeStyle = colorStr; ctx.lineWidth = 1; ctx.beginPath();
        for (const lk of links) {
          let a, b;
          if (isAscDesc && lk.asc !== undefined && lk.desc !== undefined) {
            a = latLonToXY(ascSats[lk.asc].lat, ascSats[lk.asc].lon, mapRef.current);
            b = latLonToXY(descSats[lk.desc].lat, descSats[lk.desc].lon, mapRef.current);
          } else if (lk.from !== undefined && lk.to !== undefined) {
            a = latLonToXY(positions[lk.from].lat, positions[lk.from].lon, mapRef.current);
            b = latLonToXY(positions[lk.to].lat, positions[lk.to].lon, mapRef.current);
          } else continue;
          if (Math.abs(a.x - b.x) > mapWidth / 2) continue;
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      };

      const minDot = (() => {
        const R = 6371, rOrbit = R + cfg.altitude, rMin = R + displayOpts.minCommAltKm;
        if (rMin >= rOrbit) return 1;
        const ratio = rMin / rOrbit; return 2 * ratio * ratio - 1;
      })();

      if (displayOpts.showCrossISL) {
        const cross = computeCrossPlaneISL(ascSats, descSats, minDot);
        drawLinks(cross, 'rgba(255,80,255,0.65)', true);
      }
      if (displayOpts.showRightLeftISL) {
        const cross = computeCrossPlaneISL(ascSats, descSats, minDot);
        const rl = computeRightLeftISL(ascSats, descSats, cross, minDot, displayOpts.showCrossISL);
        drawLinks(rl, 'rgba(255,215,64,0.65)', true);
      }
      if (displayOpts.showIntraISL) {
        const intra = computeIntraPlaneISL(positions, cfg.satellites, cfg.orbital_planes, minDot);
        drawLinks(intra, 'rgba(180,255,80,0.55)', false);
      }
      if (displayOpts.showInterISL) {
        const inter = computeInterPlaneISL(positions, cfg.satellites, cfg.orbital_planes, minDot);
        drawLinks(inter, 'rgba(80,220,255,0.55)', false);
      }

      // Satellites
      if (displayOpts.showDots) {
        for (const sat of positions) {
          const xy = latLonToXY(sat.lat, sat.lon, mapRef.current);
          ctx.fillStyle = sat.isAscending ? colors.asc : colors.desc;
          ctx.beginPath(); ctx.arc(xy.x, xy.y, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }, [constellations, displayOpts, isPlaying, speed, renderStaticLayer, timeOffsetRef, simTimeRef]);

  useEffect(() => {
    lastFrameRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animate]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />;
}
