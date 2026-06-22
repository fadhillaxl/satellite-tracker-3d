/**
 * Link Budget Calculator — Friis transmission equation.
 * Pure TypeScript — no DOM dependencies.
 */

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Speed of light (m/s) */
const C = 299_792_458;

/** Boltzmann constant (J/K) */
const K_B = 1.380649e-23;

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface TransmitterParams {
  /** Transmit power (dBW) */
  txPowerDbw: number;
  /** Antenna gain (dBi) */
  txGainDbi: number;
  /** Line losses (dB) — positive value */
  txLossesDb: number;
  /** Frequency (MHz) */
  frequencyMhz: number;
}

export interface ReceiverParams {
  /** Antenna gain (dBi) */
  rxGainDbi: number;
  /** System noise temperature (K) */
  systemTempK: number;
  /** Line losses (dB) — positive value */
  rxLossesDb: number;
  /** Required Eb/N0 (dB) — depends on modulation/coding */
  requiredEbN0Db: number;
  /** Data rate (kbps) */
  dataRateKbps: number;
}

export interface EnvironmentParams {
  /** Slant range (km) */
  rangeKm: number;
  /** Atmospheric / rain attenuation (dB) */
  atmosphericLossDb: number;
  /** Pointing loss (dB) */
  pointingLossDb: number;
  /** Polarization loss (dB) */
  polarizationLossDb: number;
}

export interface LinkBudgetResult {
  /** EIRP = Tx power + Tx gain - Tx losses (dBW) */
  eirpDbw: number;
  /** Free-space path loss (dB) */
  fsplDb: number;
  /** Total received power (dBW) */
  rxPowerDbw: number;
  /** Noise power density (dBW/Hz) */
  noisePowerDensityDbwHz: number;
  /** Carrier-to-noise density ratio C/N0 (dB·Hz) */
  cN0DbHz: number;
  /** Carrier-to-noise ratio C/N (dB) — at the given bandwidth */
  cNDb: number;
  /** Eb/N0 (dB) */
  ebN0Db: number;
  /** Link margin (dB) = actual Eb/N0 - required Eb/N0 */
  linkMarginDb: number;
  /** Shannon capacity upper bound (Mbps) */
  shannonCapacityMbps: number;
  /** G/T (dB/K) */
  gOverTDbK: number;
}

// ─── Core Calculations ──────────────────────────────────────────────────────────

/**
 * Free-Space Path Loss (dB)
 * FSPL = 20·log10(4πRf/c)
 */
export function freespacePathLossDb(rangeKm: number, frequencyMhz: number): number {
  const rangeM = rangeKm * 1000;
  const freqHz = frequencyMhz * 1e6;
  return 20 * Math.log10((4 * Math.PI * rangeM * freqHz) / C);
}

/**
 * Compute the full link budget.
 */
export function computeLinkBudget(
  tx: TransmitterParams,
  rx: ReceiverParams,
  env: EnvironmentParams,
): LinkBudgetResult {
  // EIRP
  const eirpDbw = tx.txPowerDbw + tx.txGainDbi - tx.txLossesDb;

  // Free-Space Path Loss
  const fsplDb = freespacePathLossDb(env.rangeKm, tx.frequencyMhz);

  // Total received power (dBW)
  const rxPowerDbw =
    eirpDbw
    - fsplDb
    - env.atmosphericLossDb
    - env.pointingLossDb
    - env.polarizationLossDb
    + rx.rxGainDbi
    - rx.rxLossesDb;

  // G/T (dB/K)
  const gOverTDbK = rx.rxGainDbi - 10 * Math.log10(rx.systemTempK);

  // Noise power density N0 (dBW/Hz)
  const noisePowerDensityDbwHz = 10 * Math.log10(K_B * rx.systemTempK);

  // C/N0 (dB·Hz)
  const cN0DbHz = rxPowerDbw - noisePowerDensityDbwHz;

  // Data rate in Hz
  const dataRateHz = rx.dataRateKbps * 1000;
  const dataRateDb = 10 * Math.log10(dataRateHz);

  // Eb/N0 (dB)
  const ebN0Db = cN0DbHz - dataRateDb;

  // C/N (using noise BW = data rate as approximation)
  const cNDb = cN0DbHz - dataRateDb;

  // Link margin
  const linkMarginDb = ebN0Db - rx.requiredEbN0Db;

  // Shannon capacity: C = B * log2(1 + SNR)
  // SNR (linear) from C/N
  const cNLinear = Math.pow(10, cNDb / 10);
  const bandwidthHz = dataRateHz; // approximation: BW ≈ data rate
  const shannonCapacityMbps = (bandwidthHz * Math.log2(1 + cNLinear)) / 1e6;

  return {
    eirpDbw,
    fsplDb,
    rxPowerDbw,
    noisePowerDensityDbwHz,
    cN0DbHz,
    cNDb,
    ebN0Db,
    linkMarginDb,
    shannonCapacityMbps,
    gOverTDbK,
  };
}

