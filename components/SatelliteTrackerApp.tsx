'use client';

import React, { useEffect, useState, useRef, startTransition, useMemo } from 'react';
import Link from 'next/link';
import Header from './Header';
import TelemetryPanel from './TelemetryPanel';
import Map2D from './Map2D';
import { getSatellitePositionAtTime, getOrbitPath, getLookAngles, getUpcomingPasses, getCurrentPassBoundaries, PassBoundaries, getDopplerShift } from '@/utils/orbit';
import { RefreshCw, Search, ShieldAlert, Play, Pause } from 'lucide-react';

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
  line1: string;
  line2: string;
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

interface AppProps {
  initialNoradId: string;
}

export default function SatelliteTrackerApp({ initialNoradId }: AppProps) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const [noradId, setNoradId] = useState<string>(initialNoradId);
  const [satData, setSatData] = useState<SatelliteData | null>(null);
  console.log('[DEBUG] SatelliteTrackerApp render:', { noradId, satDataExists: !!satData });
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [orbitPoints, setOrbitPoints] = useState<{ x: number; y: number; z: number; lat: number; lng: number }[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'online' | 'error' | 'loading'>('loading');

  // Ground Station (Observer) States (Default: Jakarta, Indonesia)
  const [observerLat, setObserverLat] = useState<number>(-6.2088);
  const [observerLng, setObserverLng] = useState<number>(106.8456);
  const [observerAlt, setObserverAlt] = useState<number>(10); // meters
  
  // Look Angles State
  const [lookAngles, setLookAngles] = useState<{ azimuth: number; elevation: number; range: number } | null>(null);
  const [autoTrack, setAutoTrack] = useState<boolean>(false);
  const [agentOnline, setAgentOnline] = useState<boolean>(false);
  const [agentTelemetry, setAgentTelemetry] = useState<AgentTelemetry | null>(null);
  const [currentPassBoundaries, setCurrentPassBoundaries] = useState<PassBoundaries | null>(null);
  const [frequencies, setFrequencies] = useState<SatelliteFrequency[]>([]);
  const [selectedNominalFrequency, setSelectedNominalFrequency] = useState<number>(145800000);
  const [autoTuneDoppler, setAutoTuneDoppler] = useState<boolean>(false);
  const [dopplerOffset, setDopplerOffset] = useState<number>(0);
  const [dopplerCompensatedFreq, setDopplerCompensatedFreq] = useState<number>(145800000);

  // Calculate upcoming passes when satellite TLE or ground station changes
  const upcomingPasses = useMemo<SatellitePass[]>(() => {
    if (!satData) return [];
    return getUpcomingPasses(
      satData.line1,
      satData.line2,
      new Date(),
      observerLat,
      observerLng,
      observerAlt
    );
  }, [satData, observerLat, observerLng, observerAlt]);

  // Fetch satellite transmitter frequencies from SatNOGS proxy
  useEffect(() => {
    let active = true;
    async function fetchFrequencies() {
      setFrequencies([]);
      try {
        const res = await fetch(`${basePath}/api/satellite/${noradId}/frequencies`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setFrequencies(data);
            if (data.length > 0) {
              setSelectedNominalFrequency(data[0].frequency);
            } else {
              setSelectedNominalFrequency(145800000); // fallback
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch frequencies:', e);
      }
    }
    fetchFrequencies();
    return () => {
      active = false;
    };
  }, [noradId]);

  // Simulation Time Multipliers (Controlled globally from parent app)
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1); // Default to 1x real-time
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Refs for animation loop closure
  const observerLatRef = useRef<number>(-6.2088);
  const observerLngRef = useRef<number>(106.8456);
  const observerAltRef = useRef<number>(10);
  const autoTrackRef = useRef<boolean>(false);
  const selectedNominalFrequencyRef = useRef<number>(145800000);
  const autoTuneDopplerRef = useRef<boolean>(false);
  const lastTrackingSendTimeRef = useRef<number>(0);
  const lastDopplerSendTimeRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const satellitePositionRef = useRef<{ lat: number; lng: number; alt: number } | null>(null);
  const lastStateUpdateTimeRef = useRef<number>(0);
  const lastOrbitUpdateTimeRef = useRef<number>(0);
  const lastBoundariesUpdateTimeRef = useRef<number>(0);
  const hasActiveBoundariesRef = useRef<boolean>(false);

  // Sync refs to prevent animation frame stale closures
  useEffect(() => { observerLatRef.current = observerLat; }, [observerLat]);
  useEffect(() => { observerLngRef.current = observerLng; }, [observerLng]);
  useEffect(() => { observerAltRef.current = observerAlt; }, [observerAlt]);
  useEffect(() => { autoTrackRef.current = autoTrack; }, [autoTrack]);
  useEffect(() => { selectedNominalFrequencyRef.current = selectedNominalFrequency; }, [selectedNominalFrequency]);
  useEffect(() => { autoTuneDopplerRef.current = autoTuneDoppler; }, [autoTuneDoppler]);

  // Connect to WS Cloud Bridge
  useEffect(() => {
    let ws: WebSocket | null = null;
    let lastMessageTime = 0;
    let destroyed = false;
    let retryDelay = 3000; // start at 3s, doubles each attempt, capped at 30s

    function connect() {
      if (destroyed || typeof window === 'undefined') return;
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
          retryDelay = 3000; // reset backoff on successful connect
          console.log('[Tracker UI] Connected to cloud bridge');
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'agentTelemetry') {
              setAgentTelemetry(data);
              setAgentOnline(true);
              lastMessageTime = Date.now();
            }
          } catch {}
        };

        ws.onclose = () => {
          setAgentOnline(false);
          wsRef.current = null;
          if (!destroyed) {
            setTimeout(connect, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 30000); // exponential backoff, max 30s
          }
        };
      } catch {
        if (!destroyed) {
          setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30000);
        }
      }
    }

    connect();

    const keepAliveTimer = setInterval(() => {
      if (Date.now() - lastMessageTime > 3000) {
        setAgentOnline(false);
      }
    }, 1000);

    return () => {
      destroyed = true;
      if (ws) ws.close();
      clearInterval(keepAliveTimer);
    };
  }, []);


  const sendWsCommand = (cmd: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === 1) { // 1 = OPEN
      wsRef.current.send(JSON.stringify(cmd));
    }
  };
  const speedMultiplierRef = useRef<number>(1);
  const isPausedRef = useRef<boolean>(false);
  const lastSimTimeRef = useRef<number>(0);
  const lastRealTimeRef = useRef<number>(0);

  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  // Fetch satellite TLE data
  useEffect(() => {
    console.log('[DEBUG] fetchSatelliteData useEffect triggered, noradId:', noradId);
    let active = true;

    async function fetchSatelliteData() {
      setIsLoading(true);
      setError(null);
      setApiStatus('loading');
      setTelemetry(null);
      setOrbitPoints([]);

      try {
        const res = await fetch(`${basePath}/api/satellite/${noradId}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `HTTP error ${res.status}`);
        }

        const data: SatelliteData = await res.json();
        if (active) {
          console.log('[DEBUG] fetchSatelliteData calling setSatData with:', data.name);
          setSatData(data);
          setApiStatus('online');
          setIsLoading(false);
          
          // Initialize simulation clocks
          lastSimTimeRef.current = Date.now();
          lastRealTimeRef.current = performance.now();
        }
      } catch (err: unknown) {
        console.error('Error fetching satellite elements:', err);
        if (active) {
          const errMsg = err instanceof Error ? err.message : 'Failed to fetch satellite data';
          setError(errMsg);
          setApiStatus('error');
          setIsLoading(false);
        }
      }
    }

    fetchSatelliteData();

    return () => {
      active = false;
    };
  }, [noradId]);

  // Unified Real-Time SGP4 Orbit Propagation Loop
  useEffect(() => {
    console.log('[DEBUG] propagation useEffect triggered, satData:', satData?.name);
    if (!satData) return;

    // Initialize simulation clocks if they are 0
    if (lastSimTimeRef.current === 0) {
      lastSimTimeRef.current = Date.now();
    }
    if (lastRealTimeRef.current === 0) {
      lastRealTimeRef.current = performance.now();
    }

    let animationFrameId: number;
    
    // Reset throttled update timers on satellite change to trigger rendering immediately
    lastStateUpdateTimeRef.current = 0;
    lastOrbitUpdateTimeRef.current = 0;
    lastBoundariesUpdateTimeRef.current = 0;
    hasActiveBoundariesRef.current = false;

    // 1. Initial orbit path line calculation
    const initialPoints = getOrbitPath(
      satData.line1,
      satData.line2,
      new Date(lastSimTimeRef.current),
      satData.periodMinutes
    );
    setOrbitPoints(initialPoints);

    // 2. Real-time animation step
    const step = (timestamp: number) => {
      animationFrameId = requestAnimationFrame(step);

      const nowRealTime = performance.now();
      const dtMs = nowRealTime - lastRealTimeRef.current;
      lastRealTimeRef.current = nowRealTime;

      // Determine the simulation date
      let simDate: Date;
      if (isPausedRef.current) {
        // Paused state preserves simulation clock
        simDate = new Date(lastSimTimeRef.current);
      } else if (speedMultiplierRef.current === 1) {
        // Real-time wall-clock sync
        simDate = new Date();
        lastSimTimeRef.current = simDate.getTime();
      } else {
        // Time acceleration offset
        const nextTime = lastSimTimeRef.current + dtMs * speedMultiplierRef.current;
        simDate = new Date(nextTime);
        lastSimTimeRef.current = nextTime;
      }

      // Propagate position at simDate
      const pos = getSatellitePositionAtTime(satData.line1, satData.line2, simDate);

       if (pos) {
        // Update high-frequency ref for 3D Globe to bypass React rendering throttle
        satellitePositionRef.current = {
          lat: pos.lat,
          lng: pos.lng,
          alt: pos.alt
        };

        // Throttled UI state updates to 200ms for high performance with fluid SVGs
        if (timestamp - lastStateUpdateTimeRef.current > 200 || lastStateUpdateTimeRef.current === 0) {
          const look = getLookAngles(
            satData.line1,
            satData.line2,
            simDate,
            observerLatRef.current,
            observerLngRef.current,
            observerAltRef.current
          );
          setTelemetry({
            lat: pos.lat,
            lng: pos.lng,
            alt: pos.alt,
            velocity: pos.velocity,
            timeString: simDate.toLocaleTimeString(),
          });
          setLookAngles(look);
          
          if (look && look.elevation > 0) {
            // Only update pass boundaries once every 15 seconds to prevent heavy search loops
            if (!hasActiveBoundariesRef.current || timestamp - lastBoundariesUpdateTimeRef.current > 15000) {
              const boundaries = getCurrentPassBoundaries(
                satData.line1,
                satData.line2,
                simDate,
                observerLatRef.current,
                observerLngRef.current,
                observerAltRef.current
              );
              setCurrentPassBoundaries(boundaries);
              hasActiveBoundariesRef.current = !!boundaries;
              lastBoundariesUpdateTimeRef.current = timestamp;
            }
          } else {
            setCurrentPassBoundaries(null);
            hasActiveBoundariesRef.current = false;
            lastBoundariesUpdateTimeRef.current = 0;
          }

          // Calculate Doppler shift values for the UI
          const doppler = getDopplerShift(
            satData.line1,
            satData.line2,
            simDate,
            observerLatRef.current,
            observerLngRef.current,
            observerAltRef.current,
            selectedNominalFrequencyRef.current
          );
          if (doppler) {
            setDopplerOffset(doppler.offsetHz);
            setDopplerCompensatedFreq(doppler.dopplerFrequencyHz);
          }
          
          lastStateUpdateTimeRef.current = timestamp;
        }

        // Auto-track Rotator (throttled to 1Hz)
        if (autoTrackRef.current && timestamp - lastTrackingSendTimeRef.current > 1000) {
          const look = getLookAngles(
            satData.line1,
            satData.line2,
            simDate,
            observerLatRef.current,
            observerLngRef.current,
            observerAltRef.current
          );
          if (look) {
            sendWsCommand({
              type: 'setRotator',
              azimuth: look.azimuth,
              elevation: Math.max(0, look.elevation) // Keep elevation >= 0
            });
          }
          lastTrackingSendTimeRef.current = timestamp;
        }

        // Auto-tune Radio Transceiver Doppler Shift (throttled to 1Hz)
        if (autoTuneDopplerRef.current && timestamp - lastDopplerSendTimeRef.current > 1000) {
          const doppler = getDopplerShift(
            satData.line1,
            satData.line2,
            simDate,
            observerLatRef.current,
            observerLngRef.current,
            observerAltRef.current,
            selectedNominalFrequencyRef.current
          );
          if (doppler) {
            sendWsCommand({
              type: 'setRig',
              frequency: doppler.dopplerFrequencyHz
            });
          }
          lastDopplerSendTimeRef.current = timestamp;
        }

        // Periodically update the orbit path ring (once every 8 seconds) to account for Earth's rotation
        if (timestamp - lastOrbitUpdateTimeRef.current > 8000 || lastOrbitUpdateTimeRef.current === 0) {
          const updatedPoints = getOrbitPath(
            satData.line1,
            satData.line2,
            simDate,
            satData.periodMinutes
          );
          setOrbitPoints(updatedPoints);
          lastOrbitUpdateTimeRef.current = timestamp;
        }
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [satData]);


  // Sync URL search params
  const handleSearch = (id: string) => {
    startTransition(() => {
      setNoradId(id);
      if (typeof window !== 'undefined') {
        const newUrl = `${window.location.pathname}?norad-id=${id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
      }
    });
  };

  const handleTuneFrequency = (freqHz: number) => {
    sendWsCommand({
      type: 'setRig',
      frequency: freqHz
    });
  };

  return (
    <div className="dashboard-container">
      {/* HUD UI Header Overlay */}
      <div className="ui-overlay" style={{ position: 'relative', height: '100%', pointerEvents: 'none' }}>
        {/* Top Header */}
        <Header
          currentId={noradId}
          onSearch={handleSearch}
          isLoading={isLoading}
          apiStatus={apiStatus}
        />

        {/* Sidebar and Map Main Area */}
        <div className="app-main-layout" style={{ marginTop: '16px' }}>
          {/* Left Hand Telemetry */}
          {!error && satData && (
            <TelemetryPanel 
              telemetry={telemetry} 
              satData={satData} 
              lookAngles={lookAngles}
              observerLat={observerLat}
              observerLng={observerLng}
              observerAlt={observerAlt}
              setObserverLat={setObserverLat}
              setObserverLng={setObserverLng}
              setObserverAlt={setObserverAlt}
              autoTrack={autoTrack}
              setAutoTrack={setAutoTrack}
              agentOnline={agentOnline}
              agentTelemetry={agentTelemetry}
              upcomingPasses={upcomingPasses}
              currentPassBoundaries={currentPassBoundaries}
              frequencies={frequencies}
              onTuneFrequency={handleTuneFrequency}
              selectedNominalFrequency={selectedNominalFrequency}
              setSelectedNominalFrequency={setSelectedNominalFrequency}
              autoTuneDoppler={autoTuneDoppler}
              setAutoTuneDoppler={setAutoTuneDoppler}
              dopplerOffset={dopplerOffset}
              dopplerCompensatedFreq={dopplerCompensatedFreq}
            />
          )}

          {/* Center Map/Globe Area */}
          {!error && satData && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', position: 'relative' }} className="interactive-ui">
              {/* Map/Globe View Mode Conditional Render */}
              <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: '400px' }}>
                  <Map2D
                    line1={satData.line1}
                    line2={satData.line2}
                    periodMinutes={satData.periodMinutes}
                    satelliteName={satData.name}
                    telemetry={telemetry}
                    orbitPoints={orbitPoints}
                  />
              </div>

              {/* HUD Control Overlay (Simulation speed and View Mode switcher) */}
              <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderRadius: '12px', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* View Mode Toggle Tabs */}
                  <div style={{ display: 'flex', borderRight: '1px solid rgba(255, 255, 255, 0.15)', paddingRight: '16px', gap: '8px' }}>
                    <button
                      className="btn-tech btn-tech-active"
                      style={{ fontSize: '10px', height: '36px' }}
                    >
                      2D MAP
                    </button>
                    <Link
                      href="/all"
                      className="btn-tech text-cyan-400"
                      style={{ fontSize: '10px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: '1px solid rgba(0, 242, 254, 0.3)' }}
                    >
                      VIEW ALL (3D)
                    </Link>
                    <Link
                      href="/rotator"
                      className="btn-tech text-cyan-400"
                      style={{ fontSize: '10px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: '1px solid rgba(0, 242, 254, 0.3)' }}
                    >
                      ROTATOR
                    </Link>
                    <Link
                      href="/radio"
                      className="btn-tech text-cyan-400"
                      style={{ fontSize: '10px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: '1px solid rgba(0, 242, 254, 0.3)' }}
                    >
                      RADIO
                    </Link>
                  </div>

                  {/* Play/Pause simulation */}
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="btn-tech"
                    style={{ width: '40px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {isPaused ? <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" /> : <Pause className="w-4 h-4 text-cyan-400 fill-cyan-400" />}
                  </button>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="tech-font text-[10px] uppercase text-secondary">Simulation Engine:</span>
                    <span className="mono-font text-cyan-400 text-sm font-semibold">
                      {isPaused ? 'PAUSED' : `ACTIVE (${speedMultiplier}x)`}
                    </span>
                  </div>
                </div>

                {/* Speed Multiplier selectors */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => { setSpeedMultiplier(1); setIsPaused(false); }}
                    className={`btn-tech ${speedMultiplier === 1 && !isPaused ? 'btn-tech-active' : ''}`}
                    title="Real-Time Clock Speed"
                  >
                    1x (Real-Time)
                  </button>
                  <button
                    onClick={() => { setSpeedMultiplier(10); setIsPaused(false); }}
                    className={`btn-tech ${speedMultiplier === 10 && !isPaused ? 'btn-tech-active' : ''}`}
                    title="10x Simulation Speed"
                  >
                    10x
                  </button>
                  <button
                    onClick={() => { setSpeedMultiplier(100); setIsPaused(false); }}
                    className={`btn-tech ${speedMultiplier === 100 && !isPaused ? 'btn-tech-active' : ''}`}
                    title="100x Simulation Speed"
                  >
                    100x
                  </button>
                  <button
                    onClick={() => { setSpeedMultiplier(1000); setIsPaused(false); }}
                    className={`btn-tech ${speedMultiplier === 1000 && !isPaused ? 'btn-tech-active' : ''}`}
                    title="1000x Simulation Speed"
                  >
                    1000x
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Fallback Loading HUD */}
          {isLoading && !satData && (
            <div className="hud-panel-center glass-panel interactive-ui" style={{ margin: 'auto' }}>
              <div className="cyber-loader"></div>
              <div>
                <h3 className="tech-font text-sm font-bold text-cyan-400">PROPAGATING TARGET</h3>
                <p className="text-[10px] text-secondary uppercase tracking-wider" style={{ marginTop: '4px' }}>
                  Initializing orbital vector matrix...
                </p>
              </div>
            </div>
          )}

          {/* Fallback Error HUD */}
          {error && !isLoading && (
            <div className="hud-panel-center glass-panel interactive-ui" style={{ margin: 'auto', maxWidth: '440px' }}>
              <ShieldAlert className="w-12 h-12 text-rose-500 animate-pulse" />
              <div>
                <h3 className="tech-font text-base font-bold text-rose-400">PROPAGATION FAILURE</h3>
                <p className="text-xs text-secondary mt-1.5 leading-relaxed" style={{ marginTop: '6px' }}>
                  Could not retrieve general perturbation elements for catalog ID <span className="text-primary font-bold">{noradId}</span>.
                </p>
                <p className="text-[10px] text-muted uppercase" style={{ marginTop: '12px' }}>
                  Reason: {error}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => handleSearch(noradId)}
                  className="btn-tech"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> RETRY
                </button>
                <button
                  onClick={() => handleSearch('16011')}
                  className="btn-tech"
                >
                  <Search className="w-3.5 h-3.5" /> LOAD DEFAULT (COSMOS 1680)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
