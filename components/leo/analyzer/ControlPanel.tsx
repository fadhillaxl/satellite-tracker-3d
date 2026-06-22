'use client';

import { OrbitParams } from '@/lib/leo/walkerOrbit';
import { CanvasDisplayOptions } from './ConstellationCanvas';

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

function SliderRow({ label, value, min, max, step, onChange, format }: SliderRowProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
        <span>{label}</span>
        <span style={{ color: '#22d3ee', fontFamily: "'Share Tech Mono', monospace" }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{
          width: '100%', height: 3, accentColor: '#22d3ee', cursor: 'pointer',
          background: `linear-gradient(to right, #22d3ee ${((value - min) / (max - min)) * 100}%, rgba(255,255,255,0.1) 0)`,
          borderRadius: 2, outline: 'none', border: 'none',
        }}
      />
    </div>
  );
}

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}

function CheckboxRow({ label, checked, onChange, color = '#22d3ee' }: CheckboxRowProps) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
      <span style={{
        width: 14, height: 14, border: `1px solid ${checked ? color : 'rgba(255,255,255,0.2)'}`,
        borderRadius: 2, background: checked ? color + '22' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        transition: 'all 0.2s',
      }}>
        {checked && <svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ display: 'none' }} />
      {label}
    </label>
  );
}

interface Section {
  id: string;
  label: string;
}

interface ControlPanelProps {
  params: OrbitParams;
  onParamsChange: (p: Partial<OrbitParams>) => void;
  displayOpts: CanvasDisplayOptions;
  onDisplayChange: (d: Partial<CanvasDisplayOptions>) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
  speed: number;
  onSpeedChange: (s: number) => void;
  utcTime: string;
  onLiveSync: () => void;
  satCount: number;
  planeCount: number;
}

export default function ControlPanel({
  params, onParamsChange,
  displayOpts, onDisplayChange,
  isPlaying, onPlayToggle,
  speed, onSpeedChange,
  utcTime, onLiveSync,
  satCount, planeCount,
}: ControlPanelProps) {
  const sections: Section[] = [
    { id: 'coverage', label: 'COVERAGE' },
    { id: 'map', label: 'MAP LAYER' },
    { id: 'display', label: 'DISPLAY' },
  ];

  const sectionStyle = {
    borderTop: '1px solid rgba(255,255,255,0.07)',
    padding: '12px 0',
  };

  const sectionHeader: React.CSSProperties = {
    fontSize: 10,
    fontFamily: "'Orbitron', monospace",
    fontWeight: 600,
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.35)',
    marginBottom: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  };

  return (
    <div style={{
      width: 240,
      height: '100%',
      overflowY: 'auto',
      padding: '16px 14px',
      background: 'rgba(8,12,20,0.85)',
      borderLeft: '1px solid rgba(255,255,255,0.06)',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 12, fontFamily: "'Orbitron', monospace", fontWeight: 700, color: '#fff', letterSpacing: '0.1em', marginBottom: 4 }}>
          CONTROLS
        </h2>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: "'Share Tech Mono', monospace" }}>
          {satCount} sats · {planeCount} planes
        </div>
      </div>

      {/* Coverage */}
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span>◈</span> COVERAGE
        </div>
        <SliderRow label="Satellites" value={params.satellites} min={100} max={1000} step={1}
          onChange={v => onParamsChange({ satellites: v })} />
        <SliderRow label="Orbital Planes" value={params.orbital_planes} min={1} max={50} step={1}
          onChange={v => onParamsChange({ orbital_planes: v })} />
        <SliderRow label="Beam Size" value={params.beam_size} min={0.10} max={3.00} step={0.01}
          format={v => v.toFixed(2)}
          onChange={v => onParamsChange({ beam_size: v })} />
        <SliderRow label="Inclination (°)" value={params.inclination} min={0} max={90} step={1}
          onChange={v => onParamsChange({ inclination: v })} />
      </div>

      {/* Map Layer */}
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span>⊞</span> MAP LAYER
        </div>
        <CheckboxRow
          label="Population Heatmap"
          checked={displayOpts.showPopulation}
          onChange={v => onDisplayChange({ showPopulation: v })}
          color="#a78bfa"
        />
        {displayOpts.showPopulation && (
          <SliderRow label="Heatmap Opacity" value={Math.round(displayOpts.popOpacity * 100)} min={0} max={100} step={1}
            format={v => `${v}%`}
            onChange={v => onDisplayChange({ popOpacity: v / 100 })} />
        )}
      </div>

      {/* Display */}
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span>⬡</span> DISPLAY
        </div>
        <CheckboxRow label="Orbital Paths" checked={displayOpts.showOrbits} onChange={v => onDisplayChange({ showOrbits: v })} />
        <CheckboxRow label="Beam Coverage" checked={displayOpts.showBeams} onChange={v => onDisplayChange({ showBeams: v })} color="#00ffff" />
        <CheckboxRow label="Grid Lines" checked={displayOpts.showGrid} onChange={v => onDisplayChange({ showGrid: v })} color="rgba(255,200,100,0.8)" />
      </div>

      {/* Playback */}
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span>▶</span> PLAYBACK
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button
            onClick={onPlayToggle}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: isPlaying ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${isPlaying ? 'rgba(34,211,238,0.5)' : 'rgba(255,255,255,0.15)'}`,
              color: isPlaying ? '#22d3ee' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, transition: 'all 0.2s',
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div style={{ flex: 1 }}>
            <SliderRow label="Speed" value={speed} min={1} max={1000} step={1}
              format={v => `${v.toFixed(0)}×`}
              onChange={onSpeedChange} />
          </div>
        </div>
      </div>

      {/* UTC Time */}
      <div style={{ ...sectionStyle, borderBottom: 'none' }}>
        <div style={sectionHeader}>
          <span>◎</span> UTC TIME
        </div>
        <div style={{
          fontSize: 20, fontFamily: "'Share Tech Mono', monospace", color: '#22d3ee',
          letterSpacing: '0.05em', marginBottom: 8,
          textShadow: '0 0 8px rgba(34,211,238,0.4)',
        }}>
          {utcTime}
        </div>
        <button
          onClick={onLiveSync}
          style={{
            fontSize: 10, fontFamily: "'Orbitron', monospace", fontWeight: 600,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.4)', padding: '5px 10px', borderRadius: 4,
            cursor: 'pointer', letterSpacing: '0.08em', transition: 'all 0.2s',
          }}
          onMouseOver={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(34,211,238,0.4)';
            (e.currentTarget as HTMLButtonElement).style.color = '#22d3ee';
          }}
          onMouseOut={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)';
          }}
        >
          ↺ LIVE SYNC
        </button>
      </div>
    </div>
  );
}