// ─── Presets ────────────────────────────────────────────────────────────────────

export const LINK_BUDGET_PRESETS = {
  starlink_ku: {
    label: 'Starlink Ku-Band',
    tx: { txPowerDbw: 7.0, txGainDbi: 34.5, txLossesDb: 1.0, frequencyMhz: 14_250 },
    rx: { rxGainDbi: 33.5, systemTempK: 200, rxLossesDb: 0.5, requiredEbN0Db: 5.0, dataRateKbps: 150_000 },
    env: { rangeKm: 550, atmosphericLossDb: 0.5, pointingLossDb: 0.3, polarizationLossDb: 0.1 },
  },
  oneweb_ka: {
    label: 'OneWeb Ka-Band',
    tx: { txPowerDbw: 8.0, txGainDbi: 36.0, txLossesDb: 1.0, frequencyMhz: 27_500 },
    rx: { rxGainDbi: 35.0, systemTempK: 180, rxLossesDb: 0.5, requiredEbN0Db: 6.0, dataRateKbps: 100_000 },
    env: { rangeKm: 1200, atmosphericLossDb: 1.0, pointingLossDb: 0.5, polarizationLossDb: 0.1 },
  },
  vhf_cubesat: {
    label: 'VHF CubeSat Downlink',
    tx: { txPowerDbw: -3.0, txGainDbi: 2.0, txLossesDb: 0.5, frequencyMhz: 437 },
    rx: { rxGainDbi: 7.0, systemTempK: 290, rxLossesDb: 1.0, requiredEbN0Db: 10.0, dataRateKbps: 9.6 },
    env: { rangeKm: 600, atmosphericLossDb: 0.3, pointingLossDb: 1.0, polarizationLossDb: 0.5 },
  },
} as const;

export type PresetKey = keyof typeof LINK_BUDGET_PRESETS;

// ─── Slant Range ───────────────────────────────────────────────────────────────

/**
 * Compute slant range (km) from orbital altitude and elevation angle.
 * @param altKm orbit altitude (km)
 * @param elevationDeg ground elevation angle (degrees, 0 = horizon)
 */
export function slantRangeKm(altKm: number, elevationDeg: number): number {
  const EARTH_R = 6371; // km
  const elRad = (elevationDeg * Math.PI) / 180;
  return (
    Math.sqrt(
      Math.pow(EARTH_R * Math.sin(elRad), 2) +
      altKm * (altKm + 2 * EARTH_R)
    ) - EARTH_R * Math.sin(elRad)
  );
}

// ─── Simulation Types & Functions ──────────────────────────────────────────────

export interface LinkBudgetSimParams {
  altitude: number;      // km
  inclination: number;   // degrees
  latitude: number;      // degrees
  minElevation: number;   // degrees
  frequency: number;     // GHz
  eirp: number;          // dBW
  gr: number;            // dBi
  requiredPower: number; // dBW
}

export interface MonteCarloResult {
  expected_pr: number;
  worst_case_pr: number;
  best_case_pr: number;
  std_dev_pr: number;
  samples_count: number;
  visibility_ratio: number;
  link_margin_expected: number;
  link_margin_worst: number;
  link_margin_best: number;
  chartData: {
    thetaSamples: number[];
    slantRangeSamples: number[];
    prSamples: number[];
    fsplSamples: number[];
    requiredPower: number;
  };
}

