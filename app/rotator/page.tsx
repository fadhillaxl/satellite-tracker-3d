'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Pencil, Trash2, RotateCcw, Save, X,
  Settings, WifiOff, ChevronUp, ChevronDown, Activity,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface RotatorConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  azType: string;
  minAz: number;
  maxAz: number;
  minEl: number;
  maxEl: number;
  azEndStop: number;
}

const AZ_TYPES = [
  '0° → 180° → 360°',
  '0° → 360°',
  '-180° → 180°',
];

const DEFAULT_FORM: Omit<RotatorConfig, 'id'> = {
  name: '',
  host: 'localhost',
  port: 4533,
  azType: '0° → 180° → 360°',
  minAz: 0,
  maxAz: 360,
  minEl: 0,
  maxEl: 90,
  azEndStop: 0,
};

const LS_KEY = 'rotator-configs';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

/** Numeric spinner with + / – buttons */
function Spinner({
  value, onChange, step = 1, min = -180, max = 360,
}: {
  value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <input
        type="number"
        value={value}
        onChange={e => onChange(clamp(Number(e.target.value)))}
        style={{
          width: '64px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(0,242,254,0.3)',
          borderRadius: '4px',
          color: '#fff',
          padding: '5px 8px',
          fontSize: '12px',
          textAlign: 'center',
          outline: 'none',
          fontFamily: "'Share Tech Mono', monospace",
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button
          onClick={() => onChange(clamp(value + step))}
          style={{
            background: 'rgba(0,242,254,0.08)', border: '1px solid rgba(0,242,254,0.2)',
            borderRadius: '3px', color: '#00f2fe', width: '22px', height: '22px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><ChevronUp size={12} /></button>
        <button
          onClick={() => onChange(clamp(value - step))}
          style={{
            background: 'rgba(0,242,254,0.08)', border: '1px solid rgba(0,242,254,0.2)',
            borderRadius: '3px', color: '#00f2fe', width: '22px', height: '22px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        ><ChevronDown size={12} /></button>
      </div>
    </div>
  );
}

/** Azimuth compass preview */
function AzimuthCompass({ minAz, maxAz, azEndStop }: { minAz: number; maxAz: number; azEndStop: number }) {
  const cx = 90, cy = 90, r = 70, rInner = 50;
  const cardinals = [
    { deg: 0, label: 'N' }, { deg: 90, label: 'E' },
    { deg: 180, label: 'S' }, { deg: 270, label: 'W' },
  ];
  const arcPath = describeArc(cx, cy, r - 8, minAz, maxAz);
  const endStopPt = polar(cx, cy, r - 8, azEndStop);
  return (
    <svg width="180" height="180" style={{ display: 'block', margin: '0 auto' }}>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="rgba(0,0,0,0.3)" stroke="rgba(0,242,254,0.15)" strokeWidth="1" />
      {/* Tick marks */}
      {Array.from({ length: 36 }).map((_, i) => {
        const deg = i * 10;
        const outer = polar(cx, cy, r, deg);
        const inner = polar(cx, cy, r - (deg % 90 === 0 ? 10 : deg % 30 === 0 ? 7 : 4), deg);
        return (
          <line key={deg} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
            stroke={deg % 90 === 0 ? 'rgba(0,242,254,0.6)' : 'rgba(255,255,255,0.2)'}
            strokeWidth={deg % 90 === 0 ? 1.5 : 0.8} />
        );
      })}
      {/* Arc coverage */}
      <path d={arcPath} fill="none" stroke="#00ff66" strokeWidth="6" strokeLinecap="round" opacity="0.7" />
      {/* Inner fill */}
      <circle cx={cx} cy={cy} r={rInner} fill="rgba(2,6,23,0.6)" stroke="rgba(0,242,254,0.08)" strokeWidth="1" />
      {/* Cardinal labels */}
      {cardinals.map(({ deg, label }) => {
        const pt = polar(cx, cy, r - 18, deg);
        return (
          <text key={label} x={pt.x} y={pt.y + 4} textAnchor="middle"
            fill="#00f2fe" fontSize="10" fontFamily="Orbitron,monospace" fontWeight="600">
            {label}
          </text>
        );
      })}
      {/* End-stop marker */}
      <circle cx={endStopPt.x} cy={endStopPt.y} r={4} fill="#ff007f" stroke="#fff" strokeWidth="1" />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={4} fill="#00f2fe" />
    </svg>
  );
}

/** Elevation arc preview */
function ElevationArc({ minEl, maxEl }: { minEl: number; maxEl: number }) {
  const cx = 90, cy = 130, r = 80;
  const elToAngle = (el: number) => 180 - el; // 0° el → 180°, 90° el → 90°
  const arcPath = describeArc(cx, cy, r, elToAngle(maxEl), elToAngle(minEl));
  const minPt = polar(cx, cy, r, elToAngle(minEl));
  const maxPt = polar(cx, cy, r, elToAngle(maxEl));
  return (
    <svg width="180" height="140" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {/* Horizon line */}
      <line x1={10} y1={130} x2={170} y2={130} stroke="rgba(0,242,254,0.2)" strokeWidth="1" strokeDasharray="4 4" />
      {/* Background arc (full 0-90) */}
      <path d={describeArc(cx, cy, r, 90, 180)} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />
      {/* Active elevation arc */}
      <path d={arcPath} fill="none" stroke="#00f2fe" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
      {/* Min/Max markers */}
      <circle cx={minPt.x} cy={minPt.y} r={4} fill="#00f2fe" stroke="#fff" strokeWidth="1" />
      <circle cx={maxPt.x} cy={maxPt.y} r={4} fill="#00ff66" stroke="#fff" strokeWidth="1" />
      {/* Labels */}
      <text x={cx} y={118} textAnchor="middle" fill="rgba(0,242,254,0.5)" fontSize="9" fontFamily="Share Tech Mono">ZENITH</text>
      <text x={10} y={142} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="Share Tech Mono">0°</text>
      <text x={155} y={142} fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="Share Tech Mono">0°</text>
      <text x={minPt.x + 8} y={minPt.y + 4} fill="#00f2fe" fontSize="9" fontFamily="Share Tech Mono">{minEl}°</text>
      <text x={maxPt.x - 20} y={maxPt.y - 6} fill="#00ff66" fontSize="9" fontFamily="Share Tech Mono">{maxEl}°</text>
    </svg>
  );
}

/* ─── Field row for modal ──────────────────────────────────────────────────── */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', alignItems: 'center', gap: '12px' }}>
      <span style={{
        fontFamily: "'Orbitron', monospace", fontSize: '10px', color: 'rgba(255,255,255,0.45)',
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>{label}</span>
      {children}
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function RotatorPage() {
  const router = useRouter();
  const [rotators, setRotators] = useState<RotatorConfig[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<RotatorConfig, 'id'>>({ ...DEFAULT_FORM });

  const previewConfig = rotators.find(r => r.id === selectedId) ?? null;

  // WebSocket Agent Link States
  const [agentOnline, setAgentOnline] = useState<boolean>(false);
  const [agentTelemetry, setAgentTelemetry] = useState<{
    rotator: { connected: boolean; azimuth: number; elevation: number };
    rig: { connected: boolean; frequency: number; mode: string; bandwidth: number };
  } | null>(null);
  const [targetAz, setTargetAz] = useState<number>(0);
  const [targetEl, setTargetEl] = useState<number>(0);
  const [targetFreq, setTargetFreq] = useState<number>(145800000);
  
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to WS Cloud Bridge
  useEffect(() => {
    let ws: WebSocket | null = null;
    let lastMessageTime = 0;

    function connect() {
      if (typeof window === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3004';
      const wsUrl = `${protocol}//${window.location.hostname}:${wsPort}`;
      console.log('[Rotator UI] Connecting to cloud bridge at:', wsUrl);
      
      try {
        ws = new WebSocket(wsUrl);

        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[Rotator UI] Connected to cloud bridge');
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'agentTelemetry') {
              setAgentTelemetry(data);
              setAgentOnline(true);
              lastMessageTime = Date.now();
            }
          } catch {
            // Ignore non-json or non-telemetry broadcasts
          }
        };

        ws.onclose = () => {
          setAgentOnline(false);
          wsRef.current = null;
          setTimeout(connect, 3000);
        };
      } catch (e) {
        console.error('[Rotator UI] WebSocket error:', e);
        setTimeout(connect, 3000);
      }
    }

    connect();

    // Heartbeat check (3 seconds)
    const keepAliveTimer = setInterval(() => {
      if (Date.now() - lastMessageTime > 3000) {
        setAgentOnline(false);
      }
    }, 1000);

    return () => {
      if (ws) ws.close();
      clearInterval(keepAliveTimer);
    };
  }, []);

  const sendWsCommand = (cmd: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === 1) { // 1 = OPEN
      wsRef.current.send(JSON.stringify(cmd));
    }
  };

  const persist = (updated: RotatorConfig[]) => {
    setRotators(updated);
    try { localStorage.setItem(LS_KEY, JSON.stringify(updated)); } catch {}
  };

  const field = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...DEFAULT_FORM });
    setShowModal(true);
  };

  const openEdit = () => {
    const r = rotators.find(r => r.id === selectedId);
    if (!r) return;
    setEditingId(r.id);
    const rest = {
      name: r.name,
      host: r.host,
      port: r.port,
      azType: r.azType,
      minAz: r.minAz,
      maxAz: r.maxAz,
      minEl: r.minEl,
      maxEl: r.maxEl,
      azEndStop: r.azEndStop,
    };
    setForm(rest);
    setShowModal(true);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    persist(rotators.filter(r => r.id !== selectedId));
    setSelectedId(null);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      persist(rotators.map(r => r.id === editingId ? { ...form, id: editingId } : r));
    } else {
      const newEntry = { ...form, id: `rot-${Date.now()}` };
      const updated = [...rotators, newEntry];
      persist(updated);
      setSelectedId(newEntry.id);
    }
    setShowModal(false);
  };

  const selected = rotators.find(r => r.id === selectedId) ?? null;

  /* ── Shared input style */
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(0,242,254,0.25)',
    borderRadius: '6px',
    color: '#fff',
    padding: '7px 12px',
    fontSize: '12px',
    outline: 'none',
    width: '100%',
    fontFamily: "'Share Tech Mono', monospace",
  };

  return (
    <main className="dashboard-container" style={{ padding: '20px', gap: '0' }}>

      {/* ── Header ── */}
      <div className="app-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.back()} className="btn-tech" style={{ height: '34px', padding: '0 14px', gap: '6px', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft size={14} style={{ color: '#00f2fe' }} />
            BACK
          </button>
          <Link href="/all" className="btn-tech" style={{ height: '34px', padding: '0 14px', gap: '6px', textDecoration: 'none', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
            VIEW ALL (3D)
          </Link>
          <Link href="/radio" className="btn-tech" style={{ height: '34px', padding: '0 14px', gap: '6px', textDecoration: 'none', color: '#00f2fe', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
            RADIO CONFIG
          </Link>
          <div>
            <h1 className="tech-font" style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.12em', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={15} style={{ color: '#00f2fe' }} />
              ROTATOR CONFIGURATION
            </h1>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', marginTop: '2px', textTransform: 'uppercase' }}>
              Antenna rotator · HAMLIB / rotctld interface
            </p>
          </div>
        </div>

        {/* Connection badge */}
        {selected && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(0,242,254,0.06)', border: '1px solid rgba(0,242,254,0.2)',
            borderRadius: '8px', padding: '8px 16px',
          }}>
            <WifiOff size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <div>
              <div className="tech-font" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>SELECTED</div>
              <div className="mono-font" style={{ fontSize: '12px', color: '#00f2fe' }}>
                {selected.host}:{selected.port}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', gap: '16px', overflow: 'hidden', minHeight: 0 }}>

        {/* ─ Left: Table + Buttons ─ */}
        <div className="glass-panel" style={{
          flex: 1, borderRadius: '12px', padding: '20px',
          display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', minWidth: 0,
        }}>

          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  {['Config Name', 'Host', 'Port', 'Min Az', 'Max Az', 'Min El', 'Max El', 'Azimuth Type'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontFamily: "'Orbitron', monospace", fontSize: '9px', letterSpacing: '0.1em',
                      color: '#00f2fe', fontWeight: 600, textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(0,242,254,0.15)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rotators.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{
                      padding: '64px 20px', textAlign: 'center',
                      color: 'rgba(255,255,255,0.2)', fontSize: '12px',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      No rotator configurations — click <strong style={{ color: '#00f2fe' }}>ADD NEW</strong> to create one
                    </td>
                  </tr>
                )}
                {rotators.map(r => {
                  const isActive = r.id === selectedId;
                  return (
                    <tr key={r.id} onClick={() => setSelectedId(isActive ? null : r.id)}
                      onDoubleClick={openEdit}
                      style={{
                        background: isActive ? 'rgba(0,242,254,0.1)' : 'transparent',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s',
                      }}>
                      <td style={{ padding: '11px 14px', color: isActive ? '#00f2fe' : '#fff', fontWeight: isActive ? 600 : 400 }}>{r.name}</td>
                      <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.65)', fontFamily: "'Share Tech Mono', monospace" }}>{r.host}</td>
                      <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.65)', fontFamily: "'Share Tech Mono', monospace" }}>{r.port}</td>
                      <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.65)', fontFamily: "'Share Tech Mono', monospace" }}>{r.minAz}°</td>
                      <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.65)', fontFamily: "'Share Tech Mono', monospace" }}>{r.maxAz}°</td>
                      <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.65)', fontFamily: "'Share Tech Mono', monospace" }}>{r.minEl}°</td>
                      <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.65)', fontFamily: "'Share Tech Mono', monospace" }}>{r.maxEl}°</td>
                      <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.5)', fontFamily: "'Share Tech Mono', monospace", fontSize: '11px' }}>{r.azType}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Buttons */}
          <div style={{
            display: 'flex', gap: '8px', alignItems: 'center',
            paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <button onClick={openAdd} className="btn-tech" style={{ gap: '6px' }}>
              <Plus size={13} /> ADD NEW
            </button>
            <button
              onClick={openEdit}
              className={`btn-tech ${selected ? '' : ''}`}
              style={{ gap: '6px', opacity: selected ? 1 : 0.35, cursor: selected ? 'pointer' : 'not-allowed' }}
              disabled={!selected}
            >
              <Pencil size={13} /> EDIT
            </button>
            <button
              onClick={handleDelete}
              className="btn-tech"
              style={{
                gap: '6px', opacity: selected ? 1 : 0.35, cursor: selected ? 'pointer' : 'not-allowed',
                borderColor: selected ? 'rgba(255,60,60,0.35)' : undefined,
                color: selected ? '#ff4444' : undefined,
              }}
              disabled={!selected}
            >
              <Trash2 size={13} /> DELETE
            </button>
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: "'Share Tech Mono', monospace" }}>
              {rotators.length} config{rotators.length !== 1 ? 's' : ''} · double-click to edit
            </span>
          </div>
        </div>

        {/* ─ Right Side Panels ─ */}
        <div style={{
          width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto'
        }}>
          {/* Live Hardware Link Panel */}
          <div className="glass-panel interactive-ui" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="tech-font" style={{
              fontSize: '10px', letterSpacing: '0.14em', color: '#00f2fe',
              textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px'
            }}>
              <Activity size={13} className={agentOnline ? "animate-pulse" : ""} />
              LIVE HARDWARE LINK
            </div>

            {/* Connection States */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              {/* Agent Bridge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '9px' }}>AGENT BRIDGE:</span>
                <span className="mono-font" style={{ color: agentOnline ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                  {agentOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              
              {/* Rotator Daemon */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '9px' }}>ROTATOR LINK:</span>
                <span className="mono-font" style={{ 
                  color: !agentOnline ? 'rgba(255,255,255,0.15)' : (agentTelemetry?.rotator.connected ? '#10b981' : '#fbbf24') 
                }}>
                  {!agentOnline ? 'UNKNOWN' : (agentTelemetry?.rotator.connected ? 'HARDWARE' : 'SIMULATED')}
                </span>
              </div>

              {/* Rig Daemon */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '9px' }}>TRANSCEIVER:</span>
                <span className="mono-font" style={{ 
                  color: !agentOnline ? 'rgba(255,255,255,0.15)' : (agentTelemetry?.rig.connected ? '#10b981' : '#fbbf24') 
                }}>
                  {!agentOnline ? 'UNKNOWN' : (agentTelemetry?.rig.connected ? 'HARDWARE' : 'SIMULATED')}
                </span>
              </div>
            </div>

            {/* Live Telemetry Display */}
            {agentOnline && agentTelemetry ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {/* Azimuth Card */}
                  <div className="telemetry-card" style={{ padding: '8px', background: 'rgba(2, 6, 23, 0.4)' }}>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron' }}>AZIMUTH</span>
                    <span className="mono-font text-cyan-400" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {agentTelemetry.rotator.azimuth.toFixed(1)}°
                    </span>
                  </div>
                  {/* Elevation Card */}
                  <div className="telemetry-card" style={{ padding: '8px', background: 'rgba(2, 6, 23, 0.4)' }}>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron' }}>ELEVATION</span>
                    <span className="mono-font text-emerald-400" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                      {agentTelemetry.rotator.elevation.toFixed(1)}°
                    </span>
                  </div>
                </div>

                {/* Rig Card */}
                <div className="telemetry-card" style={{ padding: '8px', background: 'rgba(2, 6, 23, 0.4)', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron' }}>TRANSCEIVER FREQ</span>
                    <span className="mono-font text-yellow-400" style={{ fontSize: '15px', fontWeight: 'bold' }}>
                      {(agentTelemetry.rig.frequency / 1e6).toFixed(4)} MHz
                    </span>
                  </div>
                  <span style={{
                    fontSize: '9px', fontFamily: 'Orbitron', background: 'rgba(251,191,36,0.1)', 
                    color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)', padding: '2px 6px', borderRadius: '4px'
                  }}>
                    {agentTelemetry.rig.mode}
                  </span>
                </div>

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

                {/* Track Testing Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="tech-font" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>SLEW COMMAND TEST</div>
                  
                  {/* Azimuth Slew Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'Orbitron', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>
                      <span>TARGET AZ</span>
                      <span style={{ color: '#00f2fe' }}>{targetAz}°</span>
                    </div>
                    <input 
                      type="range" min="0" max="359" value={targetAz} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setTargetAz(val);
                        sendWsCommand({ type: 'setRotator', azimuth: val, elevation: targetEl });
                      }}
                      style={{ width: '100%', accentColor: '#00f2fe', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Elevation Slew Slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'Orbitron', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>
                      <span>TARGET EL</span>
                      <span style={{ color: '#00f2fe' }}>{targetEl}°</span>
                    </div>
                    <input 
                      type="range" min="0" max="90" value={targetEl} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setTargetEl(val);
                        sendWsCommand({ type: 'setRotator', azimuth: targetAz, elevation: val });
                      }}
                      style={{ width: '100%', accentColor: '#00f2fe', cursor: 'pointer' }}
                    />
                  </div>

                  {/* Rig frequency slider (144 - 146 MHz Ham Band) */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'Orbitron', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>
                      <span>TARGET FREQ</span>
                      <span style={{ color: '#fbbf24' }}>{(targetFreq / 1e6).toFixed(3)} MHz</span>
                    </div>
                    <input 
                      type="range" min="144000000" max="146000000" step="25000" value={targetFreq} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setTargetFreq(val);
                        sendWsCommand({ type: 'setRig', frequency: val });
                      }}
                      style={{ width: '100%', accentColor: '#fbbf24', cursor: 'pointer' }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '16px 10px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                color: 'rgba(255,255,255,0.25)', gap: '10px'
              }}>
                <WifiOff size={24} style={{ color: 'rgba(255,255,255,0.2)' }} />
                <p style={{ fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.5 }}>
                  Awaiting local agent telemetry...<br />
                  <span style={{ color: '#00f2fe' }}>Run the agent in terminal:</span><br />
                  <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 4px', borderRadius: '4px', display: 'inline-block', marginTop: '6px', fontSize: '9px' }}>
                    node local-agent/agent.js
                  </code>
                </p>
              </div>
            )}
          </div>

          {/* Coverage Preview Panel */}
          <div className="glass-panel" style={{
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '0', alignItems: 'center',
          }}>
            <div className="tech-font" style={{
              fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(0,242,254,0.6)',
              textTransform: 'uppercase', marginBottom: '16px', alignSelf: 'flex-start',
            }}>
              Coverage Preview
            </div>

            {previewConfig ? (
              <>
                {/* Name badge */}
                <div className="mono-font" style={{
                  background: 'rgba(0,242,254,0.08)', border: '1px solid rgba(0,242,254,0.2)',
                  borderRadius: '6px', padding: '4px 12px', fontSize: '11px', color: '#00f2fe',
                  marginBottom: '16px', letterSpacing: '0.05em',
                }}>{previewConfig.name}</div>

                {/* Azimuth compass */}
                <div style={{ marginBottom: '4px', width: '100%', textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Orbitron' }}>Azimuth</div>
                  <AzimuthCompass minAz={previewConfig.minAz} maxAz={previewConfig.maxAz} azEndStop={previewConfig.azEndStop} />
                  <div className="mono-font" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
                    {previewConfig.minAz}° – {previewConfig.maxAz}°
                  </div>
                </div>

                <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

                {/* Elevation arc */}
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px', fontFamily: 'Orbitron' }}>Elevation</div>
                  <ElevationArc minEl={previewConfig.minEl} maxEl={previewConfig.maxEl} />
                </div>

                <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', margin: '12px 0' }} />

                {/* Details */}
                {[
                  ['Az Type', previewConfig.azType],
                  ['End Stop', `${previewConfig.azEndStop}°`],
                  ['Port', String(previewConfig.port)],
                ].map(([k, v]) => (
                  <div key={k} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontFamily: 'Orbitron', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</span>
                    <span className="mono-font" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)' }}>{v}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.15)', textAlign: 'center', gap: '12px',
                padding: '40px 0'
              }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  border: '2px dashed rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Settings size={24} style={{ color: 'rgba(255,255,255,0.15)' }} />
                </div>
                <p style={{ fontSize: '10px', fontFamily: "'Share Tech Mono', monospace", lineHeight: 1.6 }}>
                  Select a config<br />to preview coverage
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, backdropFilter: 'blur(6px)',
        }}>
          <div className="glass-panel" style={{
            width: '480px', borderRadius: '14px', padding: '28px',
            border: '1px solid rgba(0,242,254,0.3)',
            boxShadow: '0 0 80px rgba(0,242,254,0.12)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h2 className="tech-font" style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', color: '#00f2fe' }}>
                {editingId ? 'EDIT ROTATOR CONFIGURATION' : 'NEW ROTATOR CONFIGURATION'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer', padding: '4px',
              }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Name */}
              <Row label="Name">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => field('name', e.target.value)}
                  placeholder="e.g. rooftop-rotator"
                  autoFocus
                  style={{
                    ...inputStyle,
                    borderColor: form.name ? 'rgba(0,242,254,0.4)' : 'rgba(255,80,80,0.5)',
                  }}
                />
              </Row>

              {/* Host */}
              <Row label="Host">
                <input type="text" value={form.host} onChange={e => field('host', e.target.value)} style={inputStyle} />
              </Row>

              {/* Port */}
              <Row label="Port">
                <Spinner value={form.port} onChange={v => field('port', v)} step={1} min={1} max={65535} />
              </Row>

              {/* Divider */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

              {/* Az Type */}
              <Row label="Az Type">
                <select value={form.azType} onChange={e => field('azType', e.target.value)} style={{
                  ...inputStyle, cursor: 'pointer',
                  background: 'rgba(2,6,23,0.85)',
                }}>
                  {AZ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Row>

              {/* Min / Max Az */}
              <Row label="Azimuth Range">
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', letterSpacing: '0.08em', marginBottom: '4px' }}>MIN AZ</div>
                    <Spinner value={form.minAz} onChange={v => field('minAz', v)} step={1} min={-180} max={360} />
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.2)', marginTop: '16px' }}>→</div>
                  <div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', letterSpacing: '0.08em', marginBottom: '4px' }}>MAX AZ</div>
                    <Spinner value={form.maxAz} onChange={v => field('maxAz', v)} step={1} min={0} max={360} />
                  </div>
                </div>
              </Row>

              {/* Min / Max El */}
              <Row label="Elevation Range">
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', letterSpacing: '0.08em', marginBottom: '4px' }}>MIN EL</div>
                    <Spinner value={form.minEl} onChange={v => field('minEl', v)} step={1} min={-90} max={90} />
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.2)', marginTop: '16px' }}>→</div>
                  <div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', letterSpacing: '0.08em', marginBottom: '4px' }}>MAX EL</div>
                    <Spinner value={form.maxEl} onChange={v => field('maxEl', v)} step={1} min={0} max={90} />
                  </div>
                </div>
              </Row>

              {/* Az End Stop */}
              <Row label="Az End Stop">
                <Spinner value={form.azEndStop} onChange={v => field('azEndStop', v)} step={1} min={-180} max={360} />
              </Row>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', gap: '8px',
              marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)',
            }}>
              <button onClick={() => setForm({ ...DEFAULT_FORM })} className="btn-tech" style={{ gap: '6px' }}>
                <RotateCcw size={12} /> CLEAR
              </button>
              <button onClick={() => setShowModal(false)} className="btn-tech">
                CANCEL
              </button>
              <button
                onClick={handleSave}
                className="btn-tech"
                style={{
                  gap: '6px',
                  borderColor: form.name ? 'rgba(0,242,254,0.5)' : 'rgba(255,255,255,0.1)',
                  color: form.name ? '#00f2fe' : 'rgba(255,255,255,0.3)',
                  cursor: form.name ? 'pointer' : 'not-allowed',
                  boxShadow: form.name ? '0 0 12px rgba(0,242,254,0.2)' : 'none',
                }}
                disabled={!form.name.trim()}
              >
                <Save size={12} /> OK
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
