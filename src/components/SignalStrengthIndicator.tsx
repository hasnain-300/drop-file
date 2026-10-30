import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PeerSignalQuality } from '../webrtc/peer';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Zap, ShieldCheck, X, Radio, ArrowUpDown, Info } from 'lucide-react';

export interface SignalStrengthIndicatorProps {
  quality: PeerSignalQuality | null;
  isTransferring?: boolean;
  variant?: 'badge' | 'compact' | 'minimal';
  showPing?: boolean;
  showLabel?: boolean;
  className?: string;
}

/**
 * Pixel-perfect SVG WiFi-style icon with 4 signal levels:
 * Level 4: All 3 arcs + dot active (Excellent)
 * Level 3: 2 arcs + dot active (Good)
 * Level 2: 1 arc + dot active (Fair)
 * Level 1: Dot active (Weak)
 * Level 0: Dim / Disconnected
 */
export const WifiSignalIcon: React.FC<{
  level: 0 | 1 | 2 | 3 | 4;
  isTransferring?: boolean;
  className?: string;
}> = ({ level = 4, isTransferring = false, className = 'w-4 h-4' }) => {
  const colorMap = {
    4: 'text-emerald-500 dark:text-emerald-400',
    3: 'text-blue-500 dark:text-blue-400',
    2: 'text-amber-500 dark:text-amber-400',
    1: 'text-rose-500 dark:text-rose-400',
    0: 'text-gray-400 dark:text-gray-600',
  };
  const activeColor = colorMap[level];

  return (
    <div className="relative inline-flex items-center justify-center">
      {isTransferring && level > 0 && (
        <span
          className={`absolute inset-0 rounded-full animate-ping opacity-25 scale-125 ${
            level === 4
              ? 'bg-emerald-400'
              : level === 3
              ? 'bg-blue-400'
              : level === 2
              ? 'bg-amber-400'
              : 'bg-rose-400'
          }`}
        />
      )}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} ${activeColor} transition-colors duration-300 ${
          isTransferring ? 'animate-pulse' : ''
        }`}
        aria-label={`WebRTC Signal Level ${level} of 4`}
      >
        {/* Wave 4 (Top arc) */}
        <path
          d="M 2.8 9.3 A 13 13 0 0 1 21.2 9.3"
          className={`transition-opacity duration-300 ${
            level >= 4
              ? 'opacity-100'
              : 'opacity-20 stroke-gray-400 dark:stroke-gray-600'
          }`}
        />
        {/* Wave 3 (Middle arc) */}
        <path
          d="M 6 12.5 A 8.5 8.5 0 0 1 18 12.5"
          className={`transition-opacity duration-300 ${
            level >= 3
              ? 'opacity-100'
              : 'opacity-20 stroke-gray-400 dark:stroke-gray-600'
          }`}
        />
        {/* Wave 2 (Lower arc) */}
        <path
          d="M 9 15.5 A 4.2 4.2 0 0 1 15 15.5"
          className={`transition-opacity duration-300 ${
            level >= 2
              ? 'opacity-100'
              : 'opacity-20 stroke-gray-400 dark:stroke-gray-600'
          }`}
        />
        {/* Base Dot */}
        <circle
          cx="12"
          cy="18.5"
          r="1.5"
          fill="currentColor"
          stroke="none"
          className={`transition-opacity duration-300 ${
            level >= 1
              ? 'opacity-100'
              : 'opacity-25 fill-gray-400 dark:fill-gray-600'
          }`}
        />
      </svg>
    </div>
  );
};

export const SignalStrengthIndicator: React.FC<SignalStrengthIndicatorProps> = ({
  quality,
  isTransferring = false,
  variant = 'badge',
  showPing = true,
  showLabel = true,
  className = '',
}) => {
  const [showModal, setShowModal] = useState(false);

  // Fallback defaults if connected but quality object not yet resolved
  const level = quality ? quality.level : 0;
  const score = quality ? quality.score : 0;
  const label = quality ? quality.label : 'Disconnected';
  const rtt = quality?.rttMs ?? null;
  const mode = quality?.transportMode ?? 'p2p';
  const candidateType = quality?.candidateType ?? 'unknown';

  const badgeStyle = {
    4: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20',
    3: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25 hover:bg-blue-500/20',
    2: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/20',
    1: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 hover:bg-rose-500/20',
    0: 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700',
  }[level];

  const getCandidateDescription = (type: string, transport: string) => {
    if (transport === 'relay') {
      return {
        title: 'WebSocket Relay',
        subtitle: 'Routed via signaling server (Mobile hotspot / fallback)',
      };
    }
    if (type === 'host') {
      return {
        title: 'Local Wi-Fi / Hotspot',
        subtitle: 'Direct local peer-to-peer (Fastest speed & zero latency)',
      };
    }
    if (type === 'srflx' || type === 'prflx') {
      return {
        title: 'Direct P2P (STUN Reflexive)',
        subtitle: 'Direct peer connection across different networks',
      };
    }
    return {
      title: 'Direct WebRTC P2P',
      subtitle: 'Encrypted end-to-end data channel',
    };
  };

  const candidateInfo = getCandidateDescription(candidateType, mode);

  return (
    <>
      {/* Trigger Component */}
      {variant === 'minimal' ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title={`Signal Strength: ${label} (${score}%) - ${rtt !== null ? `${rtt}ms` : 'Measuring'}`}
          className={`inline-flex items-center justify-center p-1.5 rounded-lg transition-transform active:scale-95 cursor-pointer ${className}`}
        >
          <WifiSignalIcon level={level} isTransferring={isTransferring} className="w-4 h-4" />
        </button>
      ) : variant === 'compact' ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title={`WebRTC Signal: ${label} (${score}%)`}
          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer ${badgeStyle} ${className}`}
        >
          <WifiSignalIcon level={level} isTransferring={isTransferring} className="w-3.5 h-3.5" />
          {showPing && rtt !== null && (
            <span className="font-mono text-[11px] font-bold">
              {rtt}ms
            </span>
          )}
        </button>
      ) : (
        /* Full Badge Variant */
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => setShowModal(true)}
          title="Click to view detailed WebRTC peer signal metrics"
          className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm cursor-pointer ${badgeStyle} ${className}`}
        >
          <WifiSignalIcon level={level} isTransferring={isTransferring} className="w-4 h-4" />
          {showLabel && (
            <span className="tracking-tight">
              {label}
            </span>
          )}
          {showPing && rtt !== null && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 font-black">
              {rtt}ms
            </span>
          )}
        </motion.button>
      )}

      {/* Diagnostics Modal via Portal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 overflow-y-auto no-scrollbar">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowModal(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
              />

              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="relative w-full max-w-md my-auto bg-gray-900 border border-gray-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl z-[121] text-left"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-800">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`p-3 rounded-2xl border ${
                        level === 4
                          ? 'bg-emerald-500/15 border-emerald-500/30'
                          : level === 3
                          ? 'bg-blue-500/15 border-blue-500/30'
                          : level === 2
                          ? 'bg-amber-500/15 border-amber-500/30'
                          : 'bg-rose-500/15 border-rose-500/30'
                      }`}
                    >
                      <WifiSignalIcon level={level} isTransferring={isTransferring} className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                        <span>P2P Signal Quality</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            level === 4
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : level === 3
                              ? 'bg-blue-500/20 text-blue-300'
                              : level === 2
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {label}
                        </span>
                      </h3>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">
                        Real-time WebRTC peer connection telemetry
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Signal Strength Progress Bar */}
                <div className="mb-6 p-4 bg-gray-800/60 rounded-2xl border border-gray-750">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      Connection Health
                    </span>
                    <span className="text-xs font-mono font-black text-white">
                      {score}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-950/60 rounded-full overflow-hidden p-0.5 border border-gray-700/60">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(8, score)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        level === 4
                          ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                          : level === 3
                          ? 'bg-gradient-to-r from-blue-600 to-cyan-400'
                          : level === 2
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          : 'bg-gradient-to-r from-rose-600 to-red-400'
                      }`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400 font-medium mt-2">
                    <span>Weak</span>
                    <span>Fair</span>
                    <span>Good</span>
                    <span>Excellent</span>
                  </div>
                </div>

                {/* Metrics Breakdown Grid */}
                <div className="grid grid-cols-2 gap-2.5 mb-5">
                  <div className="p-3 bg-gray-800/50 border border-gray-750 rounded-2xl">
                    <div className="flex items-center space-x-1.5 text-xs text-gray-400 mb-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <span>Round-Trip Latency</span>
                    </div>
                    <div className="text-lg font-black font-mono text-white">
                      {rtt !== null ? `${rtt} ms` : 'Evaluating...'}
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {rtt !== null && rtt < 40
                        ? 'Ultra-low latency'
                        : rtt !== null && rtt < 100
                        ? 'Fast responsiveness'
                        : 'Standard network delay'}
                    </span>
                  </div>

                  <div className="p-3 bg-gray-800/50 border border-gray-750 rounded-2xl">
                    <div className="flex items-center space-x-1.5 text-xs text-gray-400 mb-1">
                      <ArrowUpDown className="w-3.5 h-3.5 text-blue-400" />
                      <span>Transfer Channel</span>
                    </div>
                    <div className="text-lg font-black text-white capitalize">
                      {mode === 'p2p' ? 'Direct P2P' : 'Relay'}
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {mode === 'p2p' ? 'Zero server routing' : 'Signaling relay'}
                    </span>
                  </div>
                </div>

                {/* Peer Topology Box */}
                <div className="p-4 bg-gray-800/50 border border-gray-750 rounded-2xl space-y-3 mb-6">
                  <div className="flex items-start space-x-3">
                    <Radio className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-white">
                        {candidateInfo.title}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                        {candidateInfo.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 pt-2 border-t border-gray-700/60">
                    <ShieldCheck className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-white">
                        Packet Reliability
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                        Ordered RTCDataChannel with buffer management for high-throughput lossless streaming.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-blue-600/25 active:scale-95 cursor-pointer"
                >
                  Close
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
