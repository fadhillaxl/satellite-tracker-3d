'use client';

import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Play, Pause, VolumeX, Volume2, RefreshCw, Radio, Camera, ShieldAlert, Cpu } from 'lucide-react';

interface CCTVPanelProps {
  satName?: string;
  observerLat?: number;
  observerLng?: number;
  observerAlt?: number;
  lookAngles?: { azimuth: number; elevation: number; range: number } | null;
  compact?: boolean;
  onLog?: (msg: string) => void;
}

export default function CCTVPanel({
  satName = 'NO ACTIVE TARGET',
  observerLat = -6.2088,
  observerLng = 106.8456,
  observerAlt = 10,
  lookAngles = null,
  compact = false,
  onLog,
}: CCTVPanelProps) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const streamUrl = `${basePath}/cctv/stream.m3u8`;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [streamStatus, setStreamStatus] = useState<'offline' | 'loading' | 'online'>('loading');
  const [fps, setFps] = useState(30);
  const [bitrate, setBitrate] = useState(2.4); // Mbps
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [useRawPlayer, setUseRawPlayer] = useState(false);

  // Helper log functions that pipe to both console and onLog prop
  const log = (msg: string) => {
    console.log(msg);
    if (onLog) onLog(msg);
  };

  const warn = (msg: string, details?: any) => {
    console.warn(msg, details);
    if (onLog) {
      const detailStr = details ? ` (${details.message || details.details || JSON.stringify(details)})` : '';
      onLog(`[WARN] ${msg}${detailStr}`);
    }
  };

  // Sync state update for simulated FPS / Bitrate
  useEffect(() => {
    if (streamStatus !== 'online') return;
    const interval = setInterval(() => {
      setFps(Math.round(29.5 + Math.random()));
      setBitrate(parseFloat((2.2 + Math.random() * 0.4).toFixed(2)));
    }, 2000);
    return () => clearInterval(interval);
  }, [streamStatus]);

  // Sync HTML5 video muted DOM property directly to React state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Bind HTML5 video play/pause/waiting/playing DOM events to React state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setStreamStatus('loading');
    const handlePlaying = () => setStreamStatus('online');

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
    };
  }, []);

  const initPlayer = () => {
    const video = videoRef.current;
    if (!video) {
      warn('[CCTV] Player initialization aborted: video DOM reference not ready.');
      return;
    }

    // Destroy existing player if any
    if (hlsRef.current) {
      log('[CCTV] Destroying existing HLS player instance...');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setStreamStatus('loading');
    setErrorMsg(null);

    log(`[CCTV] Initializing player for stream URL: ${streamUrl}`);

    // Chrome/Firefox HLS.js support (checked first to match test.html)
    if (Hls.isSupported()) {
      log(`[CCTV] Using HLS.js library. Hls version: ${Hls.version}`);
      const hls = new Hls({
        maxLiveSyncPlaybackRate: 1.5,
        liveSyncDurationCount: 3,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        log('[CCTV] MANIFEST_PARSED event fired.');
        setStreamStatus('online');
        video.muted = isMuted;
        video.play()
          .then(() => {
            log('[CCTV] Playback started successfully.');
            setIsPlaying(true);
          })
          .catch((err) => {
            warn('[CCTV] Autoplay prevented, waiting for user interaction:', err);
            setIsPlaying(false);
          });
      });

      log('[CCTV] Loading stream source...');
      hls.loadSource(streamUrl);

      log('[CCTV] Attaching media element...');
      hls.attachMedia(video);

      hls.on(Hls.Events.ERROR, (event, data) => {
        warn('[CCTV HLS Error]', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              log('[CCTV] Network error, attempting recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              log('[CCTV] Media error, attempting recovery...');
              hls.recoverMediaError();
              break;
            default:
              setStreamStatus('offline');
              setErrorMsg(`Connection error: ${data.details || 'Feed Offline'}`);
              hls.destroy();
              hlsRef.current = null;
              break;
          }
        }
      });
    }
    // Native HLS support (Safari fallback)
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      log('[CCTV] Using browser native HLS support.');
      video.src = streamUrl;
      video.load();
      
      const handleLoadedMetadata = () => {
        log('[CCTV] Native player: loadedmetadata event.');
        setStreamStatus('online');
        video.muted = isMuted;
        video.play().then(() => {
          log('[CCTV] Native player: playback started.');
          setIsPlaying(true);
        }).catch((e) => {
          warn('[CCTV] Native player: play() blocked. Autoplay policy active:', e);
          setIsPlaying(false);
        });
      };
      
      const handleError = (e: any) => {
        warn('[CCTV] Native player error event:', e);
        setStreamStatus('offline');
        setErrorMsg('Ground Station feed offline or camera unreachable.');
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('error', handleError);

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('error', handleError);
      };
    } else {
      warn('[CCTV] Browser does not support HLS streaming.');
      setStreamStatus('offline');
      setErrorMsg('This browser does not support HLS streaming.');
    }
  };

  useEffect(() => {
    const cleanup = initPlayer();

    return () => {
      if (cleanup) cleanup();
      if (hlsRef.current) {
        log('[CCTV] Cleaning up HLS player instance on unmount...');
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, retryCount, useRawPlayer]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleRefresh = () => {
    setRetryCount(prev => prev + 1);
  };

  // Helper formatting coords
  const formatLat = (lat: number) => {
    const dir = lat >= 0 ? 'N' : 'S';
    return `${Math.abs(lat).toFixed(4)}° ${dir}`;
  };

  const formatLng = (lng: number) => {
    const dir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lng).toFixed(4)}° ${dir}`;
  };

  return (
    <div
      className="glass-panel interactive-ui"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: compact ? '10px' : '16px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(0, 242, 254, 0.15)',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* HUD Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Camera className="w-3.5 h-3.5 text-cyan-400" />
          <span className="tech-font text-[10px] font-bold tracking-wider text-white" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            CCTV MONITOR
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Share Tech Mono' }}>
              [JKT-CAM-01] {useRawPlayer ? '(RAW VIEW)' : ''}
            </span>
          </span>
        </div>

        {/* Pulse REC tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {streamStatus === 'online' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  backgroundColor: '#ef4444',
                  borderRadius: '50%',
                  display: 'inline-block',
                  boxShadow: '0 0 8px #ef4444',
                }}
                className="animate-pulse"
              />
              <span className="mono-font text-[8px] text-rose-500 font-bold" style={{ letterSpacing: '0.05em' }}>REC</span>
            </div>
          )}
          <span
            className="mono-font text-[8px] uppercase font-bold"
            style={{
              padding: '2px 6px',
              borderRadius: '4px',
              border: `1px solid ${
                streamStatus === 'online'
                  ? 'rgba(16, 185, 129, 0.3)'
                  : streamStatus === 'loading'
                  ? 'rgba(245, 158, 11, 0.3)'
                  : 'rgba(239, 68, 68, 0.3)'
              }`,
              background:
                streamStatus === 'online'
                  ? 'rgba(16, 185, 129, 0.08)'
                  : streamStatus === 'loading'
                  ? 'rgba(245, 158, 11, 0.08)'
                  : 'rgba(239, 68, 68, 0.08)',
              color:
                streamStatus === 'online'
                  ? '#10b981'
                  : streamStatus === 'loading'
                  ? '#fbbf24'
                  : '#ef4444',
            }}
          >
            {streamStatus}
          </span>
        </div>
      </div>

      {/* Video Container viewport */}
      {useRawPlayer ? (
        <div
          style={{
            width: '100%',
            background: '#000000',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '2px solid #29292e',
            display: 'block',
          }}
        >
          <video
            ref={videoRef}
            muted={isMuted}
            autoPlay
            controls
            playsInline
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            background: '#04060e',
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* HLS Video tag */}
          <video
            ref={videoRef}
            muted={isMuted}
            autoPlay
            controls
            playsInline
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />

          {/* Scanline / CRT overlay effect */}
          {streamStatus === 'online' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                backgroundSize: '100% 4px, 6px 100%',
                opacity: 0.85,
                zIndex: 2,
              }}
            />
          )}

          {/* Loading placeholder state */}
          {streamStatus === 'loading' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', zIndex: 5, background: '#04060e' }}>
              <div className="cyber-loader" style={{ width: '32px', height: '32px' }} />
              <span className="mono-font text-[9px] text-cyan-400 tracking-widest uppercase">SYNCING VIDEO CARRIER</span>
            </div>
          )}

          {/* Offline placeholder state */}
          {streamStatus === 'offline' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', textAlign: 'center', zIndex: 5, background: '#04060e' }}>
              <ShieldAlert className="w-8 h-8 text-rose-500 animate-pulse" />
              <span className="tech-font text-[10px] font-bold text-rose-400">CAMERA STREAM OFFLINE</span>
              <span className="mono-font text-[8px] text-slate-500 uppercase leading-normal" style={{ maxWidth: '200px' }}>
                {errorMsg || 'RTSP transcode stream not found on host port.'}
              </span>
            </div>
          )}

          {/* Video stream telemetry text HUD (16:9 bottom layout) */}
          {streamStatus === 'online' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                padding: compact ? '8px' : '12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontFamily: 'Share Tech Mono',
                fontSize: compact ? '7px' : '9px',
                color: 'rgba(0, 242, 254, 0.85)',
                textShadow: '0 0 3px rgba(0,242,254,0.6)',
              }}
            >
              {/* Top Row inside video */}
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>LAT: {formatLat(observerLat)} | LNG: {formatLng(observerLng)}</span>
                <span>ALT: {observerAlt}m</span>
              </div>

              {/* Bottom Row inside video */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>TARGET: {satName}</span>
                  {lookAngles && (
                    <span>AZ: {lookAngles.azimuth.toFixed(1)}° | EL: {lookAngles.elevation.toFixed(1)}°</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                  <span>{fps} FPS | {bitrate} MBPS</span>
                  <span>CODEC: H.264 / AAC</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controller Buttons Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={togglePlay}
            disabled={streamStatus !== 'online'}
            className={`btn-tech ${isPlaying ? '' : 'btn-tech-active'}`}
            style={{
              padding: '4px 8px',
              height: '24px',
              fontSize: '8px',
              opacity: streamStatus === 'online' ? 1 : 0.4,
              borderColor: streamStatus === 'online' ? undefined : 'rgba(255,255,255,0.05)',
            }}
            title={isPlaying ? 'Pause Feed' : 'Resume Feed'}
          >
            {isPlaying ? <Pause size={10} className="text-cyan-400" /> : <Play size={10} className="text-cyan-400" />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>

          <button
            onClick={toggleMute}
            disabled={streamStatus !== 'online'}
            className="btn-tech"
            style={{
              padding: '4px 8px',
              height: '24px',
              fontSize: '8px',
              opacity: streamStatus === 'online' ? 1 : 0.4,
              borderColor: streamStatus === 'online' ? undefined : 'rgba(255,255,255,0.05)',
            }}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX size={10} className="text-cyan-400" /> : <Volume2 size={10} className="text-cyan-400" />}
            {isMuted ? 'MUTED' : 'UNMUTED'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => {
              const nextRaw = !useRawPlayer;
              setUseRawPlayer(nextRaw);
              log(`[CCTV] Switching to ${nextRaw ? 'RAW' : 'HUD'} player mode.`);
            }}
            className={`btn-tech ${useRawPlayer ? 'btn-tech-active' : ''}`}
            style={{ padding: '4px 8px', height: '24px', fontSize: '8px', gap: '4px' }}
            title="Toggle between Raw HTML5 player and styled HUD player"
          >
            <Cpu size={10} className="text-cyan-400" />
            {useRawPlayer ? 'SHOW HUD PLAYER' : 'SHOW RAW VIDEO'}
          </button>

          <button
            onClick={handleRefresh}
            className="btn-tech"
            style={{ padding: '4px 8px', height: '24px', fontSize: '8px', gap: '4px' }}
            title="Re-Initialize Video Stream"
          >
            <RefreshCw size={10} className="text-cyan-400" />
            REFRESH
          </button>
        </div>
      </div>
    </div>
  );
}
