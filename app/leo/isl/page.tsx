'use client';

import { useState, useRef, useCallback } from 'react';
import LeoLayout from '@/components/leo/LeoLayout';
import ISLCanvas, { ISLDisplayOptions } from '@/components/leo/isl/ISLCanvas';
import ConstellationCard, { ConstellationConfig } from '@/components/leo/isl/ConstellationCard';
import { CONSTELLATION_COLORS } from '@/lib/leo/islCompute';

const DEFAULT_DISPLAY: ISLDisplayOptions = {
  showAscending: true,
  showDescending: true,
  showGrid: true,
  showDots: true,
  showCrossISL: true,
  showIntraISL: false,
  showInterISL: false,
  showRightLeftISL: false,
  minCommAltKm: 80,
};

const INITIAL_CONSTELLATIONS: ConstellationConfig[] = [
  { id: 'const-0', name: 'Starlink S1', satellites: 380, orbital_planes: 12, inclination: 53, altitude: 550, colorIdx: 0 },
];

let nextId = 1;

function CheckboxRow({ label, checked, onChange, color = '#22d3ee' }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; color?: string;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 7, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
      <span style={{ width: 13, height: 13, border: `1px solid ${checked ? color : 'rgba(255,255,255,0.2)'}`, borderRadius: 2, background: checked ? color + '22' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
        {checked && <svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      {label}
    </label>
  );
}

const ISL_LINK_COLORS: Record<string, string> = {
  showCrossISL: 'rgba(255,80,255,0.8)',
  showRightLeftISL: 'rgba(255,215,64,0.8)',
  showIntraISL: 'rgba(180,255,80,0.8)',
  showInterISL: 'rgba(80,220,255,0.8)',
};

export default function ISLPage() {
  const [constellations, setConstellations] = useState<ConstellationConfig[]>(INITIAL_CONSTELLATIONS);
  const [displayOpts, setDisplayOpts] = useState<ISLDisplayOptions>(DEFAULT_DISPLAY);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  const timeOffsetRef = useRef(0);
  const simTimeRef = useRef(Date.now());

  const addConstellation = () => {
    if (constellations.length >= 6) return;
    const id = `const-${nextId++}`;
    setConstellations(prev => [...prev, {
      id, name: `Constellation ${constellations.length + 1}`,
      satellites: 300, orbital_planes: 10, inclination: 55, altitude: 600, colorIdx: constellations.length,
    }]);
  };

  const updateConstellation = (idx: number, cfg: ConstellationConfig) => {
    setConstellations(prev => prev.map((c, i) => i === idx ? cfg : c));
  };

  const removeConstellation = (idx: number) => {
    setConstellations(prev => prev.filter((_, i) => i !== idx));
  };

  const toggleDisplay = (key: keyof ISLDisplayOptions) => {
    setDisplayOpts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const sectionHeader: React.CSSProperties = {
    fontSize: 10, fontFamily: "'Orbitron',monospace", fontWeight: 600,
    letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 8,
  };

  return (
    <LeoLayout>
      <div style={{ display: 'flex', height: '100%' }}>
        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* Legend overlay */}
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 20,
            padding: '6px 12px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', gap: 12, flexWrap: 'wrap',
          }}>
            {constellations.map((c, i) => {
              const color = CONSTELLATION_COLORS[i % CONSTELLATION_COLORS.length];
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color.asc }} />
                  {c.name}
                </div>
              );
            })}
          </div>

          {/* ISL type legend */}
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 20,
            padding: '6px 12px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
            borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', gap: 12,
          }}>
            {displayOpts.showCrossISL && <div style={{ fontSize: 10, color: 'rgba(255,80,255,0.8)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 1.5, background: 'rgba(255,80,255,0.8)', display: 'inline-block' }} />Cross-Plane</div>}
            {displayOpts.showRightLeftISL && <div style={{ fontSize: 10, color: 'rgba(255,215,64,0.8)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 1.5, background: 'rgba(255,215,64,0.8)', display: 'inline-block' }} />Right-Left</div>}
            {displayOpts.showIntraISL && <div style={{ fontSize: 10, color: 'rgba(180,255,80,0.8)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 1.5, background: 'rgba(180,255,80,0.8)', display: 'inline-block' }} />Intra-Plane</div>}
            {displayOpts.showInterISL && <div style={{ fontSize: 10, color: 'rgba(80,220,255,0.8)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 1.5, background: 'rgba(80,220,255,0.8)', display: 'inline-block' }} />Inter-Plane</div>}
          </div>

          <ISLCanvas
            constellations={constellations}
            displayOpts={displayOpts}
            isPlaying={isPlaying}
            speed={speed}
            timeOffsetRef={timeOffsetRef}
            simTimeRef={simTimeRef}
          />
        </div>

        {/* Right panel */}
        <div style={{ width: 260, flexShrink: 0, overflowY: 'auto', borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,10,18,0.9)', padding: '14px 12px' }}>
          {/* Constellations */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontSize: 11, fontFamily: "'Orbitron',monospace", fontWeight: 700, color: '#fff', letterSpacing: '0.1em' }}>CONSTELLATIONS</h2>
              <button
                onClick={addConstellation}
                disabled={constellations.length >= 6}
                style={{
                  fontSize: 16, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
                  color: '#22d3ee', width: 26, height: 26, borderRadius: 4, cursor: constellations.length >= 6 ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: constellations.length >= 6 ? 0.4 : 1,
                  transition: 'all 0.2s',
                }}
                title="Add constellation (max 6)"
              >
                +
              </button>
            </div>
            {constellations.map((cfg, i) => (
              <ConstellationCard
                key={cfg.id}
                config={cfg}
                colorIdx={i}
                onUpdate={updated => updateConstellation(i, updated)}
                onRemove={() => removeConstellation(i)}
                canRemove={constellations.length > 1}
              />
            ))}
          </div>

          {/* ISL Links */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginBottom: 12 }}>
            <div style={sectionHeader}>ISL LINK TYPES</div>
            <CheckboxRow label="Cross-Plane (↗↘)" checked={displayOpts.showCrossISL} onChange={() => toggleDisplay('showCrossISL')} color="rgba(255,80,255,0.9)" />
            <CheckboxRow label="Right-Left (Complementary)" checked={displayOpts.showRightLeftISL} onChange={() => toggleDisplay('showRightLeftISL')} color="rgba(255,215,64,0.9)" />
            <CheckboxRow label="Intra-Plane (↑↑)" checked={displayOpts.showIntraISL} onChange={() => toggleDisplay('showIntraISL')} color="rgba(180,255,80,0.9)" />
            <CheckboxRow label="Inter-Plane (→→)" checked={displayOpts.showInterISL} onChange={() => toggleDisplay('showInterISL')} color="rgba(80,220,255,0.9)" />
          </div>

          {/* Display */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12, marginBottom: 12 }}>
            <div style={sectionHeader}>DISPLAY</div>
            <CheckboxRow label="Ascending Passes" checked={displayOpts.showAscending} onChange={() => toggleDisplay('showAscending')} />
            <CheckboxRow label="Descending Passes" checked={displayOpts.showDescending} onChange={() => toggleDisplay('showDescending')} />
            <CheckboxRow label="Grid Lines" checked={displayOpts.showGrid} onChange={() => toggleDisplay('showGrid')} color="rgba(255,200,100,0.8)" />
            <CheckboxRow label="Satellite Dots" checked={displayOpts.showDots} onChange={() => toggleDisplay('showDots')} />
          </div>

          {/* Playback */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
            <div style={sectionHeader}>PLAYBACK</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => setIsPlaying(p => !p)}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: isPlaying ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${isPlaying ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.12)'}`,
                  color: isPlaying ? '#22d3ee' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13,
                }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <div style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                <div style={{ marginBottom: 3 }}>Speed: {speed}×</div>
                <input type="range" min={1} max={500} value={speed} onChange={e => setSpeed(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#22d3ee', height: 2 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </LeoLayout>
  );
}
