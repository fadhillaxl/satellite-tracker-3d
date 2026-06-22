'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/leo/analyzer', label: 'LEO ANALYZER' },
  { href: '/leo/isl', label: 'ISL SIMS' },
  { href: '/leo/link-budget', label: 'LINK BUDGET' },
  { href: '/leo/citations', label: 'CITATIONS' },
];

export default function LeoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111', color: '#fff', fontFamily: "'Inter', sans-serif" }}>
      {/* Top Nav */}
      <header style={{
        height: 56,
        minHeight: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(12px)',
        zIndex: 100,
        gap: 16,
      }}>
        {/* Left: brand + nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* Back to tracker */}
          <Link
            href="/all"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontFamily: "'Orbitron', monospace",
              fontWeight: 600,
              color: '#a78bfa',
              textDecoration: 'none',
              letterSpacing: '0.08em',
              padding: '4px 10px',
              border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: 4,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(167,139,250,0.12)';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(167,139,250,0.6)';
            }}
            onMouseOut={e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
              (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(167,139,250,0.25)';
            }}
          >
            ← 3D TRACKER
          </Link>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />

          {/* Logo / Brand */}
          <Link href="/leo" style={{ textDecoration: 'none' }}>
            <span style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: '#fff',
              opacity: 0.9,
            }}>
              LEO SUITE
            </span>
          </Link>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)' }} />

          {/* Nav links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {NAV_ITEMS.map(item => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    fontSize: 10,
                    fontFamily: "'Orbitron', monospace",
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    color: isActive ? '#22d3ee' : 'rgba(255,255,255,0.45)',
                    textDecoration: 'none',
                    padding: '5px 10px',
                    borderRadius: 4,
                    border: isActive ? '1px solid rgba(34,211,238,0.35)' : '1px solid transparent',
                    background: isActive ? 'rgba(34,211,238,0.08)' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.8)';
                      (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)';
                    }
                  }}
                  onMouseOut={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.45)';
                      (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                    }
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'Share Tech Mono', monospace" }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 6px #22d3ee', display: 'inline-block' }} />
          CLIENT SIMULATION
        </div>
      </header>

      {/* Page content */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {children}
      </main>
    </div>
  );
}
