'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import GlobeAll3D from '@/components/GlobeAll3D';
import { ArrowLeft, RefreshCw, Radio, Server, Activity } from 'lucide-react';

interface SatelliteRaw {
  n: string;
  i: string;
  1: string;
  2: string;
}

export default function AllSatellitesPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  const router = useRouter();
  const [satellites, setSatellites] = useState<SatelliteRaw[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSatellites() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${basePath}/api/satellites`);

      if (!res.ok) {
        throw new Error(`Failed to load satellite database (${res.status})`);
      }
      const data = await res.json();
      setSatellites(data);
      setIsLoading(false);
    } catch (err: unknown) {
      console.error('Error fetching satellite database:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to fetch satellite database';
      setError(errMsg);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      loadSatellites();
    });
  }, []);

  return (
    <main className="dashboard-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Navbar */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderRadius: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.back()} className="btn-tech flex items-center gap-1.5" style={{ height: '36px', padding: '0 14px', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            BACK TO TARGET TRACKER
          </button>
          <Link href="/rotator" className="btn-tech flex items-center gap-1.5" style={{ height: '36px', padding: '0 14px', textDecoration: 'none', color: '#22d3ee', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
            ROTATOR CONFIG
          </Link>
          <Link href="/radio" className="btn-tech flex items-center gap-1.5" style={{ height: '36px', padding: '0 14px', textDecoration: 'none', color: '#22d3ee', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
            RADIO CONFIG
          </Link>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 className="tech-font text-base font-bold tracking-wider text-white" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
              GLOBAL ORBITAL CONSTELLATION
            </h1>
            <span className="text-[10px] text-secondary uppercase tracking-widest mt-0.5">
              Real-time point cloud fleet visualization
            </span>
          </div>
        </div>

        {/* Global Statistics Indicators */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity className="w-4 h-4 text-emerald-400" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="text-[8px] text-secondary uppercase">MONITORED PAYLOADS</span>
              <span className="mono-font text-emerald-400 text-xs font-semibold">
                {isLoading ? 'FETCHING...' : `${satellites.length} ACTIVE`}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server className="w-4 h-4 text-cyan-400" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="text-[8px] text-secondary uppercase">CELESTRAACK SYNC</span>
              <span className="mono-font text-cyan-400 text-xs font-semibold">
                ONLINE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Globe Canvas Space */}
      <div style={{ flex: 1, position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)', background: '#02040b' }}>
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              zIndex: 10,
            }}
          >
            <div className="cyber-loader" />
            <div style={{ textAlign: 'center' }}>
              <h3 className="tech-font text-sm font-bold text-cyan-400 tracking-wider">RETRIEVING CELESTIAL ELEMENTS</h3>
              <p className="text-[10px] text-secondary uppercase tracking-widest mt-1">
                Downloading and parsing 6,000+ payload trajectories...
              </p>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              zIndex: 10,
              maxWidth: '400px',
              textAlign: 'center',
            }}
            className="glass-panel"
          >
            <h3 className="tech-font text-sm font-bold text-rose-400 tracking-wider">DATABASE SYNC ERROR</h3>
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              Could not retrieve the active satellite database. Please try reloading or check Celestraack connectivity.
            </p>
            <button onClick={loadSatellites} className="btn-tech flex items-center gap-1.5 mt-3" style={{ alignSelf: 'center' }}>
              <RefreshCw className="w-3.5 h-3.5" /> RETRY SYNC
            </button>
          </div>
        )}

        {!isLoading && !error && satellites.length > 0 && (
          <GlobeAll3D satellites={satellites} />
        )}
      </div>
    </main>
  );
}
