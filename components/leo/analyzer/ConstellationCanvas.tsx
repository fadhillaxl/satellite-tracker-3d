'use client';

import { useRef, useEffect, useCallback } from 'react';
import {
  OrbitParams,
  SatellitePosition,
  buildConstellationPositions,
  latLonToXY,
  latLonToVector3,
  getOrbitPathPoints,
  computeMapParams,
  getNightLonRange,
} from '@/lib/leo/walkerOrbit';

export interface CanvasDisplayOptions {
  showOrbits: boolean;
  showBeams: boolean;
  showGrid: boolean;
  showPopulation: boolean;
  popOpacity: number;
}

interface Props {
  params: OrbitParams;
  isPlaying: boolean;
  speed: number;
  simTimeRef: React.MutableRefObject<number>;
  timeOffsetRef: React.MutableRefObject<number>;
  displayOpts: CanvasDisplayOptions;
  onStatsUpdate?: (satellites: number, planes: number) => void;
}

export default function ConstellationCanvas({
  params,
  isPlaying,
  speed,
  simTimeRef,
  timeOffsetRef,
  displayOpts,
  onStatsUpdate,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const earthImgRef = useRef<HTMLImageElement | null>(null);
  const popImgRef = useRef<HTMLImageElement | null>(null);
  const staticDirtyRef = useRef(true);
  const animFrameRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const satSpriteRef = useRef<HTMLCanvasElement | null>(null);

  // Orbit map layout (recomputed on resize)
  const mapRef = useRef({ mapWidth: 0, mapHeight: 0, mapOffsetX: 0, mapOffsetY: 0 });

  // Zoom / pan state
  const scaleRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });

  // ── Setup ──────────────────────────────────────────────────────────────────

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement!;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width, h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Static layer
    if (!staticCanvasRef.current) staticCanvasRef.current = document.createElement('canvas');
    staticCanvasRef.current.width = canvas.width;
    staticCanvasRef.current.height = canvas.height;
    const sCtx = staticCanvasRef.current.getContext('2d')!;
    sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    mapRef.current = computeMapParams(w, h);
    staticDirtyRef.current = true;
  }, []);

  const buildSatSprite = () => {
    const s = document.createElement('canvas');
    s.width = 6; s.height = 6;
    const ctx = s.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(3, 3, 2, 0, Math.PI * 2);
    ctx.fill();
    satSpriteRef.current = s;
  };

  const loadTextures = () => {
    const earth = new Image();
    earth.crossOrigin = 'anonymous';
    earth.onload = () => { earthImgRef.current = earth; staticDirtyRef.current = true; };
    earth.src = '/static/textures/8k_earth_daymap.jpg';

    const pop = new Image();
    pop.crossOrigin = 'anonymous';
    pop.onload = () => { popImgRef.current = pop; staticDirtyRef.current = true; };
    pop.src = '/static/textures/gpw_v4_density.png';
  };

  // ── Static Layer (Earth + Grid + Orbit Paths) ──────────────────────────────

  const renderStaticLayer = useCallback(() => {
    const sc = staticCanvasRef.current;
    if (!sc) return;
    const sCtx = sc.getContext('2d')!;
    const { mapWidth, mapHeight, mapOffsetX, mapOffsetY } = mapRef.current;
    const w = canvasRef.current?.clientWidth ?? sc.width;
    const h = canvasRef.current?.clientHeight ?? sc.height;

    sCtx.fillStyle = '#0a0a0a';
    sCtx.fillRect(0, 0, w, h);

    // Earth image
    if (earthImgRef.current) {
      sCtx.globalAlpha = 1;
      sCtx.drawImage(earthImgRef.current, mapOffsetX, mapOffsetY, mapWidth, mapHeight);
    } else {
      // Fallback: simple dark blue/green gradient
      const grad = sCtx.createLinearGradient(mapOffsetX, mapOffsetY, mapOffsetX + mapWidth, mapOffsetY + mapHeight);
      grad.addColorStop(0, '#0a1628');
      grad.addColorStop(0.5, '#0d2137');
      grad.addColorStop(1, '#0a1628');
      sCtx.fillStyle = grad;
      sCtx.fillRect(mapOffsetX, mapOffsetY, mapWidth, mapHeight);
    }

    // Population heatmap
    if (displayOpts.showPopulation && popImgRef.current && popImgRef.current.complete) {
      sCtx.globalAlpha = displayOpts.popOpacity;
      sCtx.drawImage(popImgRef.current, mapOffsetX, mapOffsetY, mapWidth, mapHeight);
      sCtx.globalAlpha = 1;
    }

    // Night shadow
    const { start, end } = getNightLonRange(simTimeRef.current);
    const lonToX = (lon: number) => mapOffsetX + ((lon + 180) / 360) * mapWidth;
    sCtx.fillStyle = 'rgba(0,0,0,0.35)';
    if (start < -180) {
      sCtx.fillRect(lonToX(start + 360), mapOffsetY, lonToX(180) - lonToX(start + 360), mapHeight);
      sCtx.fillRect(lonToX(-180), mapOffsetY, lonToX(end) - lonToX(-180), mapHeight);
    } else if (end > 180) {
      sCtx.fillRect(lonToX(start), mapOffsetY, lonToX(180) - lonToX(start), mapHeight);
      sCtx.fillRect(lonToX(-180), mapOffsetY, lonToX(end - 360) - lonToX(-180), mapHeight);
    } else {
      sCtx.fillRect(lonToX(start), mapOffsetY, lonToX(end) - lonToX(start), mapHeight);
    }

    // Grid
    if (displayOpts.showGrid) {
      sCtx.strokeStyle = 'rgba(255,255,255,0.08)';
      sCtx.lineWidth = 0.5;
      sCtx.beginPath();
      for (let i = -180; i <= 180; i += 30) {
        const x = mapOffsetX + ((i + 180) / 360) * mapWidth;
        sCtx.moveTo(x, mapOffsetY);
        sCtx.lineTo(x, mapOffsetY + mapHeight);
      }
      for (let i = -90; i <= 90; i += 30) {
        const y = mapOffsetY + ((90 - i) / 180) * mapHeight;
        sCtx.moveTo(mapOffsetX, y);
        sCtx.lineTo(mapOffsetX + mapWidth, y);
      }
      sCtx.stroke();

      // Equator
      sCtx.strokeStyle = 'rgba(255,200,100,0.25)';
      sCtx.lineWidth = 1;
      sCtx.beginPath();
      const eqY = mapOffsetY + mapHeight / 2;
      sCtx.moveTo(mapOffsetX, eqY);
      sCtx.lineTo(mapOffsetX + mapWidth, eqY);
      sCtx.stroke();
    }

    // Orbit paths
    if (displayOpts.showOrbits) {
      const { orbital_planes, inclination } = params;
      sCtx.lineWidth = 1.2;
      for (let p = 0; p < orbital_planes; p++) {
        const hue = (p / orbital_planes) * 60 + 170;
        sCtx.strokeStyle = `hsla(${hue},70%,55%,0.35)`;
        sCtx.beginPath();
        const pts = getOrbitPathPoints(p, orbital_planes, inclination, 360);
        let first = true, prevLon = 0;
        for (const pt of pts) {
          const pos = latLonToXY(pt.lat, pt.lon, mapRef.current);
          if (first) { sCtx.moveTo(pos.x, pos.y); first = false; }
          else if (Math.abs(pt.lon - prevLon) > 180) sCtx.moveTo(pos.x, pos.y);
          else sCtx.lineTo(pos.x, pos.y);
          prevLon = pt.lon;
        }
        sCtx.stroke();
      }
    }

    staticDirtyRef.current = false;
  }, [params, displayOpts, simTimeRef]);

  // ── Animate Frame ──────────────────────────────────────────────────────────

  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.clientWidth, h = canvas.clientHeight;

    if (!lastFrameRef.current) lastFrameRef.current = timestamp;
    const delta = timestamp - lastFrameRef.current;
    lastFrameRef.current = timestamp;

    if (isPlaying) {
      const orbitPeriod = 5760; // seconds — simplified LEO period
      const radPerSec = (2 * Math.PI) / orbitPeriod;
      timeOffsetRef.current += (delta / 1000) * radPerSec * speed;
      simTimeRef.current += delta * speed;
    }

    if (staticDirtyRef.current) renderStaticLayer();

    // Draw static layer
    if (staticCanvasRef.current) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(staticCanvasRef.current, 0, 0);
      ctx.restore();
    }

    // Apply zoom/pan transform for satellites
    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(scaleRef.current, scaleRef.current);

    // Build satellite positions
    const positions = buildConstellationPositions(params, timeOffsetRef.current);
    const { mapOffsetX, mapOffsetY } = mapRef.current;

    // Beam coverage
    if (displayOpts.showBeams) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#00ffff';
      for (const sat of positions) {
        const xy = latLonToXY(sat.lat, sat.lon, mapRef.current);
        const beamR = (params.beam_size / scaleRef.current) * (mapRef.current.mapWidth / 360) * 10;
        ctx.beginPath();
        ctx.arc(xy.x, xy.y, Math.max(2, beamR), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Satellite dots
    for (const sat of positions) {
      const xy = latLonToXY(sat.lat, sat.lon, mapRef.current);
      if (satSpriteRef.current) {
        ctx.drawImage(satSpriteRef.current, xy.x - 3, xy.y - 3);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(xy.x, xy.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // UTC time update
    onStatsUpdate?.(params.satellites, params.orbital_planes);

    animFrameRef.current = requestAnimationFrame(animate);
  }, [params, isPlaying, speed, displayOpts, renderStaticLayer, simTimeRef, timeOffsetRef, onStatsUpdate]);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    buildSatSprite();
    loadTextures();
    setupCanvas();

    const onResize = () => { setupCanvas(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [setupCanvas]);

  // Mark static dirty when display options or params change
  useEffect(() => { staticDirtyRef.current = true; }, [params, displayOpts]);

  useEffect(() => {
    lastFrameRef.current = 0;
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [animate]);

  // ── Pan / Zoom ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(1, Math.min(10, scaleRef.current * factor));
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      if (newScale !== scaleRef.current) {
        const sc = newScale / scaleRef.current;
        panRef.current.x = mx - (mx - panRef.current.x) * sc;
        panRef.current.y = my - (my - panRef.current.y) * sc;
      }
      scaleRef.current = newScale;
      staticDirtyRef.current = true;
    };

    const onMouseDown = (e: MouseEvent) => {
      isPanningRef.current = true;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanningRef.current) return;
      panRef.current.x += e.clientX - lastPanRef.current.x;
      panRef.current.y += e.clientY - lastPanRef.current.y;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      staticDirtyRef.current = true;
    };
    const onMouseUp = () => {
      isPanningRef.current = false;
      canvas.style.cursor = 'grab';
    };

    canvas.style.cursor = 'grab';
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  );
}
