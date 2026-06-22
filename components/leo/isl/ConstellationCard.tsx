'use client';

import { useState, useId } from 'react';
import { CONSTELLATION_COLORS, ConstellationColor } from '@/lib/leo/islCompute';

export interface ConstellationConfig {
  id: string;
  name: string;
  satellites: number;
  orbital_planes: number;
  inclination: number;
  altitude: number;
  colorIdx: number;
}

interface Props {
  config: ConstellationConfig;
  colorIdx: number;
  onUpdate: (cfg: ConstellationConfig) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function SliderRow({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>
        <span>{label}</span>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", color: '#22d3ee' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: 2, accentColor: '#22d3ee', cursor: 'pointer' }} />
    </div>
  );
}

export default function ConstellationCard({ config, colorIdx, onUpdate, onRemove, canRemove }: Props) {
  const [expanded, setExpanded] = useState(true);
  const color: ConstellationColor = CONSTELLATION_COLORS[colorIdx % CONSTELLATION_COLORS.length];

  const update = (partial: Partial<ConstellationConfig>) => onUpdate({ ...config, ...partial });

  return (
    <div style={{
      border: `1px solid ${color.asc}30`,
      borderRadius: 8,
      background: 'rgba(0,0,0,0.3)',
      marginBottom: 8,
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          cursor: 'pointer', borderBottom: expanded ? `1px solid ${color.asc}18` : 'none',
          background: `${color.asc}08`,
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color.asc, flexShrink: 0, boxShadow: `0 0 6px ${color.asc}` }} />
        <input
          value={config.name}
          onClick={e => e.stopPropagation()}
          onChange={e => update({ name: e.target.value })}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#fff', fontSize: 11, fontFamily: "'Orbitron',monospace", fontWeight: 600,
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'Share Tech Mono',monospace" }}>
            {config.satellites}S·{config.orbital_planes}P·{config.altitude}km
          </span>
          {canRemove && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.5)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
            >
              ×
            </button>
          )}
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded sliders */}
      {expanded && (
        <div style={{ padding: '10px 12px' }}>
          <SliderRow label="Satellites" value={config.satellites} min={50} max={2000} step={1}
            onChange={v => update({ satellites: v })} />
          <SliderRow label="Orbital Planes" value={config.orbital_planes} min={1} max={50} step={1}
            onChange={v => update({ orbital_planes: v })} />
          <SliderRow label="Inclination (°)" value={config.inclination} min={0} max={90} step={1}
            onChange={v => update({ inclination: v })} />
          <SliderRow label="Altitude (km)" value={config.altitude} min={200} max={2000} step={10}
            format={v => `${v} km`}
            onChange={v => update({ altitude: v })} />
        </div>
      )}
    </div>
  );
}
