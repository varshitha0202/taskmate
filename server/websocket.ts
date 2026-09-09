import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  role?: string;
  isAlive: boolean;
}

const clients = new Set<ClientConnection>();
let wss: WebSocketServer | null = null;

export function initWebSocketServer(server: http.Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    const client: ClientConnection = {
      ws,
      isAlive: true,
    };
    clients.add(client);
    console.log(`[WebSocket] New device connected. Active devices: ${clients.size}`);

    ws.on('pong', () => {
      client.isAlive = true;
    });

    ws.on('message', (data: string) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'AUTH') {
          client.userId = message.userId;
          client.role = message.role;
          console.log(`[WebSocket] Device authenticated: ${message.role} (${message.userId})`);
          
          ws.send(JSON.stringify({
            type: 'AUTH_SUCCESS',
            message: 'Connected to TaskMate Realtime Engine',
            connectedClients: clients.size,
          }));
        } else if (message.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG' }));
        }
      } catch (err) {
        console.error('[WebSocket] Message parsing error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(client);
      console.log(`[WebSocket] Device disconnected. Active devices: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Connection error:', err);
      clients.delete(client);
    });
  });

  // Heartbeat interval to clean up dead connections
  const interval = setInterval(() => {
    clients.forEach((client) => {
      if (!client.isAlive) {
        client.ws.terminate();
        clients.delete(client);
        return;
      }
      client.isAlive = false;
      client.ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WebSocket] Realtime WebSocket Server initialized on path /ws');
}

export function broadcastEvent(event: { type: string; payload: any; targetUserId?: string }) {
  const payloadStr = JSON.stringify(event);
  
  clients.forEach((client) => {
    if (client.ws.readyState === WebSocket.OPEN) {
      if (!event.targetUserId || client.userId === event.targetUserId) {
        try {
          client.ws.send(payloadStr);
        } catch (err) {
          console.error('[WebSocket] Error sending message:', err);
        }
      }
    }
  });
}
