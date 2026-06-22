'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import LeoLayout from '@/components/leo/LeoLayout';
import {
  LinkBudgetSimParams,
  MonteCarloResult,
  TimeSeriesResult,
  runMonteCarloSimulation,
  runTimeSeriesSimulation,
  LINK_BUDGET_PRESETS,
  PresetKey,
  slantRangeKm,
} from '@/lib/leo/linkBudget';
import WaterfallChart from '@/components/leo/link-budget/WaterfallChart';

// Dynamic load of Three.js component
const SkyDome3D = dynamic(
  () => import('@/components/leo/link-budget/SkyDome3D'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.3)', fontSize: 12,
        fontFamily: "'Orbitron', monospace"
      }}>
        LOADING 3D ENGINE...
      </div>
    )
  }
);

// Dynamic load of Chart.js component
const SimulationCharts = dynamic(
  () => import('@/components/leo/link-budget/SimulationCharts'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        padding: '40px', textAlign: 'center',
        color: 'rgba(255,255,255,0.3)', fontSize: 12,
        fontFamily: "'Orbitron', monospace"
      }}>
        INITIALIZING DATA VISUALIZATIONS...
      </div>
    )
  }
);

const DEFAULT_SIM_PARAMS: LinkBudgetSimParams = {
  altitude: 1000,
  inclination: 50,
  latitude: 41,
  minElevation: 10,
  frequency: 20.0,      // GHz
  eirp: 56,             // dBW
  gr: 40,              // dBi
  requiredPower: -105,  // dBW
};

