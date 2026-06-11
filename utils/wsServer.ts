import { WebSocketServer } from 'ws';

// Ensure the WebSocket server is a singleton during hot-reloads in development
const globalForWs = globalThis as unknown as {
  wss: WebSocketServer | undefined;
};

export function startWsServer() {
  if (typeof window !== 'undefined') return;
  if (globalForWs.wss) return;

  try {
    console.log('[WS Cloud Bridge] Initializing WebSocket server on port 3002...');
    const wss = new WebSocketServer({ port: 3002 });
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

    console.log('[WS Cloud Bridge] Server is running on ws://localhost:3002');
  } catch (err) {
    console.error('[WS Cloud Bridge] Failed to start WebSocket server:', err);
  }
}
