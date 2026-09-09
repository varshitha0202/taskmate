type RealtimeCallback = (event: { type: string; payload: any }) => void;

export function resolveRealtimeUrl({
  configuredWsUrl,
  configuredApiBase,
  protocol,
  host,
}: {
  configuredWsUrl?: string;
  configuredApiBase?: string;
  protocol: string;
  host: string;
}) {
  const normalizedWsUrl = configuredWsUrl?.trim().replace(/\/$/, '');
  if (normalizedWsUrl) {
    return normalizedWsUrl;
  }

  const normalizedApiBase = configuredApiBase?.trim().replace(/\/$/, '');
  if (normalizedApiBase) {
    return `${normalizedApiBase.replace(/^http/, 'ws')}/ws`;
  }

  const socketProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  return `${socketProtocol}//${host}/ws`;
}

class RealtimeService {
  private ws: WebSocket | null = null;
  private listeners: Set<RealtimeCallback> = new Set();
  private reconnectTimeout: any = null;
  private isConnected = false;
  private userId: string | null = null;
  private role: string | null = null;

  init(userId?: string, role?: string) {
    if (userId) this.userId = userId;
    if (role) this.role = role;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.ws.readyState === WebSocket.OPEN && this.userId) {
        this.sendAuth();
      }
      return;
    }

    this.connect();
  }

  private connect() {
    try {
      const configuredWsUrl = import.meta.env.VITE_WS_URL?.replace(/\/$/, '');
      const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');
      const protocol = window.location.protocol;
      const wsUrl = resolveRealtimeUrl({
        configuredWsUrl,
        configuredApiBase,
        protocol,
        host: window.location.host,
      });

      console.log('[Realtime] Connecting to WebSocket at:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[Realtime] Connected to TaskMate Live Server');
        this.isConnected = true;
        this.sendAuth();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyListeners(data);
          this.handleChime(data.type);
        } catch (err) {
          console.error('[Realtime] Message parse error:', err);
        }
      };

      this.ws.onclose = () => {
        console.warn('[Realtime] Disconnected. Attempting reconnect in 3s...');
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[Realtime] Socket error:', err);
        this.ws?.close();
      };
    } catch (e) {
      console.error('[Realtime] Connection failed:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 3000);
  }

  private sendAuth() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.userId) {
      this.ws.send(
        JSON.stringify({
          type: 'AUTH',
          userId: this.userId,
          role: this.role,
        })
      );
    }
  }

  private handleChime(eventType: string) {
    // Play subtle synthetic audio chime for key events
    const chimeEvents = ['NEW_OFFER', 'TASK_OFFERED', 'TASK_ACCEPTED', 'AGENT_REJECTED', 'TASK_UPDATED'];
    if (chimeEvents.includes(eventType)) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
          osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch {
        // Audio might be blocked until user gesture, ignore safely
      }
    }
  }

  subscribe(callback: RealtimeCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(data: any) {
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error('[Realtime] Error in subscriber listener:', err);
      }
    });
  }

  disconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  get status(): boolean {
    return this.isConnected;
  }
}

export const realtime = new RealtimeService();
