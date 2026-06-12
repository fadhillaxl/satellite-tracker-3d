import { WebSocketServer } from 'ws';

// Ensure the WebSocket server is a singleton during hot-reloads in development
const globalForWs = globalThis as unknown as {
  wss: WebSocketServer | undefined;
};

export function startWsServer() {
  if (typeof window !== 'undefined') return;
  if (globalForWs.wss) return;

  const wsPort = parseInt(process.env.WS_PORT || '3004', 10);

  try {
    console.log(`[WS Cloud Bridge] Initializing WebSocket server on port ${wsPort}...`);
    const wss = new WebSocketServer({ port: wsPort });
    globalForWs.wss = wss;

    wss.on('connection', (ws) => {
      console.log('[WS Cloud Bridge] Client connected');

      ws.on('message', (message) => {
        try {
          const dataStr = message.toString();
          // Broadcast to all other connected clients
          wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
              client.send(dataStr);
            }
          });
        } catch (err) {
          console.error('[WS Cloud Bridge] Error processing message:', err);
        }
      });

      ws.on('close', () => {
        console.log('[WS Cloud Bridge] Client disconnected');
      });

      ws.on('error', (err) => {
        console.error('[WS Cloud Bridge] Client socket error:', err);
      });
    });

    console.log(`[WS Cloud Bridge] Server is running on ws://localhost:${wsPort}`);
  } catch (err) {
    console.error('[WS Cloud Bridge] Failed to start WebSocket server:', err);
  }
}