export default function LinkBudgetPage() {
  const [simParams, setSimParams] = useState<LinkBudgetSimParams>(DEFAULT_SIM_PARAMS);
  const [activeTab, setActiveTab] = useState<'space' | 'ground' | 'link'>('space');
  const [mode, setMode] = useState<'2D' | '3D'>('2D');

  // Simulation run state
  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasCalculated, setHasCalculated] = useState(false);

  // Simulation results
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [tsResult, setTsResult] = useState<TimeSeriesResult | null>(null);
  const [avgFspl, setAvgFspl] = useState(0);
  const [avgAtmos, setAvgAtmos] = useState(0);

  // References for UI DOM scrolling
  const resultsRef = useRef<HTMLDivElement>(null);

  // Handle Preset Loading
  const loadPreset = (key: PresetKey) => {
    const preset = LINK_BUDGET_PRESETS[key];
    
    // Approximate inputs for simulation from deterministic presets
    let alt = 1000;
    let inc = 50;
    if (key === 'starlink_ku') { alt = 550; inc = 53; }
    else if (key === 'oneweb_ka') { alt = 1200; inc = 87.9; }
    else if (key === 'vhf_cubesat') { alt = 600; inc = 97.6; }

    const k_B = 1.380649e-23;
    const dbwNoisePerHz = 10 * Math.log10(k_B * preset.rx.systemTempK);
    const dbRate = 10 * Math.log10(preset.rx.dataRateKbps * 1000);
    const requiredPower = dbwNoisePerHz + dbRate + preset.rx.requiredEbN0Db;

    setSimParams({
      altitude: alt,
      inclination: inc,
      latitude: 41,
      minElevation: preset.env.pointingLossDb > 0.5 ? 10 : 5,
      frequency: preset.tx.frequencyMhz / 1000,
      eirp: preset.tx.txPowerDbw + preset.tx.txGainDbi - preset.tx.txLossesDb,
      gr: preset.rx.rxGainDbi,
      requiredPower,
    });
  };

  // Triggers simulation with cyberpunk loading screen
  const runSimulation = () => {
    setIsSimulating(true);
    setProgress(0);

    const duration = 2000; // 2s loading duration
    const intervalTime = 40;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const currentPct = Math.min(Math.floor((currentStep / steps) * 98), 98);
      setProgress(currentPct);
    }, intervalTime);

    setTimeout(() => {
      // Execute heavy calculations after UI shows loading screen
      try {
        const mc = runMonteCarloSimulation(simParams);
        const ts = runTimeSeriesSimulation(simParams, 60, 10);

        setMcResult(mc);
        setTsResult(ts);

        // Average calculations for Waterfall Breakdown
        if (mc.chartData.slantRangeSamples.length > 0) {
          const avgRange = mc.chartData.slantRangeSamples.reduce((a, b) => a + b, 0) / mc.chartData.slantRangeSamples.length;
          const avgTheta = mc.chartData.thetaSamples.reduce((a, b) => a + b, 0) / mc.chartData.thetaSamples.length;
          const avgThetaRad = avgTheta * (Math.PI / 180);

          // FSPL = 92.45 + 20 log10(R) + 20 log10(f)
          const fspl = 92.45 + 20 * Math.log10(avgRange) + 20 * Math.log10(simParams.frequency);
          const atmos = 0.5 / Math.sin(avgThetaRad);

          setAvgFspl(fspl);
          setAvgAtmos(atmos);
        }

        clearInterval(interval);
        setProgress(100);

        setTimeout(() => {
          setIsSimulating(false);
          setHasCalculated(true);
          // Scroll smoothly to results
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 100);
        }, 300);

      } catch (err) {
        clearInterval(interval);
        setIsSimulating(false);
        console.error(err);
        alert('Simulation failed to calculate. Please check input parameter limits.');
      }
    }, duration);
  };

  // Compute 2D Conic gradient angles
  const arcAngle = 180 - 2 * simParams.minElevation;
  const conicBg = hasCalculated
    ? `conic-gradient(from ${360 - arcAngle / 2}deg,
        rgba(239, 68, 68, 0.7) 0deg,
        rgba(245, 158, 11, 0.7) ${arcAngle / 4}deg,
        rgba(34, 211, 238, 0.7) ${arcAngle / 2}deg,
        rgba(245, 158, 11, 0.7) ${(3 * arcAngle) / 4}deg,
        rgba(239, 68, 68, 0.7) ${arcAngle}deg,
        transparent ${arcAngle}deg,
        transparent 360deg)`
    : `conic-gradient(from ${360 - arcAngle / 2}deg,
        rgba(255, 255, 255, 0.25) 0deg,
        rgba(255, 255, 255, 0.25) ${arcAngle}deg,
        transparent ${arcAngle}deg,
        transparent 360deg)`;

  return (
    <LeoLayout>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'relative' }}>
        
        {/* ── Visualizer Panel (Left) ─────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          
          {/* Main Visualizer screen */}
          <div style={{ height: '400px', minHeight: '400px', position: 'relative', overflow: 'hidden' }}>
            
            {/* View toggle */}
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, display: 'flex', gap: 4 }}>
              {(['2D', '3D'] as const).map(m => (
                <button
                  key={m} onClick={() => setMode(m)}
                  style={{
                    padding: '5px 14px', fontSize: 11, fontFamily: "'Orbitron', monospace", fontWeight: 700,
                    letterSpacing: '0.08em', border: `1px solid ${mode === m ? 'rgba(34,211,238,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    background: mode === m ? 'rgba(34,211,238,0.12)' : 'rgba(0,0,0,0.4)',
                    color: mode === m ? '#22d3ee' : 'rgba(255,255,255,0.4)', borderRadius: 4, cursor: 'pointer',
                    transition: 'all 0.2s', backdropFilter: 'blur(8px)',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* 2D Representation */}
            {mode === '2D' && (
              <div style={{
                position: 'relative', width: '100%', height: '100%',
                backgroundColor: '#02040a', backgroundImage: 'url(/static/textures/8k_stars_milky_way.jpg)',
                backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden',
                display: 'flex', justifyContent: 'center', alignItems: 'center'
              }}>
                {/* Conic beam */}
                <div style={{
                  position: 'absolute', bottom: '30%', left: '50%',
                  width: '150vmax', height: '150vmax', borderRadius: '50%',
                  background: conicBg, transform: 'translate(-50%, 50%)',
                  zIndex: 10, opacity: 0.5,
                  transition: 'background 0.3s ease',
                }} />
                {/* Fade layer */}
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 11,
                  background: 'radial-gradient(circle at center, transparent 0%, rgba(2, 4, 10, 0.7) 100%)',
                  pointerEvents: 'none',
                }} />
                {/* Horizon hill */}
                <div style={{
                  position: 'absolute', bottom: 0, width: '150%', height: '30%',
                  backgroundColor: 'rgba(255,255,255,0.06)', borderTopLeftRadius: '100% 100%', borderTopRightRadius: '100% 100%',
                  borderTop: '1px solid rgba(255,255,255,0.15)', zIndex: 20,
                  backdropFilter: 'blur(3px)',
                }} />
                {/* Center dot (station) */}
                <div style={{
                  position: 'absolute', top: '70%', left: '50%', width: '14px', height: '14px',
                  backgroundColor: '#34d399', borderRadius: '50%', transform: 'translate(-50%, -50%)',
                  zIndex: 30, boxShadow: '0 0 10px #34d399',
                }} />
                {/* Text indicator */}
                <div style={{
                  position: 'absolute', bottom: '32%', left: '50%', transform: 'translateX(-50%)',
                  color: '#fff', fontSize: '11px', fontWeight: 600, fontFamily: "'Share Tech Mono', monospace",
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)', zIndex: 25, opacity: 0.9, letterSpacing: '0.06em'
                }}>
                  Observer Latitude: {simParams.latitude}° | Min Elevation: {simParams.minElevation}°
                </div>
                {/* Heatmap Legend */}
                {hasCalculated && mcResult && (
                  <div style={{
                    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                    width: '180px', background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(4px)', padding: '10px', borderRadius: '8px', zIndex: 30
                  }}>
                    <div style={{ height: '6px', width: '100%', borderRadius: '3px', background: 'linear-gradient(to right, #ef4444, #f59e0b, #22d3ee)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#fff', marginTop: '4px', fontFamily: 'monospace' }}>
                      <span>{mcResult.worst_case_pr.toFixed(1)} dBW</span>
                      <span>{mcResult.best_case_pr.toFixed(1)} dBW</span>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '8px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginTop: '3px', letterSpacing: '0.5px' }}>
                      Path Signal Quality
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3D Representation */}
            {mode === '3D' && (
              <div style={{ width: '100%', height: '100%' }}>
                <SkyDome3D passes={tsResult ? tsResult.passes3D : null} />
              </div>
            )}

            {/* Legend Overlays */}
            <div style={{
              position: 'absolute', bottom: 12, left: 12, zIndex: 20,
              padding: '6px 12px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
              borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 4px #34d399' }} />
                Ground Station
              </div>
              {mode === '3D' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>
                    <span style={{ display: 'inline-block', width: 12, height: 1.5, background: '#22d3ee' }} />
                    Longest Pass
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>
                    <span style={{ display: 'inline-block', width: 12, height: 1.5, background: '#ef4444' }} />
                    Shortest Pass
                  </div>
                </>
              )}
              {mode === '2D' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: "'Share Tech Mono', monospace" }}>
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
                  Beam Boundary
                </div>
              )}
            </div>
          </div>

          {/* Results Output Section */}
          <div ref={resultsRef} style={{ flex: 1, padding: '24px' }}>
            {!hasCalculated ? (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.25)',
                padding: '40px 0', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '8px'
              }}>
                <span style={{ fontSize: '32px', marginBottom: '12px' }}>📊</span>
                <div style={{ fontSize: '13px', fontFamily: "'Orbitron', monospace", fontWeight: 700, letterSpacing: '0.08em', marginBottom: '6px' }}>NO SIMULATION DATA</div>
                <div style={{ fontSize: '11px', textAlign: 'center', maxWidth: '300px', lineHeight: 1.6 }}>
                  Configure your segment parameters in the right control panel and click &ldquo;Calculate&rdquo; to execute the Monte Carlo pass analysis.
                </div>
              </div>
            ) : (
              mcResult && tsResult && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '13px', fontFamily: "'Orbitron', monospace", fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>
                      SIMULATION METRICS
                    </h3>
                    <span style={{
                      fontSize: '10px', fontFamily: "'Share Tech Mono', monospace",
                      color: '#22d3ee', background: 'rgba(34, 211, 238, 0.1)',
                      border: '1px solid rgba(34, 211, 238, 0.2)', padding: '2px 8px', borderRadius: '4px'
                    }}>
                      60 Days @ 10s step
                    </span>
                  </div>

                  {/* Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Expected Power</div>
                      <div style={{ fontSize: '20px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: '#fff' }}>
                        {mcResult.expected_pr.toFixed(1)} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>dBW</span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Worst Case Power</div>
                      <div style={{ fontSize: '20px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: '#ef4444' }}>
                        {mcResult.worst_case_pr.toFixed(1)} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>dBW</span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Best Case Power</div>
                      <div style={{ fontSize: '20px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: '#22d3ee' }}>
                        {mcResult.best_case_pr.toFixed(1)} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>dBW</span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Expected Margin</div>
                      <div style={{ fontSize: '20px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: mcResult.link_margin_expected >= 0 ? '#34d399' : '#ef4444' }}>
                        {mcResult.link_margin_expected.toFixed(1)} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>dB</span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Worst Margin</div>
                      <div style={{ fontSize: '20px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: mcResult.link_margin_worst >= 0 ? '#34d399' : '#ef4444' }}>
                        {mcResult.link_margin_worst.toFixed(1)} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>dB</span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Visibility Ratio</div>
                      <div style={{ fontSize: '20px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: '#f59e0b' }}>
                        {mcResult.visibility_ratio.toFixed(2)}<span style={{ fontSize: '13px' }}>%</span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Std Deviation</div>
                      <div style={{ fontSize: '20px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                        {mcResult.std_dev_pr.toFixed(2)} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>dB</span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Mean Contact Duration</div>
                      <div style={{ fontSize: '20px', fontFamily: "'Share Tech Mono', monospace", fontWeight: 700, color: '#22d3ee' }}>
                        {tsResult.meanContactDuration.toFixed(1)} <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>s</span>
                      </div>
                    </div>
                  </div>

                  {/* Waterfall Chart breakdown */}
                  <h3 style={{ fontSize: '11px', fontFamily: "'Orbitron', monospace", fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', marginBottom: '8px' }}>
                    LINK LOSS & GAIN PATH
                  </h3>
                  <WaterfallChart
                    eirp={simParams.eirp}
                    fspl={avgFspl}
                    atmos={avgAtmos}
                    rxGain={simParams.gr}
                    miscLoss={2.0}
                    rxPower={mcResult.expected_pr}
                  />

                  {/* Simulation distributions charts */}
                  <SimulationCharts mcData={mcResult} tsData={tsResult} />
                </div>
              )
            )}
          </div>
        </div>

        {/* ── Parameter Form Panel (Right) ─────────────────────────────── */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(6,10,18,0.9)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <h2 style={{ fontSize: 11, fontFamily: "'Orbitron', monospace", fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>LINK BUDGET</h2>
            <button
              onClick={runSimulation}
              disabled={isSimulating}
              style={{
                fontSize: 10, fontFamily: "'Orbitron', monospace", fontWeight: 700, letterSpacing: '0.05em',
                background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.4)',
                color: '#22d3ee', padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                opacity: isSimulating ? 0.4 : 1, transition: 'all 0.2s',
              }}
            >
              CALCULATE
            </button>
          </div>

          {/* Presets */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: 9, fontFamily: "'Orbitron', monospace", color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>PRESETS</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(Object.keys(LINK_BUDGET_PRESETS) as PresetKey[]).map(key => (
                <button
                  key={key} onClick={() => loadPreset(key)}
                  style={{
                    fontSize: 8, fontFamily: "'Orbitron', monospace", padding: '4px 8px',
                    background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
                    color: 'rgba(167,139,250,0.85)', borderRadius: 3, cursor: 'pointer', letterSpacing: '0.04em',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(167,139,250,0.18)'; }}
                  onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(167,139,250,0.08)'; }}
                >
                  {LINK_BUDGET_PRESETS[key].label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Form Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {([
              { id: 'space', label: 'SPACE' },
              { id: 'ground', label: 'GROUND' },
              { id: 'link', label: 'HARDWARE' },
            ] as const).map(t => (
              <button
                key={t.id} onClick={() => setActiveTab(t.id)}
                style={{
                  flex: 1, padding: '10px 4px', fontSize: 9, fontFamily: "'Orbitron', monospace", fontWeight: 600,
                  letterSpacing: '0.08em', border: 'none', cursor: 'pointer',
                  background: activeTab === t.id ? 'rgba(34,211,238,0.06)' : 'transparent',
                  color: activeTab === t.id ? '#22d3ee' : 'rgba(255,255,255,0.3)',
                  borderBottom: activeTab === t.id ? '2px solid #22d3ee' : '2px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Parameters Sliders */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
            {activeTab === 'space' && (
              <>
                <div style={{ fontSize: 9, fontFamily: "'Orbitron', monospace", color: 'rgba(255,255,255,0.3)', marginBottom: 12, letterSpacing: '0.05em' }}>SPACE SEGMENT</div>
                
                {/* Altitude */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>Orbit Altitude</span>
                    <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{simParams.altitude} km</span>
                  </div>
                  <input
                    type="range" min={160} max={2000} step={10} value={simParams.altitude}
                    onChange={e => setSimParams(prev => ({ ...prev, altitude: parseInt(e.target.value) }))}
                    style={{ width: '100%', height: 3, accentColor: '#22d3ee' }}
                  />
                </div>

                {/* Inclination */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>Inclination</span>
                    <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{simParams.inclination}°</span>
                  </div>
                  <input
                    type="range" min={0} max={90} step={1} value={simParams.inclination}
                    onChange={e => setSimParams(prev => ({ ...prev, inclination: parseFloat(e.target.value) }))}
                    style={{ width: '100%', height: 3, accentColor: '#22d3ee' }}
                  />
                </div>
              </>
            )}

            {activeTab === 'ground' && (
              <>
                <div style={{ fontSize: 9, fontFamily: "'Orbitron', monospace", color: 'rgba(255,255,255,0.3)', marginBottom: 12, letterSpacing: '0.05em' }}>GROUND SEGMENT</div>

                {/* Latitude */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>Observer Latitude</span>
                    <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{simParams.latitude}°</span>
                  </div>
                  <input
                    type="range" min={-90} max={90} step={1} value={simParams.latitude}
                    onChange={e => setSimParams(prev => ({ ...prev, latitude: parseFloat(e.target.value) }))}
                    style={{ width: '100%', height: 3, accentColor: '#22d3ee' }}
                  />
                </div>

                {/* Min Elevation */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>Min Elevation Angle</span>
                    <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{simParams.minElevation}°</span>
                  </div>
                  <input
                    type="range" min={0} max={90} step={1} value={simParams.minElevation}
                    onChange={e => setSimParams(prev => ({ ...prev, minElevation: parseFloat(e.target.value) }))}
                    style={{ width: '100%', height: 3, accentColor: '#22d3ee' }}
                  />
                </div>
              </>
            )}

            {activeTab === 'link' && (
              <>
                <div style={{ fontSize: 9, fontFamily: "'Orbitron', monospace", color: 'rgba(255,255,255,0.3)', marginBottom: 12, letterSpacing: '0.05em' }}>LINK HARDWARE</div>

                {/* Frequency */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>Frequency</span>
                    <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{simParams.frequency.toFixed(1)} GHz</span>
                  </div>
                  <input
                    type="range" min={0.1} max={40} step={0.1} value={simParams.frequency}
                    onChange={e => setSimParams(prev => ({ ...prev, frequency: parseFloat(e.target.value) }))}
                    style={{ width: '100%', height: 3, accentColor: '#22d3ee' }}
                  />
                </div>

                {/* EIRP */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>Transmitter EIRP</span>
                    <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{simParams.eirp} dBW</span>
                  </div>
                  <input
                    type="range" min={0} max={80} step={1} value={simParams.eirp}
                    onChange={e => setSimParams(prev => ({ ...prev, eirp: parseFloat(e.target.value) }))}
                    style={{ width: '100%', height: 3, accentColor: '#22d3ee' }}
                  />
                </div>

                {/* Gr */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>Receiver Gain (Gr)</span>
                    <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{simParams.gr} dBi</span>
                  </div>
                  <input
                    type="range" min={0} max={60} step={1} value={simParams.gr}
                    onChange={e => setSimParams(prev => ({ ...prev, gr: parseFloat(e.target.value) }))}
                    style={{ width: '100%', height: 3, accentColor: '#22d3ee' }}
                  />
                </div>

                {/* Required Power */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                    <span>Required Power</span>
                    <span style={{ color: '#22d3ee', fontFamily: 'monospace' }}>{simParams.requiredPower.toFixed(1)} dBW</span>
                  </div>
                  <input
                    type="range" min={-150} max={-80} step={1} value={simParams.requiredPower}
                    onChange={e => setSimParams(prev => ({ ...prev, requiredPower: parseFloat(e.target.value) }))}
                    style={{ width: '100%', height: 3, accentColor: '#22d3ee' }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Cyberpunk Progress Loader Overlay ───────────────────────── */}
      {isSimulating && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(2, 4, 10, 0.95)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
        }}>
          <div style={{ width: '500px', display: 'flex', flexDirection: 'column', fontFamily: "'Share Tech Mono', monospace" }}>
            
            {/* Header */}
            <div style={{
              background: '#fff', color: '#02040a', padding: '12px 20px',
              fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: '14px',
              letterSpacing: '1px', textTransform: 'uppercase', borderRadius: '4px 20px 0 0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>PROPAGATING CONSTELLATION PASSES...</span>
              <span style={{
                animation: 'spinStar 2s linear infinite', display: 'inline-block',
                transformOrigin: 'center'
              }}>✦</span>
            </div>

            {/* Body */}
            <div style={{ background: '#121926', color: '#fff', padding: '24px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0 0 4px 4px' }}>
              
              {/* Text & Percentage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
                <span style={{ fontSize: '72px', fontWeight: 300, lineHeight: 1 }}>{progress}%</span>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#22d3ee', letterSpacing: '1px' }}>NASA SPACE APPS 2025</span>
                  <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>ORBITAL MECHANICS SIMULATOR V1.0</span>
                </div>
              </div>

              {/* Progress Grid Block */}
              <div style={{ display: 'flex', gap: '5px', height: '36px', width: '100%', marginBottom: '12px' }}>
                {Array.from({ length: 20 }).map((_, idx) => {
                  const filled = progress >= ((idx + 1) * 5);
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1, height: '100%', border: '1px solid rgba(255,255,255,0.15)',
                        background: filled ? '#fff' : 'transparent',
                        boxShadow: filled ? '0 0 8px #fff' : 'none',
                        transition: 'background-color 0.1s ease',
                      }}
                    />
                  );
                })}
              </div>

              {/* Animated Glitch Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '60%' }}>
                <div style={{ height: '3px', background: '#22d3ee', width: '80%', opacity: 0.6, animation: 'glitchBar 2s infinite linear alternate' }} />
                <div style={{ height: '3px', background: '#a78bfa', width: '50%', opacity: 0.5, animation: 'glitchBar 2.5s infinite linear alternate-reverse' }} />
              </div>

            </div>
          </div>
          <style>{`
            @keyframes spinStar {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes glitchBar {
              0% { width: 10%; }
              40% { width: 80%; }
              70% { width: 30%; }
              100% { width: 100%; }
            }
          `}</style>
        </div>
      )}
    </LeoLayout>
  );
}
