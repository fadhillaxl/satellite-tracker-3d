'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CCTVPanel from '@/components/CCTVPanel';
import { ArrowLeft, Radio, Camera, ShieldAlert, Cpu, Layers, Sun, Eye, Sliders, Play, Terminal } from 'lucide-react';

interface AgentTelemetry {
  rotator?: {
    connected: boolean;
    azimuth: number;
    elevation: number;
  };
  rig?: {
    connected: boolean;
    frequency: number;
    mode: string;
    bandwidth: number;
  };
}

export default function CCTVPage() {
  const router = useRouter();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  // Station Coordinates loaded from localStorage
  const [observerLat, setObserverLat] = useState<number>(-6.2088);
  const [observerLng, setObserverLng] = useState<number>(106.8456);
  const [observerAlt, setObserverAlt] = useState<number>(10);

  // Look angles and selected satellite name states
  const [lookAngles, setLookAngles] = useState<{ azimuth: number; elevation: number; range: number } | null>(null);
  const [activeSatName, setActiveSatName] = useState<string>('COSMOS 1680');

  // WebSocket Connection States
  const [agentOnline, setAgentOnline] = useState<boolean>(false);
  const [agentTelemetry, setAgentTelemetry] = useState<AgentTelemetry | null>(null);

  // CCTV PTZ & Image adjustment states
  const [contrast, setContrast] = useState(50);
  const [brightness, setBrightness] = useState(50);
  const [infrared, setInfrared] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [lensMode, setLensMode] = useState<'STANDARD' | 'WIDE' | 'TELEPHOTO'>('STANDARD');

  // Telemetry Log Box state
  const [logs, setLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Helper function to append telemetry logs
  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${msg}`, ...prev].slice(0, 40));
  };

  // Sync Observer Coordinates & Settings from LocalStorage
  useEffect(() => {
    try {
      const savedLat = localStorage.getItem('observer-lat');
      const savedLng = localStorage.getItem('observer-lng');
      const savedAlt = localStorage.getItem('observer-alt');
      if (savedLat) setObserverLat(parseFloat(savedLat));
      if (savedLng) setObserverLng(parseFloat(savedLng));
      if (savedAlt) setObserverAlt(parseFloat(savedAlt));
    } catch (e) {
      console.error('[CCTV Page] Failed to load observer credentials:', e);
    }

    addLog('System initialization complete.');
    addLog('RTSP HLS transcoder stream requested.');
    addLog('PTZ Camera connection active.');
  }, []);

  // WebSocket agent watcher
  useEffect(() => {
    let ws: WebSocket | null = null;
    let lastMessageTime = 0;

    function connect() {
      if (typeof window === 'undefined') return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsPort = process.env.NEXT_PUBLIC_WS_PORT || '3004';
      const wsPath = process.env.NEXT_PUBLIC_WS_PATH || '';
      const wsUrl = wsPath 
        ? `${protocol}//${window.location.host}${wsPath}` 
        : `${protocol}//${window.location.hostname}:${wsPort}`;

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setAgentOnline(true);
          addLog('Connected to Cloud Bridge Server on port ' + wsPort);
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'agentTelemetry') {
              setAgentTelemetry(data);
              setAgentOnline(true);
              lastMessageTime = Date.now();

              // Calculate look angles simulated telemetry
              if (data.rotator) {
                setLookAngles({
                  azimuth: data.rotator.azimuth,
                  elevation: data.rotator.elevation,
                  range: 852.4, // standard ISS range mock
                });
              }
            }
          } catch {}
        };

        ws.onclose = () => {
          setAgentOnline(false);
          addLog('WebSocket Connection closed. Retrying...');
          setTimeout(connect, 3000);
        };
      } catch (e) {
        setAgentOnline(false);
        setTimeout(connect, 3000);
      }
    }

    connect();

    const checkAlive = setInterval(() => {
      if (Date.now() - lastMessageTime > 3000) {
        setAgentOnline(false);
      }
    }, 1500);

    return () => {
      if (ws) ws.close();
      clearInterval(checkAlive);
    };
  }, []);

  // Periodic log generator to simulate telemetry activity
  useEffect(() => {
    const interval = setInterval(() => {
      const actions = [
        'Rotator tracking adjusted.',
        'HLS segments updated.',
        'Ping latency: ' + Math.round(18 + Math.random() * 8) + 'ms',
        'Bridge server heartbeat ok.',
        'AGC (Automatic Gain Control) calibrated.',
      ];
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      addLog(randomAction);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="dashboard-container" style={{ padding: '20px', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      
      {/* ── Top Bar ── */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderRadius: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.back()} className="btn-tech flex items-center gap-1.5" style={{ height: '36px', padding: '0 14px', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            BACK TO TARGET TRACKER
          </button>
          <Link href="/all" className="btn-tech" style={{ height: '36px', padding: '0 14px', textDecoration: 'none', color: '#22d3ee', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
            VIEW ALL (3D)
          </Link>
          <Link href="/rotator" className="btn-tech" style={{ height: '36px', padding: '0 14px', textDecoration: 'none', color: '#22d3ee', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
            ROTATOR
          </Link>
          <Link href="/radio" className="btn-tech" style={{ height: '36px', padding: '0 14px', textDecoration: 'none', color: '#22d3ee', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
            RADIO
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 className="tech-font text-base font-bold tracking-wider text-white" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Camera className="w-4 h-4 text-cyan-400" />
              GROUND STATION CCTV COCKPIT
            </h1>
            <span className="text-[10px] text-secondary uppercase tracking-widest mt-0.5">
              Live Antenna Feeds & PTZ Telemetry Cockpit
            </span>
          </div>
        </div>

        {/* Global Connection Badges */}
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`pulse-dot ${agentOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: '8px', height: '8px', backgroundColor: agentOnline ? '#10b981' : '#ef4444', boxShadow: agentOnline ? '0 0 8px #10b981' : '0 0 8px #ef4444' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="text-[8px] text-secondary uppercase">HARDWARE BRIDGE</span>
              <span className="mono-font text-xs font-semibold" style={{ color: agentOnline ? '#10b981' : '#ef4444' }}>
                {agentOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Layout Body Grid ── */}
      <div style={{ flex: 1, display: 'flex', gap: '16px', overflow: 'hidden', minHeight: 0 }}>
        
        {/* Left Side: Large Player Panel */}
        <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
          <div className="glass-panel" style={{ flex: 1, padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            
            {/* Full Scale CCTV component wrapper */}
            <div style={{ width: '100%', maxWidth: '850px', margin: '0 auto' }}>
              <CCTVPanel
                satName={activeSatName}
                observerLat={observerLat}
                observerLng={observerLng}
                observerAlt={observerAlt}
                lookAngles={lookAngles}
                compact={false}
                onLog={addLog}
              />
            </div>
            
          </div>
        </div>

        {/* Right Side: Diagnostics & PTZ Controls */}
        <div style={{ width: '380px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flexShrink: 0 }}>
          
          {/* PTZ Console controllers */}
          <div className="glass-panel interactive-ui" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="tech-font text-xs text-cyan-400 font-bold tracking-wider" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders className="w-4 h-4 text-cyan-400" />
              PTZ & CAMERA CONTROLS
            </div>

            {/* Joystick / Pan/Tilt mock controls */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span className="mono-font text-[9px] text-slate-500 uppercase">Interactive Joystick Pan/Tilt</span>
              
              <div style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '50%', border: '1px solid rgba(0, 242, 254, 0.3)', background: 'rgba(2, 6, 23, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {/* Dpad directions */}
                <button onClick={() => addLog('Camera Slewing UP')} style={{ position: 'absolute', top: '4px', background: 'none', border: 'none', color: '#00f2fe', cursor: 'pointer', fontFamily: 'Share Tech Mono', fontSize: '9px' }}>UP</button>
                <button onClick={() => addLog('Camera Slewing DOWN')} style={{ position: 'absolute', bottom: '4px', background: 'none', border: 'none', color: '#00f2fe', cursor: 'pointer', fontFamily: 'Share Tech Mono', fontSize: '9px' }}>DN</button>
                <button onClick={() => addLog('Camera Slewing LEFT')} style={{ position: 'absolute', left: '6px', background: 'none', border: 'none', color: '#00f2fe', cursor: 'pointer', fontFamily: 'Share Tech Mono', fontSize: '9px' }}>LT</button>
                <button onClick={() => addLog('Camera Slewing RIGHT')} style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', color: '#00f2fe', cursor: 'pointer', fontFamily: 'Share Tech Mono', fontSize: '9px' }}>RT</button>
                
                {/* Center stick */}
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#00f2fe', boxShadow: '0 0 10px rgba(0,242,254,0.6)', cursor: 'grab' }} />
              </div>
            </div>

            {/* Contrast / Brightness adjusters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontFamily: 'Share Tech Mono' }}>
                  <span>CONTRAST</span>
                  <span>{contrast}%</span>
                </div>
                <input type="range" min="0" max="100" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} style={{ width: '100%', accentColor: '#00f2fe', cursor: 'pointer' }} />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontFamily: 'Share Tech Mono' }}>
                  <span>BRIGHTNESS</span>
                  <span>{brightness}%</span>
                </div>
                <input type="range" min="0" max="100" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} style={{ width: '100%', accentColor: '#00f2fe', cursor: 'pointer' }} />
              </div>
            </div>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

            {/* Video overlay options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                onClick={() => {
                  setInfrared(!infrared);
                  addLog(infrared ? 'Infrared Night Vision Disabled' : 'Infrared Night Vision Enabled');
                }}
                className={`btn-tech ${infrared ? 'btn-tech-active' : ''}`}
                style={{ fontSize: '9px', justifyContent: 'center', height: '28px' }}
              >
                <Eye size={12} />
                IR NIGHT: {infrared ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`btn-tech ${showGrid ? 'btn-tech-active' : ''}`}
                style={{ fontSize: '9px', justifyContent: 'center', height: '28px' }}
              >
                <Layers size={12} />
                RETICLE GRID
              </button>
            </div>

            {/* Lens select */}
            <div>
              <span className="mono-font text-[9px] text-slate-500 uppercase block marginBottom: '4px'">Optics Lens Select</span>
              <div style={{ display: 'flex', border: '1px solid rgba(0, 242, 254, 0.2)', borderRadius: '6px', overflow: 'hidden' }}>
                {(['STANDARD', 'WIDE', 'TELEPHOTO'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setLensMode(mode);
                      addLog(`Lens optics adjusted to: ${mode}`);
                    }}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: lensMode === mode ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                      color: lensMode === mode ? '#fff' : 'rgba(255,255,255,0.4)',
                      fontSize: '8px',
                      fontFamily: 'Orbitron',
                      padding: '6px 0',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Terminal Console Logs box */}
          <div className="glass-panel interactive-ui" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: '200px' }}>
            <div className="tech-font text-xs text-cyan-400 font-bold tracking-wider" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Terminal className="w-4 h-4 text-cyan-400" />
              STATION BRIDGE SYSTEM LOGS
            </div>

            <div
              style={{
                flex: 1,
                background: '#02040b',
                border: '1px solid rgba(0, 242, 254, 0.15)',
                borderRadius: '8px',
                padding: '10px',
                fontFamily: 'Share Tech Mono',
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.75)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column-reverse',
                gap: '6px',
                lineHeight: '1.4',
              }}
            >
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    color: log.includes('error') || log.includes('closed')
                      ? '#f87171'
                      : log.includes('Connected') || log.includes('complete')
                      ? '#34d399'
                      : 'rgba(255,255,255,0.65)',
                  }}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </main>
  );
}
