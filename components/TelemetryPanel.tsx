'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Compass, Gauge, Landmark, Orbit, ShieldAlert, Sliders, Timer, TrendingUp, Zap, Radio, Settings, Info, Camera, ChevronUp, ChevronDown } from 'lucide-react';
import CCTVPanel from './CCTVPanel';

interface TelemetryData {
  lat: number;
  lng: number;
  alt: number;
  velocity: number;
  timeString: string;
}

interface SatelliteData {
  name: string;
  noradId: string;
  intlDes: string;
  epochYear: number;
  epochDay: number;
  inclination: number;
  eccentricity: number;
  meanMotion: number;
  periodMinutes: number;
  launchYear: number;
}

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

interface SatelliteFrequency {
  uuid: string;
  frequency: number;
  description: string;
  mode: string;
  service: string;
  baud?: number | null;
}

interface SatellitePass {
  aos: Date;
  los: Date;
  maxElevation: number;
  durationMinutes: number;
}

interface TelemetryPanelProps {
  telemetry: TelemetryData | null;
  satData: SatelliteData | null;
  lookAngles: { azimuth: number; elevation: number; range: number } | null;
  observerLat: number;
  observerLng: number;
  observerAlt: number;
  setObserverLat: (lat: number) => void;
  setObserverLng: (lng: number) => void;
  setObserverAlt: (alt: number) => void;
  autoTrack: boolean;
  setAutoTrack: (track: boolean) => void;
  agentOnline: boolean;
  agentTelemetry: AgentTelemetry | null;
  upcomingPasses: SatellitePass[];
  currentPassBoundaries: { aos: Date; los: Date } | null;
  frequencies: SatelliteFrequency[];
  onTuneFrequency?: (freqHz: number) => void;
  selectedNominalFrequency: number;
  setSelectedNominalFrequency: (freq: number) => void;
  autoTuneDoppler: boolean;
  setAutoTuneDoppler: (tune: boolean) => void;
  dopplerOffset: number;
  dopplerCompensatedFreq: number;
}

// ─── Virtual Scroll for SatNOGS Frequency List ───────────────────────────────
// Row height must be fixed so we can calculate total scroll height without
// rendering every item. We keep a 2-row overscan above and below the viewport.
const ROW_HEIGHT = 64; // px per transmitter card (padding + content + gap)
const LIST_HEIGHT = 240; // px – visible scroll window
const OVERSCAN = 2; // extra rows above/below viewport

interface FrequencyVirtualListProps {
  frequencies: SatelliteFrequency[];
  onTuneFrequency?: (freqHz: number) => void;
  setSelectedNominalFrequency: (freq: number) => void;
}

