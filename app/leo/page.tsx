'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import LeoLayout from '@/components/leo/LeoLayout';

const FEATURES = [
  {
    href: '/leo/analyzer',
    icon: '◈',
    color: '#22d3ee',
    title: 'LEO Constellation Analyzer',
    desc: 'Visualize Walker Delta constellations in real-time 2D + 3D. Adjust satellites, planes, inclination, and beam coverage.',
  },
  {
    href: '/leo/isl',
    icon: '⬡',
    color: '#a78bfa',
    title: 'ISL Simulation',
    desc: 'Multi-constellation Inter-Satellite Link visualizer with cross-plane, intra-plane, and inter-plane link algorithms.',
  },
  {
    href: '/leo/link-budget',
    icon: '⊕',
    color: '#f59e0b',
    title: 'Link Budget Calculator',
    desc: 'Compute EIRP, FSPL, C/N₀, Eb/N₀, and link margin using the Friis transmission equation. Presets for Starlink, OneWeb, CubeSat.',
  },
  {
    href: '/leo/citations',
    icon: '⊞',
    color: '#34d399',
    title: 'References',
    desc: 'Academic and technical references underpinning the orbital mechanics, ISL algorithms, and RF analysis models.',
  },
];

export default function LeoLandingPage() {
  const bgRef = useRef<HTMLDivElement>(null);
  const cursorGlowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!cursorGlowRef.current) return;
      cursorGlowRef.current.style.left = `${e.clientX}px`;
      cursorGlowRef.current.style.top = `${e.clientY}px`;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <LeoLayout>
      {/* Spotlight cursor */}
      <div
        ref={cursorGlowRef}
        style={{
          position: 'fixed',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,211,238,0.06) 0%, transparent 70%)',
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
          zIndex: 5,
          transition: 'left 0.05s, top 0.05s',
        }}
      />

      {/* Stars background via CSS */}
      <div style={{ position: 'absolute', inset: 0, background: 'url(/static/textures/8k_stars_milky_way.jpg) center/cover no-repeat', opacity: 0.25 }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 10, height: '100%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px', overflowY: 'auto',
      }}>
        {/* Hero */}
        <div style={{ textAlign: 'center', maxWidth: 600, marginBottom: 64 }}>
          <div style={{ fontSize: 10, fontFamily: "'Share Tech Mono',monospace", color: 'rgba(34,211,238,0.6)', letterSpacing: '0.2em', marginBottom: 16, textTransform: 'uppercase' }}>
            NASA Space Apps · Jakarta 2025
          </div>
          <h1 style={{
            fontSize: 'clamp(36px, 6vw, 64px)',
            fontFamily: "'Orbitron',monospace", fontWeight: 800,
            letterSpacing: '0.05em',
            background: 'linear-gradient(135deg, #fff 0%, #22d3ee 50%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 20, lineHeight: 1.1,
          }}>
            LEO SUITE
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, marginBottom: 32 }}>
            A comprehensive toolkit for Low Earth Orbit constellation analysis — from Walker orbit simulation to ISL network topology and RF link budget calculation.
          </p>
          <Link
            href="/leo/analyzer"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              fontFamily: "'Orbitron',monospace", fontWeight: 700,
              fontSize: 12, letterSpacing: '0.1em',
              background: 'rgba(34,211,238,0.12)',
              border: '1px solid rgba(34,211,238,0.5)',
              color: '#22d3ee', borderRadius: 6, textDecoration: 'none',
              transition: 'all 0.2s',
              boxShadow: '0 0 20px rgba(34,211,238,0.1)',
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(34,211,238,0.2)';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 30px rgba(34,211,238,0.2)';
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(34,211,238,0.12)';
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 20px rgba(34,211,238,0.1)';
            }}
          >
            LAUNCH ANALYZER →
          </Link>
        </div>

        {/* Feature cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, maxWidth: 900, width: '100%' }}>
          {FEATURES.map(f => (
            <Link key={f.href} href={f.href} style={{ textDecoration: 'none' }}>
              <div style={{
                padding: '18px 20px',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${f.color}20`,
                borderRadius: 10,
                transition: 'all 0.25s',
                cursor: 'pointer',
              }}
                onMouseOver={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = `${f.color}08`;
                  el.style.borderColor = `${f.color}40`;
                  el.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={e => {
                  const el = e.currentTarget as HTMLDivElement;
                  el.style.background = 'rgba(255,255,255,0.03)';
                  el.style.borderColor = `${f.color}20`;
                  el.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 10, color: f.color }}>{f.icon}</div>
                <div style={{ fontSize: 12, fontFamily: "'Orbitron',monospace", fontWeight: 600, color: '#fff', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {f.title}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                  {f.desc}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </LeoLayout>
  );
}
