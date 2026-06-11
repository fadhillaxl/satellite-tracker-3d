'use client';

import React, { useState } from 'react';
import { Search, Loader2, Globe } from 'lucide-react';

interface HeaderProps {
  currentId: string;
  onSearch: (id: string) => void;
  isLoading: boolean;
  apiStatus: 'online' | 'error' | 'loading';
}

export default function Header({
  currentId,
  onSearch,
  isLoading,
  apiStatus,
}: HeaderProps) {
  const [searchInput, setSearchInput] = useState(currentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = searchInput.trim();
    if (id && !isNaN(Number(id))) {
      onSearch(id);
    }
  };

  return (
    <header className="app-header interactive-ui">
      {/* Logo Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          borderColor: 'rgba(6, 182, 212, 0.3)',
          borderStyle: 'solid',
          borderWidth: '1px',
        }} className="text-cyan-400">
          <Globe className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="tech-font glow-text-cyan" style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.05em' }}>
            ORBIT_TRACKER_3D
          </h1>
          <p className="text-secondary" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}>
            Real-Time Space Dynamics Client
          </p>
        </div>
      </div>

      {/* Search Input Bar */}
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search className="text-muted" style={{ position: 'absolute', left: '12px', width: '16px', height: '16px' }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Enter NORAD ID (e.g. 16011, 25544)"
            className="input-tech"
            style={{ paddingLeft: '40px', fontSize: '14px', width: '220px' }}
          />
          {isLoading && (
            <Loader2 className="text-cyan-400 animate-spin" style={{ position: 'absolute', right: '12px', width: '16px', height: '16px' }} />
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="btn-tech"
          style={{ height: '38px', whiteSpace: 'nowrap' }}
        >
          PROPAGATE
        </button>
      </form>

      {/* API / Server Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
        <span className="text-secondary" style={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px' }}>
          Celestrak DB Link:
        </span>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '9999px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          borderColor: 'rgba(30, 41, 59, 0.8)',
          borderStyle: 'solid',
          borderWidth: '1px',
        }}>
          <span
            className={`w-2 h-2 rounded-full ${
              apiStatus === 'online'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse'
                : apiStatus === 'loading'
                ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-bounce'
                : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
            }`}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: apiStatus === 'online' ? '#34d399' : apiStatus === 'loading' ? '#fbbf24' : '#f43f5e',
            }}
          ></span>
          <span className="tech-font font-bold text-primary" style={{ fontSize: '10px' }}>
            {apiStatus === 'online' ? 'CONNECTED' : apiStatus === 'loading' ? 'FETCHING' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
}