function FrequencyVirtualList({
  frequencies,
  onTuneFrequency,
  setSelectedNominalFrequency,
}: FrequencyVirtualListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Throttle scroll updates to one per animation frame
  const onScroll = useCallback(() => {
    if (rafRef.current !== null) return; // already scheduled
    rafRef.current = requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollTop(containerRef.current.scrollTop);
      }
      rafRef.current = null;
    });
  }, []);

  // Cancel pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const totalHeight = frequencies.length * ROW_HEIGHT;

  // Calculate which slice is visible
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(LIST_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(frequencies.length, startIndex + visibleCount);
  const visibleItems = frequencies.slice(startIndex, endIndex);
  const offsetY = startIndex * ROW_HEIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="tech-font text-[11px] font-bold text-amber-400/85 tracking-widest uppercase" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio className="w-3.5 h-3.5 text-amber-400" /> SATNOGS ACTIVE TRANSMITTERS
        </h3>
        <span className="mono-font" style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)' }}>
          {frequencies.length} records
        </span>
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        onScroll={onScroll}
        style={{
          height: `${LIST_HEIGHT}px`,
          overflowY: 'auto',
          position: 'relative',
          paddingRight: '4px',
          // Custom scrollbar
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(245,158,11,0.3) transparent',
        }}
      >
        {/* Full-height spacer that creates the correct scroll range */}
        <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
          {/* Only the visible slice is rendered, offset to its correct position */}
          <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
            {visibleItems.map((freq) => (
              <div
                key={freq.uuid}
                onClick={() => {
                  setSelectedNominalFrequency(freq.frequency);
                  if (onTuneFrequency) onTuneFrequency(freq.frequency);
                }}
                style={{
                  height: `${ROW_HEIGHT - 6}px`, // 6px gap
                  marginBottom: '6px',
                  background: 'rgba(245, 158, 11, 0.04)',
                  border: '1px solid rgba(245, 158, 11, 0.12)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: onTuneFrequency ? 'pointer' : 'default',
                  transition: 'background 0.15s ease-in-out, border-color 0.15s ease-in-out',
                  boxSizing: 'border-box',
                }}
                className="hover-tune-card"
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '65%', overflow: 'hidden' }}>
                  <span
                    style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={freq.description}
                  >
                    {freq.description}
                  </span>
                  <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                    {freq.mode} • {freq.service} {freq.baud ? `• ${freq.baud}b` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                  <span className="mono-font text-amber-400 font-bold" style={{ fontSize: '11px' }}>
                    {(freq.frequency / 1e6).toFixed(4)} MHz
                  </span>
                  {onTuneFrequency && (
                    <span style={{ fontSize: '7px', color: 'rgba(245, 158, 11, 0.5)', marginTop: '2px', textTransform: 'uppercase', fontFamily: 'Orbitron' }}>
                      Click to Tune
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function TelemetryPanel({
  telemetry,
  satData,
  lookAngles,
  observerLat,
  observerLng,
  observerAlt,
  setObserverLat,
  setObserverLng,
  setObserverAlt,
  autoTrack,
  setAutoTrack,
  agentOnline,
  agentTelemetry,
  upcomingPasses,
  currentPassBoundaries,
  frequencies,
  onTuneFrequency,
  selectedNominalFrequency,
  setSelectedNominalFrequency,
  autoTuneDoppler,
  setAutoTuneDoppler,
  dopplerOffset,
  dopplerCompensatedFreq,
}: TelemetryPanelProps) {
  const [altHistory, setAltHistory] = useState<number[]>([]);
  const [velHistory, setVelHistory] = useState<number[]>([]);
  const [showObserverConfig, setShowObserverConfig] = useState<boolean>(false);
  const [customFreqStr, setCustomFreqStr] = useState<string | null>(null);
  const [showCctv, setShowCctv] = useState<boolean>(false);

  // Accumulate telemetry history for real-time SVG charts
  useEffect(() => {
    if (telemetry) {
      requestAnimationFrame(() => {
        setAltHistory(prev => {
          const next = [...prev, telemetry.alt];
          return next.slice(-30); // Keep last 30 points
        });
        setVelHistory(prev => {
          const next = [...prev, telemetry.velocity];
          return next.slice(-30); // Keep last 30 points
        });
      });
    }
  }, [telemetry]);

  // Reset history when satellite changes
  useEffect(() => {
    requestAnimationFrame(() => {
      setAltHistory([]);
      setVelHistory([]);
    });
  }, [satData?.noradId]);

  if (!satData) {
    return (
      <div className="glass-panel w-full md:w-96 p-6 flex flex-col items-center justify-center text-center gap-4 interactive-ui min-h-[400px]">
        <ShieldAlert className="w-12 h-12 text-rose-500 animate-pulse" />
        <div>
          <h3 className="tech-font text-base font-bold text-primary">NO SATELLITE SELECTED</h3>
          <p className="text-xs text-secondary mt-1">Please enter a valid NORAD Catalog ID to begin propagation.</p>
        </div>
      </div>
    );
  }

  // Format Helper Functions
  const formatLat = (lat: number) => {
    const dir = lat >= 0 ? 'N' : 'S';
    return `${Math.abs(lat).toFixed(4)}° ${dir}`;
  };

  const formatLng = (lng: number) => {
    const dir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lng).toFixed(4)}° ${dir}`;
  };

  const formatPassTime = (date: Date) => {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    
    if (d.getDate() === today.getDate() && d.getMonth() === today.getMonth()) {
      return `Today ${timeStr}`;
    } else if (d.getDate() === tomorrow.getDate() && d.getMonth() === tomorrow.getMonth()) {
      return `Tomw ${timeStr}`;
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}, ${timeStr}`;
    }
  };

  // SVG Chart Path Helper
  const getSvgPath = (data: number[], width: number, height: number) => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min === 0 ? 1 : max - min;
    
    // Pad margins slightly
    const padMin = min - range * 0.1;
    const padMax = max + range * 0.1;
    const padRange = padMax - padMin;

    const points = data.map((val, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((val - padMin) / padRange) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return `M ${points.join(' L ')}`;
  };

  return (
    <aside className="telemetry-sidebar interactive-ui">
      {/* Header Info */}
      <div className="border-b border-slate-800/80 pb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="pulse-dot"></span>
            <span className="tech-font text-xs font-bold text-cyan-400">ACTIVE TRACK</span>
          </div>
          <span className="mono-font text-[10px] bg-slate-900 border border-slate-800" style={{ padding: '2px 8px', borderRadius: '4px', color: 'hsl(var(--text-secondary))' }}>
            ID: {satData.noradId}
          </span>
        </div>
        <h2 className="tech-font text-xl font-extrabold text-primary tracking-wide mt-2 truncate" title={satData.name}>
          {satData.name}
        </h2>
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }} className="text-[10px] text-secondary mono-font">
          <div>DES: <span className="text-primary">{satData.intlDes}</span></div>
          <div>LAUNCHED: <span className="text-primary">{satData.launchYear}</span></div>
        </div>
      </div>

      {/* Real-time Telemetry Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 className="tech-font text-[11px] font-bold text-cyan-400/80 tracking-widest uppercase" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders className="w-3.5 h-3.5" /> LIVE TELEMETRY
        </h3>

        <div className="grid-cols-2">
          {/* Latitude */}
          <div className="telemetry-card">
            <div className="text-[10px] text-secondary uppercase font-medium" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Compass className="w-3 h-3 text-cyan-400" /> LATITUDE
            </div>
            <div className="tech-font text-sm font-bold text-primary" style={{ marginTop: '8px' }}>
              {telemetry ? formatLat(telemetry.lat) : '---'}
            </div>
          </div>

          {/* Longitude */}
          <div className="telemetry-card">
            <div className="text-[10px] text-secondary uppercase font-medium" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Compass className="w-3 h-3 text-cyan-400" /> LONGITUDE
            </div>
            <div className="tech-font text-sm font-bold text-primary" style={{ marginTop: '8px' }}>
              {telemetry ? formatLng(telemetry.lng) : '---'}
            </div>
          </div>

          {/* Altitude */}
          <div className="telemetry-card">
            <div className="text-[10px] text-secondary uppercase font-medium" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Orbit className="w-3 h-3 text-cyan-400" /> ALTITUDE
            </div>
            <div className="tech-font text-sm font-bold text-cyan-300" style={{ marginTop: '8px' }}>
              {telemetry ? `${telemetry.alt.toFixed(2)} km` : '---'}
            </div>
          </div>

          {/* Velocity */}
          <div className="telemetry-card">
            <div className="text-[10px] text-secondary uppercase font-medium" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Gauge className="w-3 h-3 text-cyan-400" /> VELOCITY
            </div>
            <div className="tech-font text-sm font-bold text-cyan-300" style={{ marginTop: '8px' }}>
              {telemetry ? `${telemetry.velocity.toFixed(3)} km/s` : '---'}
            </div>
          </div>
        </div>

        {/* Dynamic Altitude / Velocity Sparks */}
        {telemetry && (
          <div className="text-[10px] text-muted" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
            <span>EPOCH MATCH TIME:</span>
            <span className="mono-font text-primary">{telemetry.timeString}</span>
          </div>
        )}
      </div>

      {/* Antenna Look Angles & Rotator Tracking */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
        <h3 className="tech-font text-[11px] font-bold text-cyan-400/80 tracking-widest uppercase" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass className="w-3.5 h-3.5" /> ANTENNA LOOK ANGLES
          </span>
          <span className={`text-[9px] mono-font ${lookAngles && lookAngles.elevation > 0 ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`}>
            {lookAngles && lookAngles.elevation > 0 ? '● AOS' : '○ LOS'}
          </span>
        </h3>

        <div className="grid-cols-2">
          {/* Azimuth */}
          <div className="telemetry-card" style={{ border: autoTrack && agentOnline ? '1px solid rgba(0, 242, 254, 0.3)' : undefined }}>
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron' }}>AZIMUTH</span>
            <span className="mono-font text-cyan-400" style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>
              {lookAngles ? `${lookAngles.azimuth.toFixed(2)}°` : '---'}
            </span>
            {agentOnline && agentTelemetry && agentTelemetry.rotator && (
              <span className="mono-font text-[9px]" style={{ color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px' }}>
                Rotator: <span style={{ color: '#00f2fe' }}>{agentTelemetry.rotator.azimuth.toFixed(1)}°</span>
              </span>
            )}
          </div>

          {/* Elevation */}
          <div className="telemetry-card" style={{ border: autoTrack && agentOnline ? '1px solid rgba(0, 242, 254, 0.3)' : undefined }}>
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron' }}>ELEVATION</span>
            <span className={`mono-font ${lookAngles && lookAngles.elevation > 0 ? 'text-emerald-400' : 'text-slate-400'}`} style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px' }}>
              {lookAngles ? `${lookAngles.elevation.toFixed(2)}°` : '---'}
            </span>
            {agentOnline && agentTelemetry && agentTelemetry.rotator && (
              <span className="mono-font text-[9px]" style={{ color: 'rgba(255, 255, 255, 0.4)', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px' }}>
                Rotator: <span style={{ color: '#10b981' }}>{agentTelemetry.rotator.elevation.toFixed(1)}°</span>
              </span>
            )}
          </div>
        </div>

        {/* Active Signal Status Overlay */}
        {lookAngles && lookAngles.elevation > 0 && currentPassBoundaries && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '11px',
            marginTop: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="tech-font" style={{ color: '#10b981', fontWeight: 'bold', fontSize: '9px', letterSpacing: '0.05em' }}>● SIGNAL ACQUIRED (AOS)</span>
              <span className="animate-pulse" style={{ color: '#10b981', fontSize: '9px', fontWeight: 600 }}>ACTIVE PASS</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }} className="mono-font">
              <div>
                <span style={{ fontSize: '8px', color: 'rgba(16, 185, 129, 0.6)', display: 'block', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>AOS (Rise)</span>
                <span style={{ color: '#a7f3d0', fontWeight: 600 }}>{formatPassTime(currentPassBoundaries.aos)}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '8px', color: 'rgba(16, 185, 129, 0.6)', display: 'block', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>LOS (Set)</span>
                <span style={{ color: '#a7f3d0', fontWeight: 600 }}>{formatPassTime(currentPassBoundaries.los)}</span>
              </div>
            </div>
          </div>
        )}

        {lookAngles && lookAngles.elevation <= 0 && upcomingPasses && upcomingPasses.length > 0 && (
          <div style={{
            background: 'rgba(2, 6, 23, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            fontSize: '11px',
            marginTop: '4px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="tech-font" style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', fontSize: '9px', letterSpacing: '0.05em' }}>○ SIGNAL LOST (LOS)</span>
              <span style={{ color: '#38bdf8', fontSize: '9px', fontWeight: 600 }}>NEXT PASS</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }} className="mono-font">
              <div>
                <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.3)', display: 'block', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>NEXT AOS</span>
                <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{formatPassTime(upcomingPasses[0].aos)}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.3)', display: 'block', textTransform: 'uppercase', fontFamily: 'sans-serif' }}>MAX ELEVATION</span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{upcomingPasses[0].maxElevation.toFixed(1)}°</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Transceiver Frequency Status */}
        {agentOnline && agentTelemetry && agentTelemetry.rig && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.15)',
            borderRadius: '8px',
            padding: '8px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            marginTop: '4px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '8px', color: 'rgba(245, 158, 11, 0.6)', fontFamily: 'Orbitron', letterSpacing: '0.05em' }}>TRANSCEIVER VFO</span>
              <span className="mono-font font-bold text-amber-400" style={{ fontSize: '13px', marginTop: '2px' }}>
                {(agentTelemetry.rig.frequency / 1e6).toFixed(4)} MHz
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)' }}>
              <span>MODE: <strong style={{ color: '#fbbf24' }} className="uppercase">{agentTelemetry.rig.mode || 'N/A'}</strong></span>
              <span style={{ fontSize: '8px', marginTop: '2px' }}>BW: {agentTelemetry.rig.bandwidth ? `${(agentTelemetry.rig.bandwidth / 1000).toFixed(1)} kHz` : 'N/A'}</span>
            </div>
          </div>
        )}

        {/* Tracking Button & Bridge Status */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <button
            onClick={() => setAutoTrack(!autoTrack)}
            className={`btn-tech ${autoTrack ? 'btn-tech-active' : ''}`}
            style={{ fontSize: '9px', padding: '6px 12px', flex: 1, justifyContent: 'center' }}
          >
            <Radio className={`w-3.5 h-3.5 ${autoTrack && agentOnline ? 'animate-pulse text-cyan-400' : ''}`} />
            {autoTrack ? 'AUTO-TRACKING: ACTIVE' : 'AUTO-TRACK ROTATOR'}
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '9px' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'Orbitron', fontSize: '7px' }}>HARDWARE BRIDGE</span>
            <span className="mono-font" style={{ color: agentOnline ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {agentOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>

        {/* Collapsible Observer Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            onClick={() => setShowObserverConfig(!showObserverConfig)}
            style={{
              background: 'none', border: 'none', color: 'rgba(0, 242, 254, 0.6)',
              fontSize: '10px', fontFamily: 'Orbitron', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px', padding: '0 4px',
              alignSelf: 'flex-start'
            }}
          >
            <Settings className="w-3 h-3" /> 
            {showObserverConfig ? 'Hide Station Config' : 'Show Station Config'}
          </button>

          {showObserverConfig && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '8px', 
              background: 'rgba(0,0,0,0.25)', padding: '12px', borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)', marginTop: '4px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', display: 'block', marginBottom: '4px' }}>LATITUDE (°)</span>
                  <input
                    type="number" step="0.0001" value={observerLat}
                    onChange={(e) => setObserverLat(parseFloat(e.target.value) || 0)}
                    className="input-tech" style={{ padding: '6px 10px', fontSize: '11px', width: '100%', fontFamily: 'Share Tech Mono' }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', display: 'block', marginBottom: '4px' }}>LONGITUDE (°)</span>
                  <input
                    type="number" step="0.0001" value={observerLng}
                    onChange={(e) => setObserverLng(parseFloat(e.target.value) || 0)}
                    className="input-tech" style={{ padding: '6px 10px', fontSize: '11px', width: '100%', fontFamily: 'Share Tech Mono' }}
                  />
                </div>
              </div>
              <div>
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', display: 'block', marginBottom: '4px' }}>ALTITUDE (METERS)</span>
                <input
                  type="number" value={observerAlt}
                  onChange={(e) => setObserverAlt(parseInt(e.target.value, 10) || 0)}
                  className="input-tech" style={{ padding: '6px 10px', fontSize: '11px', width: '100%', fontFamily: 'Share Tech Mono' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ground Station CCTV Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
        <button
          onClick={() => setShowCctv(!showCctv)}
          className="btn-tech"
          style={{
            width: '100%',
            justifyContent: 'space-between',
            fontSize: '9px',
            padding: '6px 12px',
            borderColor: showCctv ? 'rgba(0, 242, 254, 0.4)' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Camera className={`w-3.5 h-3.5 ${showCctv ? 'animate-pulse text-cyan-400' : ''}`} />
            <span>GROUND STATION CCTV</span>
          </div>
          {showCctv ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showCctv && (
          <CCTVPanel
            satName={satData.name}
            observerLat={observerLat}
            observerLng={observerLng}
            observerAlt={observerAlt}
            lookAngles={lookAngles}
            compact={true}
          />
        )}
      </div>

      {/* Radio Control & Doppler Compensation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
        <h3 className="tech-font text-[11px] font-bold text-amber-400/85 tracking-widest uppercase" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio className="w-3.5 h-3.5 text-amber-400" /> RADIO CONTROL (DOPPLER COMP)
        </h3>

        {/* Informational Tooltip / Explanation box requested by the user */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.02)',
          border: '1px dashed rgba(245, 158, 11, 0.2)',
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.55)',
          lineHeight: '1.45',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start'
        }}>
          <Info className="w-4 h-4 text-amber-400 shrink-0" style={{ marginTop: '1px' }} />
          <span>
            <strong>Info:</strong> Fitur Radio Control pada Gpredict bukanlah remote control untuk mainan RC, melainkan fitur untuk mengontrol Radio Komunikasi (Transceiver/Receiver). Fitur ini berfungsi untuk menyesuaikan frekuensi radio secara otomatis guna mengompensasi Doppler Shift (pergeseran frekuensi) saat melacak satelit yang sedang mengorbit.
          </span>
        </div>

        {/* Doppler State & Tuning display */}
        <div style={{
          background: 'rgba(2, 6, 23, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '8px' }}>NOMINAL FREQ</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="number"
                step="0.0001"
                value={customFreqStr !== null ? customFreqStr : (selectedNominalFrequency / 1e6).toFixed(4)}
                onChange={(e) => {
                  setCustomFreqStr(e.target.value);
                  const mhz = parseFloat(e.target.value);
                  if (!isNaN(mhz) && mhz > 0) {
                    const hz = Math.round(mhz * 1e6);
                    setSelectedNominalFrequency(hz);
                    if (onTuneFrequency) onTuneFrequency(hz);
                  }
                }}
                onBlur={() => {
                  setCustomFreqStr(null);
                }}
                className="input-tech mono-font"
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  width: '120px',
                  textAlign: 'right',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  background: 'rgba(2, 6, 23, 0.5)',
                  borderRadius: '4px',
                }}
              />
              <span className="mono-font text-[10px] text-secondary">MHz</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '8px' }}>DOPPLER SHIFT</span>
            <span className={`mono-font font-semibold ${dopplerOffset >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {dopplerOffset >= 0 ? '+' : ''}{(dopplerOffset / 1000).toFixed(3)} kHz
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Orbitron', fontSize: '8px' }}>COMPENSATED FREQ</span>
            <span className="mono-font text-amber-400 font-bold" style={{ fontSize: '13px' }}>
              {(dopplerCompensatedFreq / 1e6).toFixed(4)} MHz
            </span>
          </div>
        </div>

        {/* Auto Tune Doppler Toggle Switch */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <button
            onClick={() => setAutoTuneDoppler(!autoTuneDoppler)}
            className={`btn-tech ${autoTuneDoppler ? 'btn-tech-active' : ''}`}
            style={{ 
              fontSize: '9px', 
              padding: '6px 12px', 
              flex: 1, 
              justifyContent: 'center', 
              borderColor: autoTuneDoppler ? 'rgba(245, 158, 11, 0.4)' : undefined, 
              color: autoTuneDoppler ? '#fbbf24' : undefined 
            }}
          >
            <Radio className={`w-3.5 h-3.5 ${autoTuneDoppler && agentOnline ? 'animate-pulse text-amber-400' : ''}`} />
            {autoTuneDoppler ? 'AUTO-TUNE DOPPLER: ACTIVE' : 'AUTO-TUNE DOPPLER'}
          </button>
        </div>
      </div>

      {/* SatNOGS Frequencies Section – virtual scroll */}
      {frequencies && frequencies.length > 0 && (
        <FrequencyVirtualList
          frequencies={frequencies}
          onTuneFrequency={onTuneFrequency}
          setSelectedNominalFrequency={setSelectedNominalFrequency}
        />
      )}

      {/* Upcoming Passes Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
        <h3 className="tech-font text-[11px] font-bold text-cyan-400/80 tracking-widest uppercase" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Timer className="w-3.5 h-3.5" /> UPCOMING PASSES (AOS / LOS)
        </h3>

        {upcomingPasses && upcomingPasses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {upcomingPasses.map((pass, index) => (
              <div
                key={index}
                style={{
                  background: 'rgba(2, 6, 23, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '11px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'Orbitron' }}>AOS TIME</span>
                    <span className="mono-font text-primary font-bold">
                      {formatPassTime(pass.aos)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'Orbitron' }}>LOS TIME</span>
                    <span className="mono-font text-primary font-bold">
                      {formatPassTime(pass.los)}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px', marginTop: '2px' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)' }}>
                    DURATION: <strong className="text-cyan-400 font-semibold">{pass.durationMinutes}m</strong>
                  </div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)' }}>
                    MAX EL: <strong className="text-emerald-400 font-semibold">{pass.maxElevation.toFixed(1)}°</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '12px 10px', textAlign: 'center',
            color: 'rgba(255,255,255,0.2)', fontSize: '10px',
            fontFamily: "'Share Tech Mono', monospace",
            background: 'rgba(2,6,23,0.3)', borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.03)'
          }}>
            No passes predicted in the next 24 hours.
          </div>
        )}
      </div>

      {/* SVG Charts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
        <h3 className="tech-font text-[11px] font-bold text-cyan-400/80 tracking-widest uppercase" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp className="w-3.5 h-3.5" /> DYNAMIC TELEMETRY PLOTS
        </h3>

        {/* Altitude Chart */}
        <div className="profile-chart-container">
          <div className="text-[10px]" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="text-secondary font-medium uppercase">Altitude Profile</span>
            <span className="tech-font font-bold text-cyan-400">
              {telemetry ? `${Math.round(telemetry.alt)} km` : '---'}
            </span>
          </div>
          <div className="profile-chart-draw">
            {altHistory.length > 1 ? (
              <svg>
                <defs>
                  <linearGradient id="altGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#00f2fe" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                <path
                  d={`${getSvgPath(altHistory, 330, 60)} L 330,60 L 0,60 Z`}
                  fill="url(#altGlow)"
                />
                {/* Line */}
                <path
                  d={getSvgPath(altHistory, 330, 60)}
                  fill="none"
                  stroke="#00f2fe"
                  strokeWidth="1.8"
                />
              </svg>
            ) : (
              <span className="text-[10px] text-muted" style={{ margin: 'auto' }}>CALCULATING DATA...</span>
            )}
          </div>
        </div>

        {/* Velocity Chart */}
        <div className="profile-chart-container">
          <div className="text-[10px]" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span className="text-secondary font-medium uppercase">Velocity Profile</span>
            <span className="tech-font font-bold text-pink-400">
              {telemetry ? `${telemetry.velocity.toFixed(3)} km/s` : '---'}
            </span>
          </div>
          <div className="profile-chart-draw">
            {velHistory.length > 1 ? (
              <svg>
                <defs>
                  <linearGradient id="velGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff007f" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ff007f" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                <path
                  d={`${getSvgPath(velHistory, 330, 60)} L 330,60 L 0,60 Z`}
                  fill="url(#velGlow)"
                />
                {/* Line */}
                <path
                  d={getSvgPath(velHistory, 330, 60)}
                  fill="none"
                  stroke="#ff007f"
                  strokeWidth="1.8"
                />
              </svg>
            ) : (
              <span className="text-[10px] text-muted" style={{ margin: 'auto' }}>CALCULATING DATA...</span>
            )}
          </div>
        </div>
      </div>

      {/* Orbital Parameters Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
        <h3 className="tech-font text-[11px] font-bold text-cyan-400/80 tracking-widest uppercase" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Orbit className="w-3.5 h-3.5" /> ORBITAL MEAN ELEMENTS
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
          {/* Orbital Period */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Timer className="w-3 h-3 text-muted" /> Period</span>
            <span className="mono-font text-primary font-semibold">{satData.periodMinutes.toFixed(2)} min</span>
          </div>

          {/* Inclination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Zap className="w-3 h-3 text-muted" /> Inclination</span>
            <span className="mono-font text-primary font-semibold">{satData.inclination.toFixed(4)}°</span>
          </div>

          {/* Eccentricity */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Orbit className="w-3 h-3 text-muted" /> Eccentricity</span>
            <span className="mono-font text-primary font-semibold">{satData.eccentricity.toFixed(7)}</span>
          </div>

          {/* Mean Motion */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Orbit className="w-3 h-3 text-muted" /> Mean Motion</span>
            <span className="mono-font text-primary font-semibold">{satData.meanMotion.toFixed(8)} rev/day</span>
          </div>

          {/* Epoch Date */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '6px' }}>
            <span className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Landmark className="w-3 h-3 text-muted" /> Epoch Date</span>
            <span className="mono-font text-primary font-semibold" style={{ textAlign: 'right', maxWidth: '200px', lineHeight: 1.25 }}>
              Year {satData.epochYear}, Day {satData.epochDay.toFixed(4)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