export interface TrackPoint {
  az: number;
  el: number;
}

export interface SimulationPass {
  start: number;
  duration: number;
  track: TrackPoint[];
}

export interface TimeSeriesResult {
  days: number;
  stepS: number;
  contactDurations: number[];
  meanContactDuration: number;
  numContacts: number;
  visibleTheta: number[];
  gammaParams: {
    alpha: number;
    loc: number;
    beta: number;
  };
  pdfData: { x: number[]; y: number[] };
  cdfData: {
    x: number[];
    empiricalY: number[];
    gammaY: number[];
  };
  passes3D: {
    shortest: SimulationPass | null;
    median: SimulationPass | null;
    longest: SimulationPass | null;
  };
}

const EARTH_R = 6371.0;
const GM_EARTH = 3.986004418e5; // km^3/s^2

function randomUniform(min: number, max: number, n: number): Float64Array {
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    samples[i] = min + Math.random() * (max - min);
  }
  return samples;
}

export function runMonteCarloSimulation(params: LinkBudgetSimParams, nSamples = 30000): MonteCarloResult {
  const { altitude, inclination, latitude, minElevation, frequency, eirp, gr, requiredPower } = params;

  const h = altitude;
  const inc = inclination * Math.PI / 180;
  const latEs = latitude * Math.PI / 180;
  const thetaMin = minElevation * Math.PI / 180;
  const r = EARTH_R + h;

  // Monte Carlo samples
  const M = randomUniform(0, 2 * Math.PI, nSamples);
  const Omega = randomUniform(0, 2 * Math.PI, nSamples);

  // Earth station position
  const xEs = EARTH_R * Math.cos(latEs);
  const yEs = 0;
  const zEs = EARTH_R * Math.sin(latEs);

  // Arrays for visible samples
  const thetaSamples: number[] = [];
  const slantRangeSamples: number[] = [];
  const prSamples: number[] = [];
  const fsplSamples: number[] = [];

  for (let i = 0; i < nSamples; i++) {
    // Satellite position
    const cosM = Math.cos(M[i]);
    const sinM = Math.sin(M[i]);
    const cosO = Math.cos(Omega[i]);
    const sinO = Math.sin(Omega[i]);
    const cosInc = Math.cos(inc);
    const sinInc = Math.sin(inc);

    const xSat = r * (cosO * cosM - sinO * sinM * cosInc);
    const ySat = r * (sinO * cosM + cosO * sinM * cosInc);
    const zSat = r * (sinM * sinInc);

    // Slant range
    const rx = xSat - xEs;
    const ry = ySat - yEs;
    const rz = zSat - zEs;
    const rangeKm = Math.sqrt(rx * rx + ry * ry + rz * rz);

    // Elevation angle
    const zenithDotRange = (xEs * rx + yEs * ry + zEs * rz) / EARTH_R;
    const sinEl = zenithDotRange / rangeKm;
    const thetaRad = Math.asin(Math.max(-1, Math.min(1, sinEl)));

    // Check visibility
    if (thetaRad >= thetaMin) {
      thetaSamples.push(thetaRad * 180 / Math.PI);
      slantRangeSamples.push(rangeKm);

      // FSPL calculation (frequency in GHz)
      const fspl = 92.45 + 20 * Math.log10(rangeKm) + 20 * Math.log10(frequency);
      const zenithLoss = 0.5 / Math.sin(thetaRad);
      const totalAttenuation = fspl + zenithLoss;
      const sysLoss = 2.0;
      const pr = eirp + gr - totalAttenuation - sysLoss;

      prSamples.push(pr);
      fsplSamples.push(totalAttenuation);
    }
  }

  // Statistical calculations
  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr: number[]) => {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((acc, val) => acc + (val - m) ** 2, 0) / arr.length);
  };

  const expectedPr = prSamples.length > 0 ? mean(prSamples) : 0;
  const worstPr = prSamples.length > 0 ? Math.min(...prSamples) : 0;
  const bestPr = prSamples.length > 0 ? Math.max(...prSamples) : 0;
  const stdPr = prSamples.length > 0 ? std(prSamples) : 0;

  return {
    expected_pr: expectedPr,
    worst_case_pr: worstPr,
    best_case_pr: bestPr,
    std_dev_pr: stdPr,
    samples_count: prSamples.length,
    visibility_ratio: (prSamples.length / nSamples) * 100,
    link_margin_expected: expectedPr - requiredPower,
    link_margin_worst: worstPr - requiredPower,
    link_margin_best: bestPr - requiredPower,
    chartData: {
      thetaSamples,
      slantRangeSamples,
      prSamples,
      fsplSamples,
      requiredPower
    }
  };
}

