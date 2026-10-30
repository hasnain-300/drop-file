import { getSocketUrl } from "./socket";

export interface PeerSignalQuality {
  level: 0 | 1 | 2 | 3 | 4; // 0=disconnected, 1=weak, 2=fair, 3=good, 4=excellent
  score: number; // 0-100%
  label: 'Disconnected' | 'Weak' | 'Fair' | 'Good' | 'Excellent';
  rttMs: number | null;
  candidateType: 'host' | 'srflx' | 'prflx' | 'relay' | 'local' | 'unknown';
  transportMode: 'p2p' | 'relay';
  packetLossPercent: number;
  lastUpdated: number;
}

export class VirtualDataChannel {
  private rtcChannel: RTCDataChannel | null = null;
  private ws: WebSocket | null = null;
  private roomId: string;
  private mode: 'p2p' | 'relay' = 'p2p';
  public onmessage: ((event: { data: any }) => void) | null = null;
  public bufferedAmountLowThreshold = 1024 * 1024; // 1MB
  private listeners: Map<string, Set<Function>> = new Map();
  public binaryType = "arraybuffer";

  constructor(roomId: string) {
    this.roomId = roomId;
  }

  public setRtcChannel(channel: RTCDataChannel) {
    this.rtcChannel = channel;
    this.rtcChannel.binaryType = "arraybuffer";
    this.rtcChannel.onmessage = (e) => {
      this.onmessage?.(e);
      this.emit('message', e);
    };
    this.rtcChannel.addEventListener("bufferedamountlow", (e) => {
      this.emit("bufferedamountlow", e);
    });
  }

  public setWebSocket(ws: WebSocket | null) {
    this.ws = ws;
  }

  public setMode(mode: 'p2p' | 'relay') {
    this.mode = mode;
    console.log(`[Transport] Active mode set to: ${mode}`);
  }

  public get currentMode(): 'p2p' | 'relay' {
    return this.mode;
  }

  public get readyState(): 'open' | 'connecting' | 'closing' | 'closed' {
    if (this.mode === 'p2p' && this.rtcChannel) {
      return this.rtcChannel.readyState;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return 'open';
    }
    return 'connecting';
  }

  public get bufferedAmount(): number {
    if (this.mode === 'p2p' && this.rtcChannel) {
      return this.rtcChannel.bufferedAmount;
    }
    return this.ws?.bufferedAmount || 0;
  }

  public send(data: string | ArrayBuffer) {
    // 1. If in P2P mode and dataChannel is open, send direct P2P
    if (this.mode === 'p2p' && this.rtcChannel && this.rtcChannel.readyState === 'open') {
      try {
        this.rtcChannel.send(data as any);
        return;
      } catch (err) {
        console.warn("[Transport] Direct P2P send failed, falling back to relay", err);
      }
    }

    // 2. Fallback to high-speed relay over WebSocket (100% reliable on mobile hotspots)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        if (typeof data === 'string') {
          this.ws.send(JSON.stringify({
            type: "relay-data",
            room: this.roomId,
            payload: data
          }));
        } else {
          this.ws.send(data);
        }

