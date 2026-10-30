/**
 * Network and P2P connection status manager
 * Tracks browser online/offline status and active WebRTC/signaling health.
 */

export type NetworkStatusType = 'online' | 'offline' | 'compromised';

export interface NetworkHealthState {
  isOnline: boolean;
  status: NetworkStatusType;
  p2pAvailable: boolean;
  signalingAvailable: boolean;
  lastChecked: number;
  message?: string;
}

type NetworkListener = (state: NetworkHealthState) => void;

class NetworkStatusManager {
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private p2pAvailable = true;
  private signalingAvailable = true;
  private status: NetworkStatusType = 'online';
  private listeners: Set<NetworkListener> = new Set();
  private lastChecked = Date.now();
  private checkInterval?: number;
  private message = 'Network connection normal';

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnlineChange(true));
      window.addEventListener('offline', () => this.handleOnlineChange(false));
      this.startHealthCheck();
    }
  }

  private handleOnlineChange(online: boolean) {
    this.isOnline = online;
    if (!online) {
      this.status = 'offline';
      this.p2pAvailable = false;
      this.signalingAvailable = false;
      this.message = 'Device is offline. P2P signaling is compromised. Use Offline Mode for direct transfers.';
    } else {
      this.status = 'online';
      this.p2pAvailable = true;
      this.signalingAvailable = true;
      this.message = 'Connected to network. Online P2P available.';
    }
    this.notify();
  }

  public async checkNow(): Promise<NetworkHealthState> {
    if (typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine;
    }
    if (!this.isOnline) {
      this.status = 'offline';
      this.p2pAvailable = false;
      this.signalingAvailable = false;
      this.message = 'Device is offline. P2P signaling is compromised.';
      this.notify();
      return this.getState();
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        this.status = 'online';
        this.p2pAvailable = true;
        this.signalingAvailable = true;
        this.message = 'Network connection normal and responsive.';
      } else {
        this.status = 'compromised';
        this.signalingAvailable = false;
        this.message = 'Signaling server response degraded.';
      }
    } catch {
      // In offline or local hotspot, health ping might fail but local P2P can still be checked
      if (this.isOnline) {
        this.status = 'online';
        this.p2pAvailable = true;
        this.signalingAvailable = true;
        this.message = 'Local network active.';
      }
    }
    this.lastChecked = Date.now();
    this.notify();
    return this.getState();
  }

  private startHealthCheck() {
    // Periodic light health ping to ensure connection isn't a dead captive portal
    this.checkInterval = window.setInterval(() => {
      this.checkNow();
    }, 15000);
  }

  public reportPeerStatus(p2pState: 'connected' | 'connecting' | 'disconnected' | 'failed' | 'closed') {
    if (p2pState === 'failed' || p2pState === 'disconnected') {
      if (this.isOnline) {
        this.status = 'compromised';
        this.message = 'Active P2P connection interrupted or compromised.';
      }
    } else if (p2pState === 'connected') {
      this.status = 'online';
      this.message = 'P2P connection active and verified.';
    }
    this.notify();
  }

  public getState(): NetworkHealthState {
    return {
      isOnline: this.isOnline,
      status: this.status,
      p2pAvailable: this.status === 'online',
      signalingAvailable: this.signalingAvailable,
      lastChecked: this.lastChecked,
      message: this.message,
    };
  }

  public subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => fn(state));
  }
}

export const networkStatus = new NetworkStatusManager();
