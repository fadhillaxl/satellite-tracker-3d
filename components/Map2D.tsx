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
  observerLat?: number;
  observerLng?: number;
  lookAngles?: { azimuth: number; elevation: number; range: number } | null;
}

export default function Map2D({
  satelliteName,
  telemetry,
  orbitPoints,
  observerLat,
  observerLng,
  lookAngles,
}: Map2DProps) {
  const [showOrbit, setShowOrbit] = useState<boolean>(true);
  const [showFootprint, setShowFootprint] = useState<boolean>(true);

  // Converts Latitude / Longitude to 2D Map percentage coordinates
  const latLngToPercent = (lat: number, lng: number) => {
    const x = ((lng + 180) / 360) * 100;
    const y = ((90 - lat) / 180) * 100;
    return { x, y };
  };

  // Calculates the great-circle footprints points and projects them
  const getSatelliteFootprintPath = () => {
    if (!telemetry) return '';
    const lat0 = (telemetry.lat * Math.PI) / 180;
    const lng0 = (telemetry.lng * Math.PI) / 180;
    const R = 6378.137; // Earth radius in km
    const h = telemetry.alt; // Altitude in km
    
    // Angular radius of footprint from Earth center
    const theta = Math.acos(R / (R + h));
    
    const points: { x: number; y: number }[] = [];
    let prevLng = telemetry.lng;
    let lngOffset = 0;

    for (let i = 0; i <= 36; i++) {
      const alpha = (i * 10 * Math.PI) / 180; // 0 to 360 degrees bearing
      
      const lat = Math.asin(
        Math.sin(lat0) * Math.cos(theta) +
        Math.cos(lat0) * Math.sin(theta) * Math.cos(alpha)
      );
      
      const lng = lng0 + Math.atan2(
        Math.sin(alpha) * Math.sin(theta) * Math.cos(lat0),
        Math.cos(theta) - Math.sin(lat0) * Math.sin(lat)
      );
      
      let lngDeg = (lng * 180) / Math.PI;
      
      // Keep coordinates continuous across the wrap boundary
      const diff = lngDeg - prevLng;
      if (diff > 180) {
        lngOffset -= 360;
      } else if (diff < -180) {
        lngOffset += 360;
      }
      lngDeg += lngOffset;
      prevLng = lngDeg;
      
      const coords = latLngToPercent((lat * 180) / Math.PI, lngDeg);
      points.push(coords);
    }
    
    return 'M ' + points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L ');
  };

  const shiftPath = (pathString: string, dx: number) => {
    if (!pathString) return '';
    return pathString.replace(/([ML])\s*([^,\s]+),([^ML\s]+)/g, (match, cmd, xStr, yStr) => {
      const x = parseFloat(xStr) + dx;
      return `${cmd} ${x.toFixed(2)},${yStr}`;
    });
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
  const observerCoords = (observerLat !== undefined && observerLng !== undefined)
    ? latLngToPercent(observerLat, observerLng)
    : null;
  const paths = getGroundTrackSvgPaths();
  const footprintPath = telemetry ? getSatelliteFootprintPath() : '';

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

          {/* Satellite Footprint / Coverage Area */}
          {showFootprint && footprintPath && (
            <>
              <path
                d={footprintPath}
                fill="rgba(255, 0, 127, 0.05)"
                stroke="#ff007f"
                strokeWidth="0.4"
                opacity="0.75"
                className="footprint-path"
              />
              <path
                d={shiftPath(footprintPath, -100)}
                fill="rgba(255, 0, 127, 0.05)"
                stroke="#ff007f"
                strokeWidth="0.4"
                opacity="0.75"
                className="footprint-path"
              />
              <path
                d={shiftPath(footprintPath, 100)}
                fill="rgba(255, 0, 127, 0.05)"
                stroke="#ff007f"
                strokeWidth="0.4"
                opacity="0.75"
                className="footprint-path"
              />
            </>
          )}

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

          {/* Line of Sight Connection from Ground Station to Satellite (when visible, elevation > 0) */}
          {lookAngles && lookAngles.elevation > 0 && observerCoords && satelliteCoords && (
            <line
              x1={observerCoords.x}
              y1={observerCoords.y}
              x2={satelliteCoords.x}
              y2={satelliteCoords.y}
              stroke="#00ff66"
              strokeWidth="0.5"
              strokeDasharray="2, 2"
              className="line-of-sight"
            />
          )}
        </svg>

        {/* Floating Ground Station Indicator Element */}
        {observerCoords && (
          <div
            className="map2d-observer-marker"
            style={{
              left: `${observerCoords.x}%`,
              top: `${observerCoords.y}%`,
            }}
          >
            {/* Blinking central core */}
            <span className="pulse-dot-cyan"></span>
            
            {/* Small tool-tip indicator */}
            <div className="observer-tooltip tech-font">
              <span className="observer-title">STATION LOCATION</span>
              <span className="observer-coords">
                {observerLat?.toFixed(4)}°, {observerLng?.toFixed(4)}°
              </span>
            </div>
          </div>
        )}

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
      <div className="map2d-controls interactive-ui" style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => setShowOrbit(!showOrbit)}
          className={`btn-tech ${showOrbit ? 'btn-tech-active' : ''}`}
          title="Toggles ground track orbit line"
        >
          <Radio className="w-4 h-4" />
          TRACK {showOrbit ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => setShowFootprint(!showFootprint)}
          className={`btn-tech ${showFootprint ? 'btn-tech-active' : ''}`}
          title="Toggles satellite coverage footprint"
        >
          <Radio className="w-4 h-4" style={{ color: '#ff007f' }} />
          COVERAGE {showFootprint ? 'ON' : 'OFF'}
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

        .map2d-observer-marker {
          position: absolute;
          z-index: 9;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
        }

        .pulse-dot-cyan {
          width: 8px;
          height: 8px;
          background-color: #00f2fe;
          border-radius: 50%;
          position: relative;
          box-shadow: 0 0 8px #00f2fe;
        }

        .pulse-dot-cyan::after {
          content: '';
          position: absolute;
          width: 24px;
          height: 24px;
          border: 1px solid #00f2fe;
          border-radius: 50%;
          top: -8px;
          left: -8px;
          animation: pulse-ring 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          opacity: 0;
        }

        .pulse-dot-red {
          width: 8px;
          height: 8px;
          background-color: #ff007f;
          border-radius: 50%;
          position: relative;
          box-shadow: 0 0 8px #ff007f;
        }

        .pulse-dot-red::after {
          content: '';
          position: absolute;
          width: 24px;
          height: 24px;
          border: 1px solid #ff007f;
          border-radius: 50%;
          top: -8px;
          left: -8px;
          animation: pulse-ring 1.8s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
          opacity: 0;
        }

        .observer-tooltip {
          margin-top: 6px;
          background: rgba(2, 6, 23, 0.85);
          border: 1px solid #00f2fe;
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
          opacity: 0.85;
        }

        .observer-title {
          font-weight: 700;
          color: #00f2fe;
        }

        .observer-coords {
          color: #00ff66;
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

        @keyframes signal-flow {
          to {
            stroke-dashoffset: -20;
          }
        }

        .line-of-sight {
          animation: signal-flow 1.5s linear infinite;
          filter: drop-shadow(0 0 2px rgba(0, 255, 102, 0.6));
        }

        @keyframes pulse-opacity {
          0%, 100% {
            fill-opacity: 0.04;
            stroke-opacity: 0.6;
          }
          50% {
            fill-opacity: 0.12;
            stroke-opacity: 0.95;
          }
        }

        .footprint-path {
          animation: pulse-opacity 3s ease-in-out infinite;
          filter: drop-shadow(0 0 2px rgba(255, 0, 127, 0.4));
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
