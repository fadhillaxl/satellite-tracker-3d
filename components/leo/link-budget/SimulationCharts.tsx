'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { MonteCarloResult, TimeSeriesResult } from '@/lib/leo/linkBudget';

// Register Chart.js components
Chart.register(...registerables);

interface SimulationChartsProps {
  mcData: MonteCarloResult;
  tsData: TimeSeriesResult;
}

// Simple helper to create histogram bins
function createHistogram(data: number[], bins = 30) {
  if (data.length === 0) {
    return { edges: [], counts: [], density: [], binWidth: 0, centers: [] };
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;
  const binWidth = range === 0 ? 1 : range / bins;
  const counts = new Array(bins).fill(0);
  const edges: number[] = [];

  for (let i = 0; i <= bins; i++) {
    edges.push(min + i * binWidth);
  }

  for (const val of data) {
    const idx = Math.min(Math.floor((val - min) / binWidth), bins - 1);
    counts[idx]++;
  }

  const totalArea = data.length * binWidth;
  const density = counts.map(c => (totalArea > 0 ? c / totalArea : 0));
  const centers = edges.slice(0, -1).map((e, i) => (e + edges[i + 1]) / 2);

  return { edges, counts, density, binWidth, centers };
}

// Simple Gamma PDF helper for plotting
function gammaPDF(x: number, alpha: number, loc: number, beta: number): number {
  const z = (x - loc) / beta;
  if (z <= 0) return 0;
  
  const logGamma = (val: number): number => {
    if (val <= 0) return 0;
    return (val - 0.5) * Math.log(val) - val + 0.5 * Math.log(2 * Math.PI) +
      1 / (12 * val) - 1 / (360 * val * val * val);
  };

  const logPdf = (alpha - 1) * Math.log(z) - z - logGamma(alpha) - Math.log(beta);
  return Math.exp(logPdf);
}

export default function SimulationCharts({ mcData, tsData }: SimulationChartsProps) {
  const chartInstances = useRef<Record<string, Chart>>({});

  const canvasRefs = {
    elevationPdf: useRef<HTMLCanvasElement>(null),
    powerComparison: useRef<HTMLCanvasElement>(null),
    rangeElevation: useRef<HTMLCanvasElement>(null),
    pathLoss: useRef<HTMLCanvasElement>(null),
    contactDuration: useRef<HTMLCanvasElement>(null),
    gammaPdf: useRef<HTMLCanvasElement>(null),
    cdf: useRef<HTMLCanvasElement>(null),
  };

  useEffect(() => {
    // Helper to destroy an existing chart
    const destroyChart = (key: string) => {
      if (chartInstances.current[key]) {
        chartInstances.current[key].destroy();
        delete chartInstances.current[key];
      }
    };

    const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 9, family: 'monospace' } },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
        y: {
          ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 9, family: 'monospace' } },
          grid: { color: 'rgba(255,255,255,0.06)' },
        },
      },
    };

    // ── 1. Elevation PDF (Histogram) ────────────────────────────────────────
    const drawElevationPdf = () => {
      const canvas = canvasRefs.elevationPdf.current;
      if (!canvas) return;
      destroyChart('elevationPdf');

      const hist = createHistogram(mcData.chartData.thetaSamples, 30);
      const labels = hist.edges.slice(0, -1).map((e, i) => ((e + hist.edges[i + 1]) / 2).toFixed(1));

      chartInstances.current.elevationPdf = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: hist.counts,
            backgroundColor: 'rgba(34, 211, 238, 0.4)',
            borderColor: '#22d3ee',
            borderWidth: 1,
          }],
        },
        options: {
          ...commonOptions,
          scales: {
            x: {
              ...commonOptions.scales.x,
              title: { display: true, text: 'Elevation Angle (deg)', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            },
            y: {
              ...commonOptions.scales.y,
              title: { display: true, text: 'Frequency', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            }
          }
        }
      });
    };

    // ── 2. Power Comparison (Horizontal Bar) ────────────────────────────────
    const drawPowerComparison = () => {
      const canvas = canvasRefs.powerComparison.current;
      if (!canvas) return;
      destroyChart('powerComparison');

      chartInstances.current.powerComparison = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: ['Worst Case', 'Expected', 'Best Case', 'Required'],
          datasets: [{
            data: [
              mcData.worst_case_pr,
              mcData.expected_pr,
              mcData.best_case_pr,
              mcData.chartData.requiredPower,
            ],
            backgroundColor: [
              'rgba(239, 68, 68, 0.7)',
              'rgba(52, 211, 153, 0.7)',
              'rgba(34, 211, 238, 0.7)',
              'rgba(245, 158, 11, 0.7)',
            ],
            borderWidth: 0,
          }],
        },
        options: {
          ...commonOptions,
          indexAxis: 'y',
          scales: {
            x: {
              ...commonOptions.scales.x,
              title: { display: true, text: 'Power (dBW)', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            },
            y: commonOptions.scales.y
          }
        }
      });
    };

    // ── 3. Slant Range vs Elevation (Scatter) ──────────────────────────────
    const drawRangeElevation = () => {
      const canvas = canvasRefs.rangeElevation.current;
      if (!canvas) return;
      destroyChart('rangeElevation');

      const xData = mcData.chartData.thetaSamples;
      const yData = mcData.chartData.slantRangeSamples;
      const step = Math.max(1, Math.floor(xData.length / 500));
      const points = [];
      for (let i = 0; i < xData.length; i += step) {
        points.push({ x: xData[i], y: yData[i] });
      }

      chartInstances.current.rangeElevation = new Chart(canvas, {
        type: 'scatter',
        data: {
          datasets: [{
            data: points,
            backgroundColor: 'rgba(245, 158, 11, 0.4)',
            borderColor: '#f59e0b',
            pointRadius: 2,
          }],
        },
        options: {
          ...commonOptions,
          scales: {
            x: {
              ...commonOptions.scales.x,
              title: { display: true, text: 'Elevation Angle (deg)', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            },
            y: {
              ...commonOptions.scales.y,
              title: { display: true, text: 'Slant Range (km)', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            }
          }
        }
      });
    };

    // ── 4. Path Loss (Histogram) ────────────────────────────────────────────
    const drawPathLoss = () => {
      const canvas = canvasRefs.pathLoss.current;
      if (!canvas) return;
      destroyChart('pathLoss');

      const hist = createHistogram(mcData.chartData.fsplSamples, 30);
      const labels = hist.edges.slice(0, -1).map((e, i) => ((e + hist.edges[i + 1]) / 2).toFixed(1));

      chartInstances.current.pathLoss = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: hist.counts,
            backgroundColor: 'rgba(244, 63, 94, 0.4)',
            borderColor: '#f43f5e',
            borderWidth: 1,
          }],
        },
        options: {
          ...commonOptions,
          scales: {
            x: {
              ...commonOptions.scales.x,
              title: { display: true, text: 'Total Attenuation (dB)', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            },
            y: {
              ...commonOptions.scales.y,
              title: { display: true, text: 'Frequency', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            }
          }
        }
      });
    };

    // ── 5. Contact Duration (Histogram) ─────────────────────────────────────
    const drawContactDuration = () => {
      const canvas = canvasRefs.contactDuration.current;
      if (!canvas) return;
      destroyChart('contactDuration');

      const hist = createHistogram(tsData.contactDurations, 25);
      const labels = hist.centers.map(c => c.toFixed(0));

      chartInstances.current.contactDuration = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: hist.counts,
            backgroundColor: 'rgba(13, 148, 136, 0.4)',
            borderColor: '#0d9488',
            borderWidth: 1,
          }],
        },
        options: {
          ...commonOptions,
          scales: {
            x: {
              ...commonOptions.scales.x,
              title: { display: true, text: 'Duration (seconds)', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            },
            y: {
              ...commonOptions.scales.y,
              title: { display: true, text: 'Frequency', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            }
          }
        }
      });
    };

    // ── 6. Gamma PDF with Fit Line ──────────────────────────────────────────
    const drawGammaPdf = () => {
      const canvas = canvasRefs.gammaPdf.current;
      if (!canvas) return;
      destroyChart('gammaPdf');

      const hist = createHistogram(tsData.visibleTheta, 40);
      const labels = hist.centers.map(c => c.toFixed(1));

      const pdfLineData = labels.map(label => {
        const x = parseFloat(label);
        return gammaPDF(x, tsData.gammaParams.alpha, tsData.gammaParams.loc, tsData.gammaParams.beta);
      });

      chartInstances.current.gammaPdf = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              type: 'bar' as const,
              label: 'Monte Carlo Data',
              data: hist.density,
              backgroundColor: 'rgba(158, 158, 158, 0.25)',
              borderColor: '#9e9e9e',
              borderWidth: 1,
              order: 2,
            },
            {
              type: 'line' as const,
              label: `Gamma Fit (a=${tsData.gammaParams.alpha.toFixed(2)}, b=${tsData.gammaParams.beta.toFixed(2)})`,
              data: pdfLineData,
              borderColor: '#ef4444',
              borderWidth: 2,
              fill: false,
              tension: 0.4,
              pointRadius: 0,
              order: 1,
            }
          ]
        },
        options: {
          ...commonOptions,
          plugins: {
            legend: {
              display: true,
              labels: { color: 'rgba(255,255,255,0.6)', font: { size: 9, family: 'monospace' } }
            }
          },
          scales: {
            x: {
              ...commonOptions.scales.x,
              title: { display: true, text: 'Elevation Angle (deg)', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            },
            y: {
              ...commonOptions.scales.y,
              title: { display: true, text: 'Probability Density', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            }
          }
        }
      });
    };

    // ── 7. CDF Curves ───────────────────────────────────────────────────────
    const drawCdf = () => {
      const canvas = canvasRefs.cdf.current;
      if (!canvas) return;
      destroyChart('cdf');

      const step = Math.max(1, Math.floor(tsData.cdfData.x.length / 200));
      const empiricalPoints = [];
      const gammaPoints = [];

      for (let i = 0; i < tsData.cdfData.x.length; i += step) {
        empiricalPoints.push({ x: tsData.cdfData.x[i], y: tsData.cdfData.empiricalY[i] });
        gammaPoints.push({ x: tsData.cdfData.x[i], y: tsData.cdfData.gammaY[i] });
      }

      chartInstances.current.cdf = new Chart(canvas, {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Empirical CDF',
              data: empiricalPoints,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              showLine: true,
              pointRadius: 0,
              borderWidth: 2,
              order: 1,
            },
            {
              label: 'Gamma Fit CDF',
              data: gammaPoints,
              borderColor: '#ef4444',
              backgroundColor: 'transparent',
              showLine: true,
              pointRadius: 0,
              borderWidth: 2,
              borderDash: [5, 5],
              order: 2,
            }
          ]
        },
        options: {
          ...commonOptions,
          plugins: {
            legend: {
              display: true,
              labels: { color: 'rgba(255,255,255,0.6)', font: { size: 9, family: 'monospace' } }
            }
          },
          scales: {
            x: {
              ...commonOptions.scales.x,
              title: { display: true, text: 'Elevation Angle (deg)', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } }
            },
            y: {
              ...commonOptions.scales.y,
              title: { display: true, text: 'Probability', color: 'rgba(255,255,255,0.4)', font: { size: 10, family: 'monospace' } },
              min: 0,
              max: 1
            }
          }
        }
      });
    };

    // Draw all charts
    drawElevationPdf();
    drawPowerComparison();
    drawRangeElevation();
    drawPathLoss();
    drawContactDuration();
    drawGammaPdf();
    drawCdf();

    // Clean up
    return () => {
      Object.keys(chartInstances.current).forEach(destroyChart);
    };
  }, [mcData, tsData]);

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    overflow: 'hidden',
  };

  const wrapperStyle = {
    width: '100%',
    height: '220px',
    padding: '10px',
    position: 'relative' as const,
  };

  const titleStyle = {
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
    padding: '10px 12px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(0,0,0,0.2)',
    fontFamily: "'Orbitron', monospace",
    letterSpacing: '0.05em',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px', marginTop: '24px' }}>
      <div style={cardStyle}>
        <div style={wrapperStyle}><canvas ref={canvasRefs.elevationPdf} /></div>
        <div style={titleStyle}>ELEVATION PROBABILITY DENSITY</div>
      </div>

      <div style={cardStyle}>
        <div style={wrapperStyle}><canvas ref={canvasRefs.powerComparison} /></div>
        <div style={titleStyle}>SIGNAL POWER COMPARISON</div>
      </div>

      <div style={cardStyle}>
        <div style={wrapperStyle}><canvas ref={canvasRefs.rangeElevation} /></div>
        <div style={titleStyle}>SLANT RANGE VS ELEVATION</div>
      </div>

      <div style={cardStyle}>
        <div style={wrapperStyle}><canvas ref={canvasRefs.pathLoss} /></div>
        <div style={titleStyle}>PATH LOSS + ATMOSPHERIC LOSS</div>
      </div>

      <div style={cardStyle}>
        <div style={wrapperStyle}><canvas ref={canvasRefs.contactDuration} /></div>
        <div style={titleStyle}>CONTACT DURATION DISTRIBUTION</div>
      </div>

      <div style={cardStyle}>
        <div style={wrapperStyle}><canvas ref={canvasRefs.gammaPdf} /></div>
        <div style={titleStyle}>GAMMA ELEVATION PDF FIT</div>
      </div>

      <div style={cardStyle}>
        <div style={wrapperStyle}><canvas ref={canvasRefs.cdf} /></div>
        <div style={titleStyle}>CUMULATIVE DISTRIBUTION (CDF)</div>
      </div>
    </div>
  );
}
