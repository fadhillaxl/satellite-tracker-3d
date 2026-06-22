'use client';

import { useEffect, useState } from 'react';

interface WaterfallChartProps {
  eirp: number;
  fspl: number;
  atmos: number;
  rxGain: number;
  miscLoss: number;
  rxPower: number;
}

export default function WaterfallChart({
  eirp,
  fspl,
  atmos,
  rxGain,
  miscLoss,
  rxPower,
}: WaterfallChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Compute heights for the visualization based on dB values.
  // We'll scale them so they fit within the 300px height.
  // EIRP (0 to 80 dBW) -> scale factor e.g. 1.5px/dB
  const scale = 1.3;
  const eirpHeight = Math.max(10, Math.abs(eirp) * scale);
  const fsplHeight = Math.max(10, Math.abs(fspl) * scale);
  const atmosHeight = Math.max(10, Math.abs(atmos) * scale);
  const rxHeight = Math.max(10, Math.abs(rxGain) * scale);
  const miscHeight = Math.max(10, Math.abs(miscLoss) * scale);
  const rxPowerHeight = Math.max(10, Math.abs(rxPower) * scale);

  // Position relative to a 50% baseline (150px)
  // EIRP goes UP from baseline
  const eirpTop = 150 - eirpHeight;
  // Path loss goes DOWN from eirp's bottom (which is baseline, 150px)
  const pathTop = 150;
  // Atmos loss goes DOWN from path loss bottom (150 + fsplHeight)
  const atmosTop = 150 + fsplHeight;
  // Rx Gain goes UP from baseline
  const rxTop = 150 - rxHeight;
  // Misc loss goes DOWN from rx top? No, misc loss is at 150 + miscHeight or similar.
  // In reference it was: top: calc(50% + 80px), height: 20px, transform-origin: top
  const miscTop = 150 + (rxHeight - miscHeight);
  // Result received power centered around 0 line or going down/up
  const resultTop = rxPower >= 0 ? 150 - rxPowerHeight : 150;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '20px 24px',
      borderRadius: '12px',
      position: 'relative',
      width: '100%',
      marginBottom: '20px',
      marginTop: '20px',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      {/* Label SATELLITE */}
      <div style={{
        fontFamily: "'Orbitron', monospace",
        fontWeight: 800,
        fontSize: '11px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        zIndex: 2,
        color: '#a78bfa',
        marginRight: '15px',
      }}>
        SATELLITE
      </div>

      {/* Track Container */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: '300px',
        padding: '0 5px',
        overflow: 'hidden',
        flex: 1,
      }}>
        {/* Baseline Axis */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          width: '100%',
          height: '1px',
          background: 'rgba(255, 255, 255, 0.15)',
          zIndex: 0,
        }} />

        {/* Animated Signal Background Wave */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          width: '100%',
          height: '100px',
          transform: 'translateY(-50%)',
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.15,
        }}>
          <svg style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '200%',
            height: '100%',
            fill: 'none',
            stroke: '#22d3ee',
            strokeWidth: 1.5,
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            animation: 'scrollSignal 8s linear infinite',
          }} viewBox="0 0 1000 100" preserveAspectRatio="none">
            <path d="M0,50 L10,45 L20,55 L30,48 L40,52 L50,40 L60,60 L70,45 L80,55 L90,50 
                     L100,50 L110,42 L120,58 L130,48 L140,52 L150,35 L160,65 L170,48 L180,52 L190,50 
                     L200,50 L210,55 L220,45 L230,52 L240,48 L250,30 L260,70 L270,45 L280,55 L290,50 
                     L300,50 L310,48 L320,52 L330,45 L340,55 L350,40 L360,60 L370,52 L380,48 L390,50 
                     L400,50 L410,55 L420,45 L430,58 L440,42 L450,35 L460,65 L470,50 L480,50 L490,50 
                     L500,50 L510,45 L520,55 L530,48 L540,52 L550,40 L560,60 L570,45 L580,55 L590,50 
                     L600,50 L610,42 L620,58 L630,48 L640,52 L650,35 L660,65 L670,48 L680,52 L690,50 
                     L700,50 L710,55 L720,45 L730,52 L740,48 L750,30 L760,70 L770,45 L780,55 L790,50 
                     L800,50 L810,48 L820,52 L830,45 L840,55 L850,40 L860,60 L870,52 L880,48 L890,50 
                     L900,50 L910,55 L920,45 L930,58 L940,42 L950,35 L960,65 L970,50 L980,50 L990,50 L1000,50" />
          </svg>
          <style>{`
            @keyframes scrollSignal {
              0% { transform: translateX(-50%); }
              100% { transform: translateX(0); }
            }
          `}</style>
        </div>

        {/* Satellite Node (C Shape) */}
        <div style={{
          width: '20px',
          height: '60px',
          border: '2px solid #a78bfa',
          borderRight: 'none',
          borderRadius: '40px 0 0 40px',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 2,
          flexShrink: 0,
          background: 'rgba(167, 139, 250, 0.1)',
          marginRight: '8px',
        }} />

        {/* Column 1: Tx EIRP */}
        <div className="bar-column" style={{ position: 'relative', height: '100%', flex: 1, marginRight: '8px' }}>
          <div style={{ position: 'absolute', top: '15px', width: '100%', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.5px' }}>Tx EIRP</div>
          <div style={{
            position: 'absolute',
            width: '100%',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#22d3ee',
            top: `${eirpTop}px`,
            height: `${eirpHeight}px`,
            borderRadius: '4px',
            boxShadow: '0 0 10px rgba(34, 211, 238, 0.3)',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'bottom',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#000' }}>+{eirp.toFixed(1)}</span>
          </div>
        </div>

        {/* Column 2: Path Loss */}
        <div className="bar-column" style={{ position: 'relative', height: '100%', flex: 1, marginRight: '8px' }}>
          <div style={{ position: 'absolute', top: '15px', width: '100%', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.5px' }}>Path Loss</div>
          <div style={{
            position: 'absolute',
            width: '100%',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ef4444',
            top: `${pathTop}px`,
            height: `${fsplHeight}px`,
            borderRadius: '4px',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'top',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out 0.2s',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff' }}>-{Math.abs(fspl).toFixed(1)}</span>
          </div>
        </div>

        {/* Column 3: Atmos Loss */}
        <div className="bar-column" style={{ position: 'relative', height: '100%', flex: 1, marginRight: '8px' }}>
          <div style={{ position: 'absolute', top: '15px', width: '100%', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.5px' }}>Atmos Loss</div>
          <div style={{
            position: 'absolute',
            width: '100%',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ef4444',
            top: `${atmosTop}px`,
            height: `${atmosHeight}px`,
            borderRadius: '4px',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'top',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out 0.4s',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff' }}>-{Math.abs(atmos).toFixed(1)}</span>
          </div>
        </div>

        {/* Ground Node (C Shape) */}
        <div style={{
          width: '20px',
          height: '60px',
          border: '2px solid #34d399',
          borderLeft: 'none',
          borderRadius: '0 40px 40px 0',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 2,
          flexShrink: 0,
          background: 'rgba(52, 211, 153, 0.1)',
          marginRight: '8px',
          marginLeft: '8px',
        }} />

        {/* Column 4: Rx Gain */}
        <div className="bar-column" style={{ position: 'relative', height: '100%', flex: 1, marginRight: '8px' }}>
          <div style={{ position: 'absolute', top: '15px', width: '100%', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.5px' }}>Rx Gain</div>
          <div style={{
            position: 'absolute',
            width: '100%',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#22d3ee',
            top: `${rxTop}px`,
            height: `${rxHeight}px`,
            borderRadius: '4px',
            boxShadow: '0 0 10px rgba(34, 211, 238, 0.3)',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'bottom',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out 0.6s',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#000' }}>+{rxGain.toFixed(1)}</span>
          </div>
        </div>

        {/* Column 5: Misc Loss */}
        <div className="bar-column" style={{ position: 'relative', height: '100%', flex: 1, marginRight: '8px' }}>
          <div style={{ position: 'absolute', top: '15px', width: '100%', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.5px' }}>Misc Loss</div>
          <div style={{
            position: 'absolute',
            width: '100%',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ef4444',
            top: `${miscTop}px`,
            height: `${miscHeight}px`,
            borderRadius: '4px',
            boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'top',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out 0.8s',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff' }}>-{Math.abs(miscLoss).toFixed(1)}</span>
          </div>
        </div>

        {/* Column 6: Received Power */}
        <div className="bar-column" style={{ position: 'relative', height: '100%', flex: 1 }}>
          <div style={{ position: 'absolute', top: '15px', width: '100%', textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.5px' }}>Received</div>
          <div style={{
            position: 'absolute',
            width: '100%',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: rxPower >= 0 ? '#34d399' : '#f59e0b',
            top: `${resultTop}px`,
            height: `${rxPowerHeight}px`,
            borderRadius: '4px',
            boxShadow: `0 0 10px ${rxPower >= 0 ? 'rgba(52, 211, 153, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            opacity: isMounted ? 1 : 0,
            transform: isMounted ? 'scaleY(1)' : 'scaleY(0)',
            transformOrigin: 'top',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out 1.0s',
          }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#000' }}>{rxPower.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* Label GROUND */}
      <div style={{
        fontFamily: "'Orbitron', monospace",
        fontWeight: 800,
        fontSize: '11px',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        zIndex: 2,
        color: '#34d399',
        marginLeft: '15px',
        textAlign: 'right',
      }}>
        GROUND
      </div>
    </div>
  );
}
