/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Satellite Tracker 3D - Local Hardware Agent
 * 
 * Functions:
 * 1. Detects and connects to Hamlib rigctld (TCP 4532) and rotctld (TCP 4533).
 * 2. Automatically falls back to high-fidelity virtual simulations (with realistic rotator slewing)
 *    if the physical daemons are offline, allowing testing without hardware.
 * 3. Establishes a WebSocket connection to the Next.js Cloud Bridge (WS 3002).
 * 4. Periodically pushes hardware telemetry to the cloud.
 * 5. Receives and processes radio frequency and antenna tracking commands from the cloud.
 */

const net = require('net');
const WebSocket = require('ws');

// Terminal color codes
const colors = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  whiteBold: '\x1b[1m\x1b[37m'
};

function log(module, message, color = colors.cyan) {
  const time = new Date().toLocaleTimeString();
  console.log(`${colors.gray}[${time}]${colors.reset} [${color}${module}${colors.reset}] ${message}`);
}

/* ─── Virtual Simulators State ───────────────────────────────────────────── */
const sim = {
  rotator: {
    currentAz: 0.0,
    currentEl: 0.0,
    targetAz: 0.0,
    targetEl: 0.0,
    slewRateAz: 8.0, // deg/sec
    slewRateEl: 4.0, // deg/sec
    lastUpdate: Date.now()
  },
  rig: {
    frequency: 145800000, // 145.800 MHz default (ISS downlink)
    mode: 'FM',
    bandwidth: 15000
  }
};

// Update loop for virtual rotator slewing (runs at 10Hz)
setInterval(() => {
  const now = Date.now();
  const dt = (now - sim.rotator.lastUpdate) / 1000;
  sim.rotator.lastUpdate = now;

  // Slew Azimuth
  let azDiff = sim.rotator.targetAz - sim.rotator.currentAz;
  // Handle 360 wrap-around shortest path
  if (azDiff > 180) azDiff -= 360;
  if (azDiff < -180) azDiff += 360;

  const maxAzStep = sim.rotator.slewRateAz * dt;
  if (Math.abs(azDiff) <= maxAzStep) {
    sim.rotator.currentAz = sim.rotator.targetAz;
  } else {
    sim.rotator.currentAz = (sim.rotator.currentAz + Math.sign(azDiff) * maxAzStep + 360) % 360;
  }

  // Slew Elevation
  const elDiff = sim.rotator.targetEl - sim.rotator.currentEl;
  const maxElStep = sim.rotator.slewRateEl * dt;
  if (Math.abs(elDiff) <= maxElStep) {
    sim.rotator.currentEl = sim.rotator.targetEl;
  } else {
    sim.rotator.currentEl = Math.max(0, Math.min(90, sim.rotator.currentEl + Math.sign(elDiff) * maxElStep));
  }
}, 100);

// Parse command line arguments
const runSimulation = process.argv.includes('--simulate') || process.argv.includes('-s');

/* ─── Virtual Hamlib TCP Servers ────────────────────────────────────────── */
let mockRotServer = null;
let mockRigServer = null;

function startMockRotator() {
  if (mockRotServer) return;
  
  mockRotServer = net.createServer((socket) => {
    log('MOCK-ROTATOR', `${colors.gray}New client connected from ${socket.remoteAddress}:${socket.remotePort}${colors.reset}`, colors.gray);
    let buffer = '';
    
    socket.on('data', (data) => {
      buffer += data.toString();
      while (true) {
        const idx = buffer.indexOf('\n');
        if (idx === -1) break;
        
        const line = buffer.substring(0, idx).trim();
        buffer = buffer.substring(idx + 1);
        if (!line) continue;
        
        const parts = line.split(/\s+/);
        const cmd = parts[0];
        
        if (cmd === 'p' || cmd === '\\get_pos') {
          socket.write(`${sim.rotator.currentAz.toFixed(2)}\n${sim.rotator.currentEl.toFixed(2)}\n`);
        } else if (cmd === 'P' || cmd === '\\set_pos') {
          const az = parseFloat(parts[1]);
          const el = parseFloat(parts[2]);
          if (!isNaN(az) && !isNaN(el)) {
            sim.rotator.targetAz = (az + 360) % 360;
            sim.rotator.targetEl = Math.max(0, Math.min(90, el));
            log('MOCK-ROTATOR', `Target Azimuth set to: ${sim.rotator.targetAz.toFixed(1)}°, Elevation: ${sim.rotator.targetEl.toFixed(1)}°`, colors.magenta);
          }
          socket.write('RPRT 0\n');
        } else {
          socket.write('RPRT 0\n');
        }
      }
    });
    
    socket.on('error', (err) => {
      log('MOCK-ROTATOR', `Client socket error: ${err.message}`, colors.red);
    });
  });
  
  mockRotServer.on('error', (err) => {
    log('MOCK-ROTATOR', `${colors.red}Server error: ${err.message}${colors.reset}`, colors.red);
    mockRotServer = null;
  });
  
  mockRotServer.listen(4533, '127.0.0.1', () => {
    log('MOCK-ROTATOR', `${colors.green}Virtual Rotator Simulator listening on port 4533!${colors.reset}`, colors.green);
  });
}