export function runTimeSeriesSimulation(
  params: LinkBudgetSimParams,
  days = 60,
  stepS = 10,
): TimeSeriesResult {
  const { altitude, inclination, latitude, minElevation } = params;

  const h = altitude;
  const inc = inclination * Math.PI / 180;
  const latEs = latitude * Math.PI / 180;
  const thetaMinRad = minElevation * Math.PI / 180;
  const rOrbit = EARTH_R + h;

  // Mean motion
  const n = Math.sqrt(GM_EARTH / Math.pow(rOrbit, 3));

  // Time array
  const totalSeconds = days * 24 * 3600;
  const numSteps = Math.floor(totalSeconds / stepS);

  // J2 Perturbation
  const J2 = 1.08263e-3;
  const raanRate = -1.5 * n * Math.pow(EARTH_R / rOrbit, 2) * Math.cos(inc) * J2;

  // Earth rotation rate
  const we = 7.292115e-5;

  // Random start longitude
  const startLon = Math.random() * 2 * Math.PI;

  const cosLat = Math.cos(latEs);
  const sinLat = Math.sin(latEs);

  const visibleTheta: number[] = [];
  const contactDurations: number[] = [];
  let currentPass: { start: number; track: TrackPoint[] } | null = null;
  const allPasses: SimulationPass[] = [];

  // Propagate orbit
  for (let i = 0; i < numSteps; i++) {
    const t = i * stepS;

    // J2 disturbed Mean Anomaly & RAAN
    const M = n * t;
    const currentRaan = startLon + raanRate * t;

    // Sat ECI Position
    const u = M; // circular orbit approximation
    const xPrime = rOrbit * Math.cos(u);
    const yPrime = rOrbit * Math.sin(u);

    const xSat = xPrime * Math.cos(currentRaan) - yPrime * Math.cos(inc) * Math.sin(currentRaan);
    const ySat = xPrime * Math.sin(currentRaan) + yPrime * Math.cos(inc) * Math.cos(currentRaan);
    const zSat = yPrime * Math.sin(inc);

    // Earth Rotation angle
    const thetaG = we * t;

    // Earth Station ECI Position
    const xEsRot = (EARTH_R * cosLat) * Math.cos(thetaG);
    const yEsRot = (EARTH_R * cosLat) * Math.sin(thetaG);
    const zEsRot = (EARTH_R * sinLat);

    // Range Vector
    const rx = xSat - xEsRot;
    const ry = ySat - yEsRot;
    const rz = zSat - zEsRot;
    const range = Math.sqrt(rx * rx + ry * ry + rz * rz);

    // Topocentric Basis vectors
    const ux = xEsRot / EARTH_R;
    const uy = yEsRot / EARTH_R;
    const uz = zEsRot / EARTH_R;

    const ex = -Math.sin(thetaG);
    const ey = Math.cos(thetaG);
    const ez = 0;

    const nx = uy * ez - uz * ey;
    const ny = uz * ex - ux * ez;
    const nz = ux * ey - uy * ex;

    // Project Range vector
    const rUp = rx * ux + ry * uy + rz * uz;
    const rEast = rx * ex + ry * ey + rz * ez;
    const rNorth = rx * nx + ry * ny + rz * nz;

    // Elevation
    const sinEl = rUp / range;
    const elRad = Math.asin(Math.max(-1, Math.min(1, sinEl)));
    const elDeg = elRad * 180 / Math.PI;

    // Azimuth
    const azRad = Math.atan2(rEast, rNorth);
    let azDeg = azRad * 180 / Math.PI;
    if (azDeg < 0) azDeg += 360;

    if (elRad >= thetaMinRad) {
      visibleTheta.push(elDeg);

      if (!currentPass) {
        currentPass = { start: t, track: [] };
      }
      currentPass.track.push({ az: azDeg, el: elDeg });
    } else {
      if (currentPass) {
        const duration = t - currentPass.start;
        if (currentPass.track.length > 2) {
          contactDurations.push(duration);
          allPasses.push({ start: currentPass.start, duration, track: currentPass.track });
        }
        currentPass = null;
      }
    }
  }

  if (currentPass) {
    const duration = totalSeconds - currentPass.start;
    if (currentPass.track.length > 2) {
      contactDurations.push(duration);
      allPasses.push({ start: currentPass.start, duration, track: currentPass.track });
    }
  }

  // Find shortest, median, longest passes
  allPasses.sort((a, b) => a.duration - b.duration);
  const passes3D = {
    shortest: allPasses.length > 0 ? allPasses[0] : null,
    median: allPasses.length > 0 ? allPasses[Math.floor(allPasses.length / 2)] : null,
    longest: allPasses.length > 0 ? allPasses[allPasses.length - 1] : null
  };

  const gammaParams = fitGamma(visibleTheta);

  // Generate PDF/CDF Data
  const sortedTheta = [...visibleTheta].sort((a, b) => a - b);
  const minTheta = minElevation;
  const maxTheta = 90;
  const pdfX: number[] = [];
  const pdfY: number[] = [];
  const cdfEmpiricalY: number[] = [];
  const cdfGammaY: number[] = [];

  for (let x = minTheta; x <= maxTheta; x += 0.5) {
    pdfX.push(x);
    pdfY.push(gammaPDF(x, gammaParams.alpha, gammaParams.loc, gammaParams.beta));
  }

  for (let i = 0; i < sortedTheta.length; i++) {
    cdfEmpiricalY.push((i + 1) / sortedTheta.length);
    cdfGammaY.push(gammaCDF(sortedTheta[i], gammaParams.alpha, gammaParams.loc, gammaParams.beta));
  }

  return {
    days,
    stepS,
    contactDurations,
    meanContactDuration: contactDurations.length > 0 ?
      contactDurations.reduce((a, b) => a + b, 0) / contactDurations.length : 0,
    numContacts: contactDurations.length,
    visibleTheta,
    gammaParams,
    pdfData: { x: pdfX, y: pdfY },
    cdfData: {
      x: sortedTheta,
      empiricalY: cdfEmpiricalY,
      gammaY: cdfGammaY
    },
    passes3D
  };
}

