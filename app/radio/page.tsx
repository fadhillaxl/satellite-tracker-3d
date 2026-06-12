'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Pencil, Trash2, RotateCcw, Save, X,
  Settings, WifiOff, ChevronUp, ChevronDown, Activity, Radio,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface RadioConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  defaultMode: string;
  defaultBw: number;
}

const MODES = ['FM', 'USB', 'LSB', 'AM', 'CW', 'RTTY'];

const DEFAULT_FORM: Omit<RadioConfig, 'id'> = {
  name: '',
  host: 'localhost',
  port: 4532,
  defaultMode: 'FM',
  defaultBw: 15000,
};

const LS_KEY = 'radio-configs';

/* ─── Sub-components ─────────────────────────────────────────────────────── */

/** Numeric spinner with + / – buttons */
function Spinner({
  value, onChange, step = 1, min = 1, max = 65535,
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
          width: '74px',
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

/** Analog S-Meter (Signal Strength) SVG */
function SMeter({ level }: { level: number }) {
  const cx = 90, cy = 80, r = 70;
  // level is 0 to 15 (S1 to S9+30dB)
  const clampedVal = Math.max(0, Math.min(15, level));
  // Map value to angle: 0 (S0) -> -60 deg, 15 (S9+30dB) -> +60 deg
  const angleDeg = -60 + (clampedVal / 15) * 120;
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  
  const needleX = cx + (r - 10) * Math.cos(angleRad);
  const needleY = cy + (r - 10) * Math.sin(angleRad);

  return (
    <svg width="180" height="95" style={{ display: 'block', margin: '0 auto', overflow: 'visible' }}>
      {/* Background scale arc */}
      <path d="M 29.3 45 A 70 70 0 0 1 150.7 45" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
      {/* Red Zone (S9 to S9+30) */}
      <path d="M 110.6 24.3 A 70 70 0 0 1 150.7 45" fill="none" stroke="#f43f5e" strokeWidth="4" />

      {/* Tick Marks */}
      {Array.from({ length: 16 }).map((_, i) => {
        const tickAng = -60 + (i / 15) * 120;
        const tickRad = ((tickAng - 90) * Math.PI) / 180;
        const x1 = cx + r * Math.cos(tickRad);
        const y1 = cy + r * Math.sin(tickRad);
        const x2 = cx + (r - (i % 3 === 0 ? 8 : 4)) * Math.cos(tickRad);
        const y2 = cy + (r - (i % 3 === 0 ? 8 : 4)) * Math.sin(tickRad);
        
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={i >= 10 ? '#f43f5e' : 'rgba(0,242,254,0.5)'}
            strokeWidth={i % 3 === 0 ? 1.5 : 0.8} />
        );
      })}

      {/* Needle */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#00f2fe" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={5} fill="#00f2fe" />

      {/* Scale labels */}
      <text x="20" y="58" fill="rgba(255,255,255,0.3)" fontSize="8" fontFamily="Share Tech Mono">S0</text>
      <text x="106" y="15" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Share Tech Mono">S9</text>
      <text x="160" y="58" fill="#f43f5e" fontSize="8" fontFamily="Share Tech Mono">+30</text>
      <text x={cx} y={75} textAnchor="middle" fill="#00f2fe" fontSize="10" fontWeight="bold" fontFamily="Orbitron">
        {clampedVal < 10 ? `S${Math.round(clampedVal)}` : `S9 +${Math.round((clampedVal - 9) * 10)}dB`}
      </text>
    </svg>
  );
}

/** Scrolling RF Waterfall Canvas */
function RFWaterfall({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = 0;

    // Set initial canvas sizing
    canvas.width = 240;
    canvas.height = 80;

    // Fill black
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const step = (timestamp: number) => {
      animId = requestAnimationFrame(step);

      if (timestamp - lastTime < 100) return; // limit to 10fps
      lastTime = timestamp;

      // 1. Shift canvas content down
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height - 1);
      ctx.putImageData(imgData, 0, 1);

      // 2. Generate new row of RF noise + signals
      const newRow = ctx.createImageData(canvas.width, 1);
      for (let x = 0; x < canvas.width; x++) {
        // Base thermal noise
        let val = Math.random() * 30;

        if (active) {
          // Add a couple of simulated satellite signals
          const signal1 = Math.exp(-Math.pow(x - 80, 2) / 6) * 180;
          const signal2 = Math.exp(-Math.pow(x - 160, 2) / 15) * 120;
          // Slowly drift signals to look dynamic
          const drift1 = Math.sin(timestamp / 3000) * 10;
          const signalDrift1 = Math.exp(-Math.pow(x - (80 + drift1), 2) / 4) * 200;
          
          val += signal1 + signal2 + signalDrift1;
        }

        val = Math.min(255, val);

        const pixelIdx = x * 4;
        if (val < 50) {
          // Deep space noise (blue)
          newRow.data[pixelIdx] = 2;              // R
          newRow.data[pixelIdx + 1] = 6;          // G
          newRow.data[pixelIdx + 2] = val * 0.7;  // B
        } else if (val < 150) {
          // Moderate signal (green-cyan)
          newRow.data[pixelIdx] = 0;
          newRow.data[pixelIdx + 1] = val * 0.9;
          newRow.data[pixelIdx + 2] = val * 0.8;
        } else {
          // High intensity signal (white/magenta peak)
          newRow.data[pixelIdx] = val * 0.95;
          newRow.data[pixelIdx + 1] = val * 0.2;
          newRow.data[pixelIdx + 2] = val * 0.9;
        }
        newRow.data[pixelIdx + 3] = 255;          // Alpha
      }

      ctx.putImageData(newRow, 0, 0);
    };

    animId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [active]);

  return (
    <div style={{ background: '#02040a', borderRadius: '6px', border: '1px solid rgba(0,242,254,0.15)', overflow: 'hidden', padding: '2px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '80px', display: 'block' }} />
    </div>
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
export default function RadioPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<RadioConfig[]>(() => {
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
  const [form, setForm] = useState<Omit<RadioConfig, 'id'>>({ ...DEFAULT_FORM });

  const previewConfig = configs.find(r => r.id === selectedId) ?? null;

  // Live telemetry states
  const [agentOnline, setAgentOnline] = useState<boolean>(false);
  const [agentTelemetry, setAgentTelemetry] = useState<{
    rotator: { connected: boolean; azimuth: number; elevation: number };
    rig: { connected: boolean; frequency: number; mode: string; bandwidth: number };
  } | null>(null);
  const [targetFreq, setTargetFreq] = useState<number>(145800000);
  const [sMeterVal, setSMeterVal] = useState<number>(3);
  
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let lastMessageTime = 0;

    function connect() {
      if (typeof window === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3004';
      const wsUrl = `${protocol}//${window.location.hostname}:${wsPort}`;
      console.log('[Radio UI] Connecting to cloud bridge at:', wsUrl);
      
      try {
        ws = new WebSocket(wsUrl);

        wsRef.current = ws;

        ws.onopen = () => {
          console.log('[Radio UI] Connected to cloud bridge');
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
        console.error('[Radio UI] WebSocket error:', e);
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

  // Fluctuating S-Meter signal strength simulation
  useEffect(() => {
    if (!agentOnline) return;
    const interval = setInterval(() => {
      setSMeterVal((prev) => {
        const diff = (Math.random() - 0.5) * 1.5;
        // Float around S5 for standard satellite pass
        const next = Math.max(1, Math.min(15, prev + diff));
        return next;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [agentOnline]);

  const sendWsCommand = (cmd: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === 1) { // 1 = OPEN
      wsRef.current.send(JSON.stringify(cmd));
    }
  };

  const persist = (updated: RadioConfig[]) => {
    setConfigs(updated);
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
    const r = configs.find(r => r.id === selectedId);
    if (!r) return;
    setEditingId(r.id);
    const rest = {
      name: r.name,
      host: r.host,
      port: r.port,
      defaultMode: r.defaultMode,
      defaultBw: r.defaultBw,
    };
    setForm(rest);
    setShowModal(true);
  };

  const handleDelete = () => {
    if (!selectedId) return;
    persist(configs.filter(r => r.id !== selectedId));
    setSelectedId(null);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      persist(configs.map(r => r.id === editingId ? { ...form, id: editingId } : r));
    } else {
      const newEntry = { ...form, id: `rad-${Date.now()}` };
      const updated = [...configs, newEntry];
      persist(updated);
      setSelectedId(newEntry.id);
    }
    setShowModal(false);
  };

  const selected = configs.find(r => r.id === selectedId) ?? null;

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
          <div>
            <h1 className="tech-font" style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.12em', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={15} style={{ color: '#00f2fe' }} />
              RADIO TRANSCEIVER CONFIGURATION
            </h1>
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', marginTop: '2px', textTransform: 'uppercase' }}>
              Transceiver controller · HAMLIB / rigctld interface
            </p>
          </div>
        </div>

        {/* Selected Config Status badge */}
        {selected && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(0,242,254,0.06)', border: '1px solid rgba(0,242,254,0.2)',
            borderRadius: '8px', padding: '8px 16px',
          }}>
            <WifiOff size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <div>
              <div className="tech-font" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>SELECTED CONFIG</div>
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
                  {['Config Name', 'Host', 'Port', 'Default Mode', 'Default Bandwidth'].map(h => (
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
                {configs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{
                      padding: '64px 20px', textAlign: 'center',
                      color: 'rgba(255,255,255,0.2)', fontSize: '12px',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}>
                      No radio configurations — click <strong style={{ color: '#00f2fe' }}>ADD NEW</strong> to create one
                    </td>
                  </tr>
                )}
                {configs.map(r => {
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
                      <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.65)', fontFamily: "'Share Tech Mono', monospace" }}>{r.defaultMode}</td>
                      <td style={{ padding: '11px 14px', color: 'rgba(255,255,255,0.65)', fontFamily: "'Share Tech Mono', monospace" }}>{r.defaultBw} Hz</td>
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
              className="btn-tech"
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
              {configs.length} config{configs.length !== 1 ? 's' : ''} · double-click to edit
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
              LIVE TRANSCEIVER LINK
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
              
              {/* Rig Daemon */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '9px' }}>TRANSCEIVER LINK:</span>
                <span className="mono-font" style={{ 
                  color: !agentOnline ? 'rgba(255,255,255,0.15)' : (agentTelemetry?.rig.connected ? '#10b981' : '#fbbf24') 
                }}>
                  {!agentOnline ? 'UNKNOWN' : (agentTelemetry?.rig.connected ? 'HARDWARE' : 'SIMULATED')}
                </span>
              </div>
            </div>

            {/* Live Telemetry Display */}
            {agentOnline && agentTelemetry ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* LCD Frequency Display */}
                <div style={{
                  background: '#040815', border: '2px solid rgba(0,242,254,0.35)', 
                  borderRadius: '8px', padding: '10px 14px', display: 'flex', 
                  flexDirection: 'column', gap: '2px', boxShadow: 'inset 0 0 10px rgba(0,242,254,0.15)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'rgba(0,242,254,0.5)', fontFamily: 'Orbitron', letterSpacing: '0.1em' }}>
                    <span>VFO-A</span>
                    <span>{agentTelemetry.rig.mode} / {agentTelemetry.rig.bandwidth}Hz</span>
                  </div>
                  <span className="mono-font" style={{ fontSize: '22px', fontWeight: 'bold', color: '#00f2fe', textShadow: '0 0 8px rgba(0,242,254,0.4)', letterSpacing: '0.05em' }}>
                    {(agentTelemetry.rig.frequency / 1e6).toFixed(4)} MHz
                  </span>
                </div>

                {/* S-Meter Visualizer */}
                <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', letterSpacing: '0.1em', marginBottom: '8px' }}>SIGNAL STRENGTH</div>
                  <SMeter level={sMeterVal} />
                </div>

                {/* Scrolling waterfall */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', letterSpacing: '0.1em' }}>LIVE BAND SPECTRUM</div>
                  <RFWaterfall active={agentOnline} />
                </div>

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

                {/* Slew Command Test */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="tech-font" style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>TRANSMIT FREQUENCY</div>
                  
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'Orbitron', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>
                      <span>FREQ CONTROL</span>
                      <span style={{ color: '#fbbf24' }}>{(targetFreq / 1e6).toFixed(3)} MHz</span>
                    </div>
                    <input 
                      type="range" min="144000000" max="146000000" step="12500" value={targetFreq} 
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
                padding: '24px 10px', display: 'flex', flexDirection: 'column',
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

          {/* Config Preview Panel */}
          <div className="glass-panel" style={{
            padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div className="tech-font" style={{
              fontSize: '9px', letterSpacing: '0.14em', color: 'rgba(0,242,254,0.6)',
              textTransform: 'uppercase', marginBottom: '4px'
            }}>
              Config Preview
            </div>

            {previewConfig ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Name badge */}
                <div className="mono-font" style={{
                  background: 'rgba(0,242,254,0.08)', border: '1px solid rgba(0,242,254,0.2)',
                  borderRadius: '6px', padding: '4px 12px', fontSize: '11px', color: '#00f2fe',
                  letterSpacing: '0.05em', alignSelf: 'flex-start'
                }}>{previewConfig.name}</div>

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

                {/* Details */}
                {[
                  ['Host IP', previewConfig.host],
                  ['Port', String(previewConfig.port)],
                  ['Default Mode', previewConfig.defaultMode],
                  ['Bandwidth', `${previewConfig.defaultBw} Hz`],
                ].map(([k, v]) => (
                  <div key={k} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontFamily: 'Orbitron', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</span>
                    <span className="mono-font" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.65)' }}>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.15)', textAlign: 'center', gap: '12px',
                padding: '20px 0'
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  border: '2px dashed rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Settings size={18} style={{ color: 'rgba(255,255,255,0.15)' }} />
                </div>
                <p style={{ fontSize: '10px', fontFamily: "'Share Tech Mono', monospace" }}>
                  Select a config to preview details
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
                {editingId ? 'EDIT RADIO CONFIGURATION' : 'NEW RADIO CONFIGURATION'}
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
                  placeholder="e.g. rooftop-transceiver"
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

              {/* Mode Select */}
              <Row label="Default Mode">
                <select value={form.defaultMode} onChange={e => field('defaultMode', e.target.value)} style={{
                  ...inputStyle, cursor: 'pointer',
                  background: 'rgba(2,6,23,0.85)',
                }}>
                  {MODES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Row>

              {/* Bandwidth Spinner */}
              <Row label="Bandwidth (Hz)">
                <Spinner value={form.defaultBw} onChange={v => field('defaultBw', v)} step={500} min={100} max={100000} />
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