function startMockRig() {
  if (mockRigServer) return;
  
  mockRigServer = net.createServer((socket) => {
    log('MOCK-RIG', `${colors.gray}New client connected from ${socket.remoteAddress}:${socket.remotePort}${colors.reset}`, colors.gray);
    let buffer = '';
    
    socket.on('data', (data) => {
      buffer += data.toString();
      while (true) {
        const idx = buffer.indexOf('\n');
        if (idx === -1) break;
        
        const line = buffer.substring(0, idx).trim();
        buffer = buffer.substring(idx + 1);
        if (!line) continue;
        
        const parts = line.split(/\s+/);
        const cmd = parts[0];
        
        if (cmd === 'f' || cmd === '\\get_freq') {
          socket.write(`${sim.rig.frequency}\n`);
        } else if (cmd === 'F' || cmd === '\\set_freq') {
          const freq = parseInt(parts[1], 10);
          if (!isNaN(freq)) {
            sim.rig.frequency = freq;
            log('MOCK-RIG', `Frequency set to: ${(freq / 1e6).toFixed(4)} MHz`, colors.magenta);
          }
          socket.write('RPRT 0\n');
        } else if (cmd === 'm' || cmd === '\\get_mode') {
          socket.write(`${sim.rig.mode}\n${sim.rig.bandwidth}\n`);
        } else if (cmd === 'M' || cmd === '\\set_mode') {
          const mode = parts[1];
          const bw = parseInt(parts[2], 10);
          if (mode) sim.rig.mode = mode;
          if (!isNaN(bw)) sim.rig.bandwidth = bw;
          log('MOCK-RIG', `Mode set to: ${sim.rig.mode}, Bandwidth: ${sim.rig.bandwidth} Hz`, colors.magenta);
          socket.write('RPRT 0\n');
        } else {
          socket.write('RPRT 0\n');
        }
      }
    });
    
    socket.on('error', (err) => {
      log('MOCK-RIG', `Client socket error: ${err.message}`, colors.red);
    });
  });
  
  mockRigServer.on('error', (err) => {
    log('MOCK-RIG', `${colors.red}Server error: ${err.message}${colors.reset}`, colors.red);
    mockRigServer = null;
  });
  
  mockRigServer.listen(4532, '127.0.0.1', () => {
    log('MOCK-RIG', `${colors.green}Virtual Rig Simulator listening on port 4532!${colors.reset}`, colors.green);
  });
}


/* ─── TCP Hamlib Client Class ────────────────────────────────────────────── */
class HamlibClient {
  constructor(host, port, name) {
    this.host = host;
    this.port = port;
    this.name = name;
    this.socket = null;
    this.connected = false;
    this.buffer = '';
    this.queue = [];
    this.reconnectTimeout = null;
    this.isRetrying = false;
  }