function fitGamma(data: number[]): { alpha: number; loc: number; beta: number } {
  if (data.length === 0) {
    return { alpha: 1, loc: 0, beta: 1 };
  }

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((acc, val) => acc + (val - mean) ** 2, 0) / data.length;
  const loc = Math.min(...data) * 0.9;

  const shiftedMean = mean - loc;
  const alpha = (shiftedMean * shiftedMean) / variance;
  const beta = variance / shiftedMean;

  return { alpha: Math.max(0.1, alpha), loc, beta: Math.max(0.1, beta) };
}

function gammaPDF(x: number, alpha: number, loc: number, beta: number): number {
  const z = (x - loc) / beta;
  if (z <= 0) return 0;
  const logPdf = (alpha - 1) * Math.log(z) - z - logGamma(alpha) - Math.log(beta);
  return Math.exp(logPdf);
}

function gammaCDF(x: number, alpha: number, loc: number, beta: number): number {
  const z = (x - loc) / beta;
  if (z <= 0) return 0;
  return lowerIncompleteGamma(alpha, z) / gamma(alpha);
}

function logGamma(x: number): number {
  if (x <= 0) return 0;
  return (x - 0.5) * Math.log(x) - x + 0.5 * Math.log(2 * Math.PI) +
    1 / (12 * x) - 1 / (360 * x * x * x);
}

function gamma(x: number): number {
  return Math.exp(logGamma(x));
}

function lowerIncompleteGamma(a: number, x: number): number {
  if (x <= 0) return 0;

  let sum = 0;
  let term = 1 / a;
  sum = term;

  for (let n = 1; n < 100; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < 1e-10) break;
  }

  return Math.pow(x, a) * Math.exp(-x) * sum;
}