        // Handle buffer notifications for file sender
        if (this.bufferedAmount < this.bufferedAmountLowThreshold) {
          setTimeout(() => this.emit("bufferedamountlow", {}), 10);
        }
      } catch (e) {
        console.error("[Transport] WebSocket send error", e);
      }
    } else {
      console.warn("[Transport] No open channel available to send data");
    }
  }

  public dispatchRelayMessage(data: string | ArrayBuffer) {
    const event = { data };
    this.onmessage?.(event);
    this.emit('message', event);
  }

  public addEventListener(type: string, listener: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  public removeEventListener(type: string, listener: Function) {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: string, event: any) {
    this.listeners.get(type)?.forEach((fn) => {
      try {
        fn(event);
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export class PeerConnection {
  private pc: RTCPeerConnection;
  private ws: WebSocket | null = null;
  public roomId: string;
  private isInitiator: boolean;
  private iceCandidateQueue: RTCIceCandidate[] = [];
  private signalQueue: any[] = [];
  private isClosing = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isManualMode = false;
  
  public dataChannel: VirtualDataChannel;
  public onDataChannel?: (channel: VirtualDataChannel) => void;
  public onConnectionStateChange?: (state: RTCPeerConnectionState | 'connected' | 'connecting' | 'disconnected' | 'failed' | 'closed') => void;
  public onPeerLeft?: () => void;
  public sendMessage?: (message: any) => Promise<void>;
  public onDisconnect?: (reason?: string) => void;
  public onError?: (message: string) => void;
  public onManualSignal?: (signal: string) => void;
  public onTransportModeChange?: (mode: 'p2p' | 'relay') => void;
  public onInactivityTick?: (remainingSeconds: number, isTransferring: boolean) => void;
  public onSignalQualityChange?: (quality: PeerSignalQuality) => void;

  private pingInterval?: number;
  private wsPingInterval?: number;
  private inactivityCheckInterval?: number;
  private lastActivityTime = Date.now();
  private readonly INACTIVITY_LIMIT = 60 * 1000; // 1 minute (60 seconds)
  private isTransferring = false;
  private isHandshakeEstablished = false;
  public connectionMode: 'p2p' | 'relay' = 'p2p';
  private signalQuality: PeerSignalQuality = {
    level: 0,
    score: 0,
    label: 'Disconnected',
    rttMs: null,
    candidateType: 'unknown',
    transportMode: 'p2p',
    packetLossPercent: 0,
    lastUpdated: Date.now()
  };
  private recentRtts: number[] = [];

  constructor(roomId: string, isInitiator: boolean, isManualMode = false) {
    this.roomId = roomId;
    this.isInitiator = isInitiator;
    this.isManualMode = isManualMode;
    this.dataChannel = new VirtualDataChannel(roomId);

    const iceServers: RTCIceServer[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      { urls: "stun:stun.services.mozilla.com" },
      { urls: "stun:stun.nextcloud.com:443" },
      { urls: "stun:stun.syncthing.net:3478" },
      // Open Relay Project TURN servers (UDP and TCP on ports 80/443 for mobile networks)
      {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp"
        ],
        username: "openrelayproject",
        credential: "openrelayproject"
      }
    ];

    this.pc = new RTCPeerConnection({
      iceServers,
      iceCandidatePoolSize: 10
    });

    this.setupPeerConnection();

    if (!this.isManualMode) {
      this.setupWebSocket();
    }

    this.startInactivityMonitoring();
  }

  public resetActivity() {
    this.lastActivityTime = Date.now();
  }

  public setTransferring(active: boolean) {
    this.isTransferring = active;
    if (active) {
      this.resetActivity();
    }
  }

  public getRemainingInactivitySeconds(): number {
    const elapsed = Date.now() - this.lastActivityTime;
    return Math.max(0, Math.ceil((this.INACTIVITY_LIMIT - elapsed) / 1000));
  }

  public getSignalQuality(): PeerSignalQuality {
    return { ...this.signalQuality };
  }

  public reportPingRtt(rtt: number, candidateType?: string | null) {
    if (this.isClosing) return;
    if (rtt > 0 && rtt < 10000) {
      this.recentRtts.push(rtt);
      if (this.recentRtts.length > 5) this.recentRtts.shift();
      const avgRtt = Math.round(this.recentRtts.reduce((a, b) => a + b, 0) / this.recentRtts.length);
      this.updateSignalQuality(avgRtt, candidateType);
    }
  }

  public async measureWebRTCStats() {
    if (this.isClosing) return;
    try {
      if (!this.pc) return;
      const stats = await this.pc.getStats();
      let currentRtt: number | null = null;
      let candidateType: string | null = null;
      let packetsLost = 0;
      let packetsReceived = 0;

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && (report.state === 'succeeded' || report.nominated)) {
          if (typeof report.currentRoundTripTime === 'number') {
            currentRtt = Math.round(report.currentRoundTripTime * 1000);
          } else if (typeof report.totalRoundTripTime === 'number' && report.responsesReceived > 0) {
            currentRtt = Math.round((report.totalRoundTripTime / report.responsesReceived) * 1000);
          }
        }
        if (report.type === 'remote-candidate' || report.type === 'local-candidate') {
          if (report.candidateType) {
            candidateType = report.candidateType;
          }
        }
        if (report.type === 'inbound-rtp' || report.type === 'data-channel') {
          if (typeof report.packetsLost === 'number') packetsLost += report.packetsLost;
          if (typeof report.packetsReceived === 'number') packetsReceived += report.packetsReceived;
        }
      });

      const totalPackets = packetsReceived + packetsLost;
      const lossPercent = totalPackets > 0 ? Math.round((packetsLost / totalPackets) * 100) : 0;

      if (currentRtt !== null) {
        this.reportPingRtt(currentRtt, candidateType);
      } else {
        this.updateSignalQuality(undefined, candidateType, lossPercent);
      }
    } catch (e) {
      // Ignore stats error if peer connection closed
    }
  }

  private updateSignalQuality(
    rtt?: number,
    candType?: string | null,
    lossPercent = 0
  ) {
    const isConn =
      this.pc.connectionState === 'connected' ||
      this.pc.iceConnectionState === 'connected' ||
      (this.dataChannel && this.dataChannel.readyState === 'open');

    if (!isConn) {
      this.signalQuality = {
        level: 0,
        score: 0,
        label: 'Disconnected',
        rttMs: null,
        candidateType: 'unknown',
        transportMode: this.connectionMode,
        packetLossPercent: 0,
        lastUpdated: Date.now()
      };
      this.onSignalQualityChange?.(this.signalQuality);
      return;
    }

    const effectiveRtt =
      rtt !== undefined
        ? rtt
        : (this.signalQuality.rttMs ?? (this.connectionMode === 'p2p' ? 12 : 55));

    let mappedCandType: PeerSignalQuality['candidateType'] = 'unknown';
    if (candType === 'host') mappedCandType = 'host';
    else if (candType === 'srflx') mappedCandType = 'srflx';
    else if (candType === 'prflx') mappedCandType = 'prflx';
    else if (candType === 'relay') mappedCandType = 'relay';
    else if (this.connectionMode === 'relay') mappedCandType = 'relay';
    else if (this.connectionMode === 'p2p') mappedCandType = 'host';

    let level: 1 | 2 | 3 | 4 = 4;
    let label: PeerSignalQuality['label'] = 'Excellent';
    let score = 98;

    if (effectiveRtt <= 35 && lossPercent <= 1) {
      level = 4;
      label = 'Excellent';
      score = Math.max(90, Math.min(100, Math.round(100 - (effectiveRtt / 35) * 8)));
    } else if (effectiveRtt <= 90 && lossPercent <= 5) {
      level = 3;
      label = 'Good';
      score = Math.max(75, Math.min(89, Math.round(89 - ((effectiveRtt - 35) / 55) * 14)));
    } else if (effectiveRtt <= 220 && lossPercent <= 15) {
      level = 2;
      label = 'Fair';
      score = Math.max(50, Math.min(74, Math.round(74 - ((effectiveRtt - 90) / 130) * 24)));
    } else {
      level = 1;
      label = 'Weak';
      score = Math.max(15, Math.min(49, Math.round(49 - Math.min(30, ((effectiveRtt - 220) / 280) * 30))));
    }

    this.signalQuality = {
      level,
      score,
      label,
      rttMs: effectiveRtt,
      candidateType: mappedCandType,
      transportMode: this.connectionMode,
      packetLossPercent: lossPercent,
      lastUpdated: Date.now()
    };

    this.onSignalQualityChange?.(this.signalQuality);
  }

  private startInactivityMonitoring() {
    if (this.inactivityCheckInterval) {
      window.clearInterval(this.inactivityCheckInterval);
    }

    this.inactivityCheckInterval = window.setInterval(() => {
      if (this.isClosing) return;

      if (this.isTransferring) {
        // While files are transferring, keep activity alive
        this.resetActivity();
      }

      const elapsed = Date.now() - this.lastActivityTime;
      const remainingSeconds = Math.max(0, Math.ceil((this.INACTIVITY_LIMIT - elapsed) / 1000));

      this.onInactivityTick?.(remainingSeconds, this.isTransferring);

      if (elapsed >= this.INACTIVITY_LIMIT) {
        console.log("[Inactivity] 1 minute elapsed without activity. Disconnecting session...");
        try {
          this.sendMessage?.({ type: 'disconnect', reason: 'inactivity' }).catch(() => {});
        } catch (e) {}

        this.onDisconnect?.('inactivity');
        this.close();
      }
    }, 1000);
  }

  private setupWebSocket() {
    if (this.isClosing || this.isManualMode) return;

    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
    }

    this.ws = new WebSocket(getSocketUrl());
    this.dataChannel.setWebSocket(this.ws);
    
    // Set binaryType to arraybuffer so file chunks are received as ArrayBuffer
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      console.log("[WS] Signaling WebSocket opened for room:", this.roomId);
      this.reconnectAttempts = 0;
      this.ws?.send(JSON.stringify({ type: "join", room: this.roomId }));
      
      // Send queued signals
      while (this.signalQueue.length > 0) {
        const payload = this.signalQueue.shift();
        this.sendSignal(payload);
      }

      // WebSocket keepalive ping every 15s
      if (this.wsPingInterval) window.clearInterval(this.wsPingInterval);
      this.wsPingInterval = window.setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: "ws-ping" }));
        }
      }, 15000);
    };

    this.ws.onmessage = async (event) => {
      // 1. If binary message, it's a file chunk relayed via WebSocket
      if (event.data instanceof ArrayBuffer) {
        this.resetActivity();
        this.dataChannel.dispatchRelayMessage(event.data);
        return;
      }

      // 2. Text message
      try {
        const data = JSON.parse(event.data);
        if (data.type === "error") {
          this.onError?.(data.message);
          this.onConnectionStateChange?.('failed');
          return;
        }

        if (data.type === "peer-joined") {
          console.log("[WS] Peer joined room. Exchanging handshake...");
          
          // Send relay handshake immediately so both peers can communicate even if WebRTC P2P fails on hotspot
          this.ws?.send(JSON.stringify({
            type: "relay-data",
            room: this.roomId,
            payload: JSON.stringify({ type: "__relay_handshake__", from: this.isInitiator ? "initiator" : "responder" })
          }));

          // Fallback timer: if P2P does not connect within 3.5s (common on mobile hotspot due to mDNS/NAT loopback),
          // activate Relay mode so users can immediately connect and transfer without failing!
          setTimeout(() => {
            if (!this.isClosing && this.connectionMode !== 'p2p' && this.ws?.readyState === WebSocket.OPEN) {
              console.log("[Connection] WebRTC P2P not yet established. Activating Relay mode for 100% connectivity...");
              this.activateRelayMode();
            }
          }, 3500);

          if (this.isInitiator) {
            setTimeout(() => this.createOffer(), 300);
          }
        } else if (data.type === "peer-left") {
          console.log("[WS] Peer left room");
          this.onPeerLeft?.();
        } else if (data.type === "signal") {
          await this.handleSignal(data.payload);
        } else if (data.type === "relay-data") {
          // Relayed application message or control packet
          this.resetActivity();
          if (typeof data.payload === 'string') {
            try {
              const parsed = JSON.parse(data.payload);
              if (parsed.type === "__relay_handshake__") {
                console.log("[Relay] Handshake received from peer");
                this.isHandshakeEstablished = true;
                if (this.connectionMode !== 'p2p') {
                  this.activateRelayMode();
                }
                return;
              }
              if (parsed.type === 'ping') {
                // Heartbeat ping with timestamp for RTT latency measurement
                if (parsed.sendTime && this.ws?.readyState === WebSocket.OPEN) {
                  this.ws.send(JSON.stringify({
                    type: "relay-data",
                    room: this.roomId,
                    payload: JSON.stringify({ type: 'pong', sendTime: parsed.sendTime })
                  }));
                }
                return;
              }
              if (parsed.type === 'pong') {
                if (parsed.sendTime) {
                  const rtt = Math.max(1, Date.now() - parsed.sendTime);
                  this.reportPingRtt(rtt, 'relay');
                }
                return;
              }
            } catch (e) {}
          }
          this.dataChannel.dispatchRelayMessage(data.payload);
        }
      } catch (e) {
        console.error("Signaling message error", e);
      }
    };

    this.ws.onerror = (err) => {
      console.error("[WS] Signaling WebSocket error", err);
    };

    this.ws.onclose = () => {
      console.log("[WS] Signaling WebSocket closed");
      if (this.wsPingInterval) window.clearInterval(this.wsPingInterval);
      
      if (!this.isClosing && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 8000);
        setTimeout(() => this.setupWebSocket(), delay);
      }
    };
  }

  private activateRelayMode() {
    if (this.connectionMode === 'p2p') return; // already direct P2P
    this.connectionMode = 'relay';
    this.dataChannel.setMode('relay');
    this.startPing();
    this.onTransportModeChange?.('relay');
    this.onConnectionStateChange?.('connected');
    this.onDataChannel?.(this.dataChannel);
  }

  private setupPeerConnection() {
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Send candidate
        this.sendSignal({ candidate: event.candidate });
      } else {
        // ICE gathering complete - useful for manual offline signaling
        if (this.isManualMode || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          if (this.pc.localDescription) {
            this.onManualSignal?.(JSON.stringify({ sdp: this.pc.localDescription }));
          }
        }
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE Connection State:", this.pc.iceConnectionState);
      if (this.pc.iceConnectionState === 'failed') {
        console.warn("[WebRTC] ICE failed (likely mobile hotspot NAT loopback or mDNS restriction)");
        // Attempt ICE restart for P2P, but DO NOT drop session if Relay is available
        try {
          this.pc.restartIce();
        } catch (e) {}

        if (!this.isManualMode && this.ws?.readyState === WebSocket.OPEN) {
          this.activateRelayMode();
        } else {
          this.onConnectionStateChange?.('failed');
        }
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log("[WebRTC] Peer Connection State:", this.pc.connectionState);
      const state = this.pc.connectionState;
      
      if (state === 'connected') {
        this.connectionMode = 'p2p';
        this.dataChannel.setMode('p2p');
        this.startPing();
        this.onTransportModeChange?.('p2p');
        this.onConnectionStateChange?.(state);
      } else if (state === 'disconnected') {
        console.log("[WebRTC] P2P disconnected, checking relay fallback...");
        if (!this.isManualMode && this.ws?.readyState === WebSocket.OPEN) {
          this.activateRelayMode();
        } else {
          this.onConnectionStateChange?.(state);
        }
      } else if (state === 'failed') {
        if (!this.isManualMode && this.ws?.readyState === WebSocket.OPEN) {
          console.log("[WebRTC] P2P failed, continuing seamlessly on Relay mode");
          this.activateRelayMode();
        } else {
          this.onConnectionStateChange?.(state);
        }
      } else if (state === 'closed') {
        this.stopPing();
        this.onConnectionStateChange?.(state);
      }
    };

    if (this.isInitiator) {
      const rtcDc = this.pc.createDataChannel("fileTransfer", {
        ordered: true
      });
      this.dataChannel.setRtcChannel(rtcDc);
      rtcDc.onopen = () => {
        console.log("[WebRTC] Initiator DataChannel opened (P2P active)");
        this.connectionMode = 'p2p';
        this.dataChannel.setMode('p2p');
        this.startPing();
        this.onTransportModeChange?.('p2p');
        this.onConnectionStateChange?.('connected');
        this.onDataChannel?.(this.dataChannel);
      };
    } else {
      this.pc.ondatachannel = (event) => {
        console.log("[WebRTC] Responder DataChannel received (P2P active)");
        this.dataChannel.setRtcChannel(event.channel);
        event.channel.onopen = () => {
          this.connectionMode = 'p2p';
          this.dataChannel.setMode('p2p');
          this.startPing();
          this.onTransportModeChange?.('p2p');
          this.onConnectionStateChange?.('connected');
          this.onDataChannel?.(this.dataChannel);
        };
      };
    }
  }

  private startPing() {
    this.stopPing();
    // Immediate initial stats & signal check
    this.updateSignalQuality();
    this.measureWebRTCStats();

    // Heartbeat & signal quality check every 2.5 seconds
    this.pingInterval = window.setInterval(async () => {
      try {
        const sendTime = Date.now();
        if (this.connectionMode === 'p2p' && this.dataChannel.readyState === 'open') {
          this.dataChannel.send(JSON.stringify({ type: 'ping', sendTime }));
        } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: "relay-data",
            room: this.roomId,
            payload: JSON.stringify({ type: 'ping', sendTime })
          }));
        }

        if (this.pc && (this.pc.connectionState === 'connected' || this.pc.iceConnectionState === 'connected')) {
          await this.measureWebRTCStats();
        }
      } catch (e) {}
    }, 2500);
  }

  private stopPing() {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  public async createManualOffer() {
    this.isManualMode = true;
    try {
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      
      if (this.pc.iceGatheringState === 'complete') {
        this.onManualSignal?.(JSON.stringify({ sdp: this.pc.localDescription }));
      }
      
      setTimeout(() => {
        if (this.pc.iceGatheringState !== 'complete' && this.pc.localDescription) {
          this.onManualSignal?.(JSON.stringify({ sdp: this.pc.localDescription }));
        }
      }, 5000);
    } catch (err) {
      console.error("Error creating manual offer", err);
    }
  }

  public async setManualSignal(signalStr: string) {
    this.isManualMode = true;
    
    if (this.ws) {
      try { this.ws.close(); } catch(e) {}
      this.ws = null;
    }
    if (this.wsPingInterval) window.clearInterval(this.wsPingInterval);

    try {
      const signal = JSON.parse(signalStr);
      await this.handleSignal(signal);
    } catch (err) {
      console.error("Error setting manual signal", err);
      this.onError?.("Invalid connection string");
    }
  }

  private async createOffer(iceRestart = false) {
    try {
      const offer = await this.pc.createOffer({ iceRestart });
      await this.pc.setLocalDescription(offer);
      this.sendSignal({ sdp: this.pc.localDescription });
    } catch (err) {
      console.error("Error creating offer", err);
    }
  }

  private async handleSignal(signal: any) {
    try {
      if (signal.sdp) {
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === "offer") {
          const answer = await this.pc.createAnswer();
          await this.pc.setLocalDescription(answer);
          
          if (!this.isManualMode && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendSignal({ sdp: this.pc.localDescription });
          } else {
            if (this.pc.iceGatheringState === 'complete') {
              this.onManualSignal?.(JSON.stringify({ sdp: this.pc.localDescription }));
            }
            setTimeout(() => {
              if (this.pc.iceGatheringState !== 'complete' && this.pc.localDescription) {
                this.onManualSignal?.(JSON.stringify({ sdp: this.pc.localDescription }));
              }
            }, 5000);
          }
        }
        
        // Process queued candidates one by one safely
        while (this.iceCandidateQueue.length > 0) {
          const candidate = this.iceCandidateQueue.shift();
          if (candidate) {
            try {
              await this.pc.addIceCandidate(candidate);
            } catch (e) {
              console.warn("Could not add queued candidate", e);
            }
          }
        }
      } else if (signal.candidate) {
        // Only add non-empty candidates
        if (signal.candidate.candidate) {
          const candidate = new RTCIceCandidate(signal.candidate);
          if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
            try {
              await this.pc.addIceCandidate(candidate);
            } catch (e) {
              console.warn("Could not add ICE candidate", e);
            }
          } else {
            this.iceCandidateQueue.push(candidate);
          }
        }
      }
    } catch (err) {
      console.error("Error handling signal", err);
    }
  }

  private sendSignal(payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "signal",
        room: this.roomId,
        payload
      }));
    } else {
      this.signalQueue.push(payload);
    }
  }

  public close() {
    this.isClosing = true;
    this.stopPing();
    if (this.wsPingInterval) window.clearInterval(this.wsPingInterval);
    if (this.inactivityCheckInterval) window.clearInterval(this.inactivityCheckInterval);
    
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "leave", room: this.roomId }));
      }
    } catch (e) {}

    try {
      this.pc.close();
    } catch (e) {}

    try {
      this.ws?.close();
    } catch (e) {}
  }
}