  connect() {
    if (this.socket) return;
    log(this.name, `Connecting to ${this.host}:${this.port}...`);
    this.isRetrying = true;
    
    this.socket = net.createConnection({ host: this.host, port: this.port });
    this.socket.setTimeout(3000); // 3-second timeout

    this.socket.on('connect', () => {
      this.connected = true;
      this.isRetrying = false;
      this.buffer = '';
      
      const isVirtual = (this.name === 'ROTATOR' && mockRotServer) || (this.name === 'RIG' && mockRigServer);
      if (isVirtual) {
        log(this.name, `${colors.green}Connected to virtual simulator at ${this.host}:${this.port}${colors.reset}`, colors.green);
      } else {
        log(this.name, `${colors.green}Connected to physical daemon at ${this.host}:${this.port}${colors.reset}`, colors.green);
      }
    });

    this.socket.on('data', (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.socket.on('timeout', () => {
      log(this.name, `${colors.yellow}Connection timeout - socket will close${colors.reset}`, colors.yellow);
      this.socket.destroy();
    });

    this.socket.on('close', () => {
      this.handleDisconnect();
    });

    this.socket.on('error', (err) => {
      if (!this.isRetrying) {
        log(this.name, `${colors.red}Socket error: ${err.message}${colors.reset}`, colors.red);
      }
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        if (this.name === 'ROTATOR') {
          startMockRotator();
        } else if (this.name === 'RIG') {
          startMockRig();
        }
      }
    });
  }

  handleDisconnect() {
    const wasConnected = this.connected;
    this.connected = false;
    this.socket = null;
    this.buffer = '';

    // Clear and reject any pending command promises
    while (this.queue.length > 0) {
      const { reject } = this.queue.shift();
      reject(new Error('Connection lost'));
    }

    if (wasConnected) {
      log(this.name, `${colors.yellow}Disconnected. Falling back to virtual simulator.${colors.reset}`, colors.yellow);
    }

    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
  }

  processBuffer() {
    while (true) {
      const idx = this.buffer.indexOf('\n');
      if (idx === -1) break;

      const line = this.buffer.substring(0, idx).trim();
      this.buffer = this.buffer.substring(idx + 1);

      if (this.queue.length > 0) {
        const item = this.queue[0];

        // Detect Hamlib error codes (e.g. RPRT -5) to resolve or reject early and avoid hanging the client
        if (line.startsWith('RPRT')) {
          const parts = line.split(/\s+/);
          const code = parseInt(parts[1], 10);
          if (!isNaN(code) && code < 0) {
            this.queue.shift();
            item.reject(new Error(`Hardware returned error: ${line}`));
            continue;
          }
        }

        item.lines.push(line);
        if (item.lines.length === item.expectedLines) {
          this.queue.shift();
          item.resolve(item.lines);
        }
      }
    }
  }

  send(cmd, expectedLines = 1) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) {
        return reject(new Error('Not connected'));
      }
      this.queue.push({
        cmd,
        expectedLines,
        lines: [],
        resolve,
        reject
      });
      this.socket.write(cmd + '\n');
    });
  }
}

// Instantiate Hamlib clients
const rotClient = new HamlibClient('127.0.0.1', 4533, 'ROTATOR');
const rigClient = new HamlibClient('127.0.0.1', 4532, 'RIG');

// If simulation is manually requested via argument, spawn servers immediately
if (runSimulation) {
  log('AGENT', `${colors.yellow}Simulation mode enabled via CLI flag.${colors.reset}`, colors.yellow);
  startMockRotator();
  startMockRig();
}

// Initiate connections
rotClient.connect();
rigClient.connect();


/* ─── WebSocket Cloud Server Connection ──────────────────────────────────── */
let ws = null;
let wsConnected = false;
let wsReconnectTimeout = null;

function connectToCloud() {
  log('WS-CLOUD', 'Connecting to Cloud Bridge at ws://localhost:3002...');
  ws = new WebSocket('ws://localhost:3002');

  ws.on('open', () => {
    wsConnected = true;
    log('WS-CLOUD', `${colors.green}Connected to Cloud Bridge! Sending status...${colors.reset}`, colors.green);
  });

  ws.on('message', (message) => {
    try {
      const command = JSON.parse(message.toString());
      handleCloudCommand(command);
    } catch (err) {
      log('WS-CLOUD', `${colors.red}Failed to parse cloud command: ${err.message}${colors.reset}`, colors.red);
    }
  });

  ws.on('close', () => {
    wsConnected = false;
    log('WS-CLOUD', `${colors.yellow}Connection to Cloud Bridge closed. Retrying in 5s...${colors.reset}`, colors.yellow);
    if (wsReconnectTimeout) clearTimeout(wsReconnectTimeout);
    wsReconnectTimeout = setTimeout(connectToCloud, 5000);
  });

  ws.on('error', (err) => {
    log('WS-CLOUD', `${colors.red}Socket error: ${err.message}${colors.reset}`, colors.red);
  });
}

