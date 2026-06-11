'use client';

import React, { useState } from 'react';
import { Radio } from 'lucide-react';

interface TelemetryData {
  lat: number;
  lng: number;
  alt: number;
  velocity: number;
  timeString: string;
}

interface Map2DProps {
  line1: string;
  line2: string;
  periodMinutes: number;
  satelliteName: string;
  telemetry: TelemetryData | null;
  orbitPoints: { x: number; y: number; z: number; lat: number; lng: number }[];
}

export default function Map2D({
  satelliteName,
  telemetry,
  orbitPoints,
}: Map2DProps) {
  const [showOrbit, setShowOrbit] = useState<boolean>(true);

  // Converts Latitude / Longitude to 2D Map percentage coordinates
  const latLngToPercent = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  };

  // Generate SVG path for the orbital ground track
  // Split path when it crosses the date line to avoid horizontal lines cutting across the map
  const getGroundTrackSvgPaths = () => {
    if (orbitPoints.length < 2) return [];
    
    const paths: string[] = [];
    let currentPathPoints: string[] = [];

    for (let i = 0; i < orbitPoints.length; i++) {
      const pt = orbitPoints[i];
      const { x, y } = latLngToPercent(pt.lat, pt.lng);
      
      if (i > 0) {
        const prevPt = orbitPoints[i - 1];
        // If change in longitude is greater than 180, it crossed the date line
        if (Math.abs(pt.lng - prevPt.lng) > 180) {
          if (currentPathPoints.length > 0) {
            paths.push(`M ${currentPathPoints.join(' L ')}`);
          }
          currentPathPoints = [];
        }
      }
      
      currentPathPoints.push(`${x.toFixed(2)}%,${y.toFixed(2)}%`);
    }

    if (currentPathPoints.length > 0) {
      paths.push(`M ${currentPathPoints.join(' L ')}`);
    }

    return paths;
  };

  const satelliteCoords = telemetry ? latLngToPercent(telemetry.lat, telemetry.lng) : null;
  const paths = getGroundTrackSvgPaths();

  return (
    <div className="map2d-container glass-panel">
      {/* Flat Map Surface */}
      <div className="map2d-surface">
        {/* SVG Overlay for drawing path and markers */}
        <svg className="map2d-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
          {/* Ground Track Paths */}
          {showOrbit && paths.map((path, idx) => (
            <path
              key={idx}
              d={path.replace(/%/g, '')} // Strip percentage for SVG coordinate spaces if using viewBox 100x100
              fill="none"
              stroke="#00f2fe"
              strokeWidth="0.8"
              strokeDasharray="1.5,1"
              opacity="0.85"
            />
          ))}

          {/* Sub-satellite position connection or footprint if needed (can be represented in SVG) */}
          {showOrbit && satelliteCoords && (
            <circle
              cx={satelliteCoords.x}
              cy={satelliteCoords.y}
              r="1.2"
              fill="none"
              stroke="#ff007f"
              strokeWidth="0.3"
              opacity="0.6"
              className="pulse-circle"
            />
          )}
        </svg>

        {/* Floating Satellite Indicator Element */}
        {satelliteCoords && (
          <div
            className="map2d-satellite-marker"
            style={{
              left: `${satelliteCoords.x}%`,
              top: `${satelliteCoords.y}%`,
            }}
          >
            {/* Blinking central core */}
            <span className="pulse-dot-red"></span>
            
            {/* Small tool-tip indicator */}
            <div className="marker-tooltip tech-font">
              <span className="marker-name">{satelliteName}</span>
              <span className="marker-alt">{telemetry?.alt.toFixed(0)}km</span>
            </div>
          </div>
        )}
      </div>

      {/* Grid line overlays for latitude/longitude references */}
      <div className="map2d-grid-lines">
        {/* Equator */}
        <div className="grid-line equator"><span className="label tech-font">EQUATOR 0°</span></div>
        {/* Prime Meridian */}
        <div className="grid-line prime-meridian"><span className="label tech-font">PRIME MERIDIAN 0°</span></div>
      </div>

      {/* Local Controls HUD */}
      <div className="map2d-controls interactive-ui">
        <button
          onClick={() => setShowOrbit(!showOrbit)}
          className={`btn-tech ${showOrbit ? 'btn-tech-active' : ''}`}
          title="Toggles ground track orbit line"
        >
          <Radio className="w-4 h-4" />
          TRACK {showOrbit ? 'ON' : 'OFF'}
        </button>
      </div>

      <style jsx>{`
        .map2d-container {
          position: relative;
          flex: 1;
          height: 100%;
          min-height: 400px;
          background-color: #030612;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.8);
        }

        .map2d-surface {
          position: relative;
          width: 96%;
          aspect-ratio: 2 / 1;
          background-image: url('https://unpkg.com/three-globe/example/img/earth-dark.jpg');
          background-size: cover;
          background-position: center;
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.6);
        }

        .map2d-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 5;
          pointer-events: none;
        }

        .map2d-satellite-marker {
          position: absolute;
          z-index: 10;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }

        .marker-tooltip {
          margin-top: 6px;
          background: rgba(2, 6, 23, 0.85);
          border: 1px solid #ff007f;
          padding: 3px 6px;
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
          font-size: 8px;
          color: #fff;
          white-space: nowrap;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        }

        .marker-name {
          font-weight: 700;
          color: #ff007f;
        }

        .marker-alt {
          color: #00f2fe;
        }

        .map2d-grid-lines {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 2;
        }

        .grid-line {
          position: absolute;
          border: 0.5px dashed rgba(255, 255, 255, 0.06);
        }

        .equator {
          left: 0;
          width: 100%;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          justify-content: flex-end;
          padding-right: 12px;
        }

        .prime-meridian {
          top: 0;
          height: 100%;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: flex-end;
          padding-bottom: 12px;
        }

        .grid-line .label {
          font-size: 8px;
          color: rgba(255, 255, 255, 0.25);
          letter-spacing: 0.05em;
        }

        .map2d-controls {
          position: absolute;
          bottom: 16px;
          right: 16px;
          z-index: 10;
        }

        @keyframes pulse-ring {
          0% {
            transform: scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: scale(2.2);
            opacity: 0;
          }
        }

        @media (max-width: 768px) {
          .map2d-container {
            width: 100%;
            height: 320px;
            min-height: unset;
          }
          .map2d-surface {
            width: 100%;
            border-radius: 0;
          }
        }
      `}</style>
    </div>
  );
}
