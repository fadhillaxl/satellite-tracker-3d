# Satellite Tracker 3D - Local Hardware Agent

This local agent acts as a hardware bridge between the web client and Hamlib daemons (`rigctld` and `rotctld`). It runs on the client machine, connects to the local daemons via TCP sockets, and maintains a WebSocket link to the tracking application.

## Core Features

- **Hamlib rigctld client:** Auto-detects and connects to a transceiver control daemon on TCP port `4532`.
- **Hamlib rotctld client:** Auto-detects and connects to an antenna rotator control daemon on TCP port `4533`.
- **High-fidelity Simulation Fallback:** If the hardware daemons are offline, the agent automatically spawns virtual device simulators. This includes realistic rotator slewing (moving at virtual deg/sec speeds) and virtual transceiver frequency tuning.
- **WebSocket Cloud Bridge:** Feeds live hardware telemetry at 1Hz to the web interface and receives real-time frequency & tracking commands.

## Getting Started

### 1. Start the Satellite Tracker Web App
If you haven't already, run the Next.js development server in the root directory:
```bash
npm run dev
```
This starts the web application on `http://localhost:3003` (or the next available port) and initializes the background WebSocket cloud bridge server on port `3004`.

### 2. Run the Local Agent
From the project root directory, launch the agent with Node.js:
```bash
node local-agent/agent.js
```

You should see logs showing:
```text
[10:14:02] [AGENT] Connecting to Cloud Bridge at ws://localhost:3004...
[10:14:02] [AGENT] Connected to Cloud Bridge! Sending status...
[10:14:02] [ROTATOR] Connecting to 127.0.0.1:4533...
[10:14:02] [RIG] Connecting to 127.0.0.1:4532...
```

*Note: If `rigctld` or `rotctld` are not running locally, the agent will gracefully run virtual emulators and periodically retry connection to the hardware.*

### 3. Open the Rotator Panel
Navigate to [http://localhost:3003/rotator](http://localhost:3003/rotator) in your browser. 

- You will see the **LIVE HARDWARE LINK** status card light up as **ONLINE**.
- You can drag the target azimuth, elevation, and frequency sliders to control the virtual (or real) hardware and watch the dials slew in real-time.