connectToCloud();


/* ─── Message Handling ───────────────────────────────────────────────────── */

async function handleCloudCommand(cmd) {
  log('WS-CLOUD', `Received command: ${JSON.stringify(cmd)}`, colors.magenta);

  if (cmd.type === 'setRotator') {
    const { azimuth, elevation } = cmd;
    
    // Command local rotctld if connected
    if (rotClient.connected) {
      try {
        log('ROTATOR', `Slewing hardware to Az: ${azimuth.toFixed(1)}°, El: ${elevation.toFixed(1)}°`);
        const response = await rotClient.send(`P ${azimuth.toFixed(1)} ${elevation.toFixed(1)}`, 1);
        log('ROTATOR', `Hardware response: ${response[0]}`);
      } catch (err) {
        log('ROTATOR', `${colors.red}Failed to write to rotctld: ${err.message}${colors.reset}`, colors.red);
      }
    } else {
      // Slewing Virtual Simulator
      log('ROTATOR', `Slewing VIRTUAL rotator target to Az: ${azimuth.toFixed(1)}°, El: ${elevation.toFixed(1)}°`);
      sim.rotator.targetAz = (azimuth + 360) % 360;
      sim.rotator.targetEl = Math.max(0, Math.min(90, elevation));
    }
  } 
  
  else if (cmd.type === 'setRig') {
    const { frequency } = cmd;
    
    // Command local rigctld if connected
    if (rigClient.connected) {
      try {
        log('RIG', `Setting hardware frequency to ${(frequency / 1e6).toFixed(4)} MHz`);
        const response = await rigClient.send(`F ${frequency}`, 1);
        log('RIG', `Hardware response: ${response[0]}`);
      } catch (err) {
        log('RIG', `${colors.red}Failed to write to rigctld: ${err.message}${colors.reset}`, colors.red);
      }
    } else {
      // Set Virtual Simulator
      log('RIG', `Setting VIRTUAL rig frequency to ${(frequency / 1e6).toFixed(4)} MHz`);
      sim.rig.frequency = frequency;
    }
  }
}

// Periodically read hardware/simulation status and push to WebSocket server
setInterval(async () => {
  let rotatorData = { connected: false, azimuth: 0, elevation: 0 };
  let rigData = { connected: false, frequency: 0, mode: 'None', bandwidth: 0 };

  // 1. Query Rotator
  if (rotClient.connected) {
    try {
      const posLines = await rotClient.send('p', 2);
      rotatorData.connected = mockRotServer ? false : true; // Flag as offline/simulated if connected to our own mock server
      rotatorData.azimuth = parseFloat(posLines[0]);
      rotatorData.elevation = parseFloat(posLines[1]);
    } catch {
      log('ROTATOR', `${colors.yellow}Failed to query hardware status, fallback to simulator${colors.reset}`, colors.yellow);
    }
  }
  
  if (!rotClient.connected || mockRotServer) {
    // Virtual fallback/override
    rotatorData.connected = false; // Flag as offline but serving simulated values
    rotatorData.azimuth = sim.rotator.currentAz;
    rotatorData.elevation = sim.rotator.currentEl;
  }

  // 2. Query Rig
  if (rigClient.connected) {
    try {
      const freqLine = await rigClient.send('f', 1);
      const modeLines = await rigClient.send('m', 2);
      rigData.connected = mockRigServer ? false : true; // Flag as offline/simulated if connected to our own mock server
      rigData.frequency = parseInt(freqLine[0], 10);
      rigData.mode = modeLines[0];
      rigData.bandwidth = parseInt(modeLines[1], 10);
    } catch {
      log('RIG', `${colors.yellow}Failed to query hardware status, fallback to simulator${colors.reset}`, colors.yellow);
    }
  }

  if (!rigClient.connected || mockRigServer) {
    // Virtual fallback/override
    rigData.connected = false;
    rigData.frequency = sim.rig.frequency;
    rigData.mode = sim.rig.mode;
    rigData.bandwidth = sim.rig.bandwidth;
  }

  // 3. Assemble and Send Packet
  const payload = {
    type: 'agentTelemetry',
    timestamp: Date.now(),
    rotator: rotatorData,
    rig: rigData
  };

  if (wsConnected && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}, 1000); // 1Hz telemetry updates
