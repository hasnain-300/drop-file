/**
 * Utility to calculate, record, and track total data transferred
 * during the current session, along with transfer rate samples over time.
 */

export interface TransferSample {
  timestamp: number;
  rateBps: number;
  sentBps: number;
  receivedBps: number;
  cumulativeBytes: number;
}

export interface SessionMetricsState {
  totalBytesSent: number;
  totalBytesReceived: number;
  totalBytesTransferred: number;
  currentSpeedBps: number;
  peakSpeedBps: number;
  averageSpeedBps: number;
  sessionStartTime: number;
  samples: TransferSample[];
  isActive: boolean;
}

type MetricsListener = (state: SessionMetricsState) => void;

class SessionMetricsManager {
  private totalBytesSent = 0;
  private totalBytesReceived = 0;
  private sessionStartTime = Date.now();
  private peakSpeedBps = 0;
  private currentSpeedBps = 0;
  private samples: TransferSample[] = [];
  private listeners: Set<MetricsListener> = new Set();

  private recentSentBytes = 0;
  private recentReceivedBytes = 0;
  private tickerInterval?: number;
  private lastTickTime = Date.now();
  private maxSamples = 60; // Keep up to 60 seconds of history

  constructor() {
    // Initialize with a baseline sample
    this.samples.push({
      timestamp: this.sessionStartTime,
      rateBps: 0,
      sentBps: 0,
      receivedBps: 0,
      cumulativeBytes: 0,
    });

    this.startTicker();
  }

  private startTicker() {
    if (typeof window === 'undefined') return;

    this.tickerInterval = window.setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.max(0.1, (now - this.lastTickTime) / 1000);
      
      const sentRate = this.recentSentBytes / elapsedSeconds;
      const receivedRate = this.recentReceivedBytes / elapsedSeconds;
      const combinedRate = sentRate + receivedRate;

      this.currentSpeedBps = combinedRate;
      if (combinedRate > this.peakSpeedBps) {
        this.peakSpeedBps = combinedRate;
      }

      this.samples.push({
        timestamp: now,
        rateBps: combinedRate,
        sentBps: sentRate,
        receivedBps: receivedRate,
        cumulativeBytes: this.totalBytesSent + this.totalBytesReceived,
      });

      if (this.samples.length > this.maxSamples) {
        this.samples.shift();
      }

      // Reset window counters
      this.recentSentBytes = 0;
      this.recentReceivedBytes = 0;
      this.lastTickTime = now;

      this.notify();
    }, 1000);
  }

  public recordTransfer(bytes: number, direction: 'sent' | 'received') {
    if (bytes <= 0) return;

    if (direction === 'sent') {
      this.totalBytesSent += bytes;
      this.recentSentBytes += bytes;
    } else {
      this.totalBytesReceived += bytes;
      this.recentReceivedBytes += bytes;
    }

    const total = this.totalBytesSent + this.totalBytesReceived;
    const elapsedSecs = Math.max(1, (Date.now() - this.sessionStartTime) / 1000);
    const avgRate = total / elapsedSecs;

    if (this.currentSpeedBps > this.peakSpeedBps) {
      this.peakSpeedBps = this.currentSpeedBps;
    }

    this.notify();
  }

  public getState(): SessionMetricsState {
    const total = this.totalBytesSent + this.totalBytesReceived;
    const elapsedSecs = Math.max(1, (Date.now() - this.sessionStartTime) / 1000);
    const avgRate = total / elapsedSecs;

    return {
      totalBytesSent: this.totalBytesSent,
      totalBytesReceived: this.totalBytesReceived,
      totalBytesTransferred: total,
      currentSpeedBps: this.currentSpeedBps,
      peakSpeedBps: this.peakSpeedBps,
      averageSpeedBps: avgRate,
      sessionStartTime: this.sessionStartTime,
      samples: [...this.samples],
      isActive: this.currentSpeedBps > 1024,
    };
  }

  public subscribe(listener: MetricsListener): () => void {
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

  public reset() {
    this.totalBytesSent = 0;
    this.totalBytesReceived = 0;
    this.recentSentBytes = 0;
    this.recentReceivedBytes = 0;
    this.peakSpeedBps = 0;
    this.currentSpeedBps = 0;
    this.sessionStartTime = Date.now();
    this.lastTickTime = this.sessionStartTime;
    this.samples = [{
      timestamp: this.sessionStartTime,
      rateBps: 0,
      sentBps: 0,
      receivedBps: 0,
      cumulativeBytes: 0,
    }];
    this.notify();
  }
}

export const sessionMetrics = new SessionMetricsManager();

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}
