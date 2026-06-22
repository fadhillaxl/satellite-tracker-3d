'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import LeoLayout from '@/components/leo/LeoLayout';
import ConstellationCanvas, { CanvasDisplayOptions } from '@/components/leo/analyzer/ConstellationCanvas';
import ControlPanel from '@/components/leo/analyzer/ControlPanel';
import { OrbitParams } from '@/lib/leo/walkerOrbit';

// Three.js globe loaded only on client side
const ThreeGlobeInner = dynamic(
  () => import('@/components/leo/analyzer/ThreeGlobeInner'),
  { ssr: false, loading: () => <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: "'Orbitron', monospace" }}>LOADING 3D ENGINE...</div> },
);

const DEFAULT_PARAMS: OrbitParams = {
  satellites: 458,
  orbital_planes: 12,
  beam_size: 0.45,
  inclination: 53,
};

const DEFAULT_DISPLAY: CanvasDisplayOptions = {
  showOrbits: true,
  showBeams: true,
  showGrid: true,
  showPopulation: false,
  popOpacity: 0.8,
};

export default function AnalyzerPage() {
  const [params, setParams] = useState<OrbitParams>(DEFAULT_PARAMS);
  const [display, setDisplay] = useState<CanvasDisplayOptions>(DEFAULT_DISPLAY);
  const [mode, setMode] = useState<'2D' | '3D'>('2D');
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [utcTime, setUtcTime] = useState('--:--:--');
  const [stats, setStats] = useState({ sats: DEFAULT_PARAMS.satellites, planes: DEFAULT_PARAMS.orbital_planes });

  // Shared animation state (refs to avoid re-render on every frame)
  const simTimeRef = useRef(Date.now());
  const timeOffsetRef = useRef(0);

  // UTC clock tick
  useEffect(() => {
    const interval = setInterval(() => {
      const d = new Date(simTimeRef.current);
      setUtcTime(d.toISOString().substring(11, 19));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleParamsChange = useCallback((partial: Partial<OrbitParams>) => {
    setParams(prev => ({ ...prev, ...partial }));
  }, []);

  const handleDisplayChange = useCallback((partial: Partial<CanvasDisplayOptions>) => {
    setDisplay(prev => ({ ...prev, ...partial }));
  }, []);

  const handleStatsUpdate = useCallback((sats: number, planes: number) => {
    setStats({ sats, planes });
  }, []);

  const handleLiveSync = () => {
    simTimeRef.current = Date.now();
    timeOffsetRef.current = 0;
  };

  return (
    <LeoLayout>
      <div style={{ display: 'flex', height: '100%', position: 'relative' }}>
        {/* ── Visualization Panel ─────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* 2D / 3D toggle */}
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 20,
            display: 'flex', gap: 4,
          }}>
            {(['2D', '3D'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '5px 14px',
                  fontSize: 11,
                  fontFamily: "'Orbitron', monospace",
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  border: `1px solid ${mode === m ? 'rgba(34,211,238,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  background: mode === m ? 'rgba(34,211,238,0.12)' : 'rgba(0,0,0,0.4)',
                  color: mode === m ? '#22d3ee' : 'rgba(255,255,255,0.4)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(8px)',
                }}
              >
                {m}
              </button>
            ))}

            {/* Constellation stats badge */}
            <div style={{
              marginLeft: 8,
              padding: '5px 12px',
              fontSize: 10,
              fontFamily: "'Share Tech Mono', monospace",
              color: 'rgba(255,255,255,0.35)',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.4)',
              borderRadius: 4,
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 6px #22d3ee', display: 'inline-block', flexShrink: 0 }} />
              {stats.sats} SAT · {stats.planes} PLN
            </div>
          </div>

          {/* Legend */}
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 20,
            display: 'flex', gap: 14, alignItems: 'center',
            padding: '6px 12px',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            {[
              { color: '#fff', label: 'Satellite', shape: 'dot' },
              { color: 'hsla(190,70%,55%,0.6)', label: 'Orbital Path', shape: 'line' },
              { color: 'rgba(0,255,255,0.5)', label: 'Beam Coverage', shape: 'dot' },
            ].map(({ color, label, shape }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: "'Inter', sans-serif" }}>
                {shape === 'dot'
                  ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  : <span style={{ width: 16, height: 1.5, background: color, display: 'inline-block', borderRadius: 1 }} />
                }
                {label}
              </div>
            ))}
          </div>

          {/* Canvas layers */}
          <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <div style={{ display: mode === '2D' ? 'block' : 'none', width: '100%', height: '100%' }}>
              <ConstellationCanvas
                params={params}
                isPlaying={isPlaying}
                speed={speed}
                simTimeRef={simTimeRef}
                timeOffsetRef={timeOffsetRef}
                displayOpts={display}
                onStatsUpdate={handleStatsUpdate}
              />
            </div>
            <div style={{ display: mode === '3D' ? 'block' : 'none', width: '100%', height: '100%', background: '#040810' }}>
              <Suspense fallback={null}>
                {mode === '3D' && (
                  <ThreeGlobeInner
                    params={params}
                    isPlaying={isPlaying}
                    speed={speed}
                    timeOffsetRef={timeOffsetRef}
                    displayOpts={display}
                  />
                )}
              </Suspense>
            </div>
          </div>
        </div>

        {/* ── Control Panel ───────────────────────────────────────────── */}
        <ControlPanel
          params={params}
          onParamsChange={handleParamsChange}
          displayOpts={display}
          onDisplayChange={handleDisplayChange}
          isPlaying={isPlaying}
          onPlayToggle={() => setIsPlaying(p => !p)}
          speed={speed}
          onSpeedChange={setSpeed}
          utcTime={utcTime}
          onLiveSync={handleLiveSync}
          satCount={stats.sats}
          planeCount={stats.planes}
        />
      </div>
    </LeoLayout>
  );
}
