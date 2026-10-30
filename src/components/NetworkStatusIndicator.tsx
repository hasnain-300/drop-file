import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { networkStatus, NetworkHealthState } from '../lib/networkStatus';
import { Wifi, WifiOff, AlertTriangle, ShieldCheck, CheckCircle2, ChevronDown, X, RefreshCw, Activity, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface NetworkStatusIndicatorProps {
  variant?: 'navbar' | 'floating';
}

export const NetworkStatusIndicator: React.FC<NetworkStatusIndicatorProps> = ({ variant = 'navbar' }) => {
  const [health, setHealth] = useState<NetworkHealthState>(networkStatus.getState());
  const [showDetails, setShowDetails] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [prevStatus, setPrevStatus] = useState<string>(health.status);

  useEffect(() => {
    const unsubscribe = networkStatus.subscribe((state) => {
      setHealth(state);

      // Toast notification on status change
      if (prevStatus !== state.status) {
        if (state.status === 'offline') {
          toast.error('Network Offline: P2P connectivity compromised. Switch to Offline Mode if needed.', {
            id: 'net-status-toast',
            duration: 5000,
          });
        } else if (state.status === 'compromised') {
          toast('P2P connection or signaling compromised', {
            icon: '⚠️',
            id: 'net-status-toast',
            duration: 5000,
          });
        } else if (state.status === 'online' && prevStatus !== 'online') {
          toast.success('Network and P2P connectivity restored', {
            id: 'net-status-toast',
            duration: 3000,
          });
        }
        setPrevStatus(state.status);
      }
    });

    return () => unsubscribe();
  }, [prevStatus]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const res = await networkStatus.checkNow();
      if (res.status === 'online') {
        toast.success('Network & P2P connection verified active!', { id: 'diag-toast', duration: 2500 });
      } else if (res.status === 'offline') {
        toast.error('Device is offline.', { id: 'diag-toast', duration: 2500 });
      } else {
        toast('Connection is compromised or degraded.', { icon: '⚠️', id: 'diag-toast', duration: 2500 });
      }
    } finally {
      setIsChecking(false);
    }
  };

  const isOnline = health.status === 'online';
  const isCompromised = health.status === 'compromised';

  return (
    <>
      {/* Trigger Button: Navbar mode vs Floating mobile mode */}
      {variant === 'navbar' ? (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowDetails(true)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
              : isCompromised
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/35 hover:bg-amber-500/20 animate-pulse'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/35 hover:bg-rose-500/20 animate-pulse'
          }`}
          title="Network & P2P Connectivity Status"
          aria-label="Network Status Indicator"
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOnline ? 'bg-emerald-400' : isCompromised ? 'bg-amber-400' : 'bg-rose-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? 'bg-emerald-500' : isCompromised ? 'bg-amber-500' : 'bg-rose-500'
              }`}
            />
          </span>

          {isOnline ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : isCompromised ? (
            <AlertTriangle className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}

          <span className="hidden sm:inline font-semibold">
            {isOnline ? 'Online' : isCompromised ? 'Compromised' : 'Offline'}
          </span>
          <ChevronDown className="w-3 h-3 opacity-60 hidden sm:inline" />
        </motion.button>
      ) : (
        /* Floating Action Button for mobile screen corner */
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowDetails(true)}
         className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border shadow-sm ${
            isOnline
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20'
              : isCompromised
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/35 hover:bg-amber-500/20 animate-pulse'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/35 hover:bg-rose-500/20 animate-pulse'
          }`}
          title="Network & P2P Connectivity Status"
          aria-label="Mobile Network Status"
        >
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isOnline ? 'bg-emerald-400' : isCompromised ? 'bg-amber-400' : 'bg-rose-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isOnline ? 'bg-emerald-500' : isCompromised ? 'bg-amber-500' : 'bg-rose-500'
              }`}
            />
          </span>

          {isOnline ? (
            <Wifi className="w-4 h-4 text-emerald-400" />
          ) : isCompromised ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <WifiOff className="w-4 h-4 text-rose-400" />
          )}

          <span className="font-bold text-xs tracking-tight">
            {isOnline ? 'Online' : isCompromised ? 'P2P Degraded' : 'Offline'}
          </span>
        </motion.button>
      )}

      {/* Centered Modal Details Dialog - Mounted at document.body via Portal to guarantee top stacking */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showDetails && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto no-scrollbar">
              {/* Dimmed backdrop blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDetails(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
              />

              {/* Centered Modal Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="relative w-full max-w-md my-auto bg-gray-900 border border-gray-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl z-[101] text-left max-h-[90vh] overflow-y-auto no-scrollbar"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-800">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-2xl border ${
                      isOnline
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : isCompromised
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {isOnline ? <Wifi className="w-6 h-6" /> : isCompromised ? <AlertTriangle className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight">
                        Network & P2P Diagnostics
                      </h3>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          isOnline ? 'bg-emerald-400' : isCompromised ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                        <span className="text-xs text-gray-400 font-medium">
                          {isOnline ? 'Fully connected & verified' : isCompromised ? 'P2P degraded or partial' : 'Disconnected from network'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowDetails(false)}
                    className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Status List Cards */}
                <div className="space-y-2.5 mb-5">
                  <div className="flex items-center justify-between p-3 bg-gray-800/60 border border-gray-750 rounded-2xl">
                    <div className="flex items-center space-x-2.5">
                      <Radio className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-medium text-gray-300">Device Network Interface</span>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      health.isOnline ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                    }`}>
                      {health.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-800/60 border border-gray-750 rounded-2xl">
                    <div className="flex items-center space-x-2.5">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-medium text-gray-300">Direct WebRTC P2P</span>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      health.p2pAvailable ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {health.p2pAvailable ? 'High Speed Ready' : 'Limited'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-800/60 border border-gray-750 rounded-2xl">
                    <div className="flex items-center space-x-2.5">
                      <ShieldCheck className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-medium text-gray-300">Hotspot & Cross-Net Discovery</span>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      health.signalingAvailable ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {health.signalingAvailable ? 'Active' : 'Degraded'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-800/60 border border-gray-750 rounded-2xl">
                    <div className="flex items-center space-x-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-medium text-gray-300">Inactivity Safeguard</span>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-400 font-mono">
                      1-Min Auto-Disconnect
                    </span>
                  </div>
                </div>

                {/* Context Guidance Box */}
                <div className="p-4 bg-blue-950/30 border border-blue-900/40 rounded-2xl text-xs text-blue-200/90 leading-relaxed mb-6">
                  {isOnline ? (
                    <div className="flex items-start space-x-2.5">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-white mb-0.5">High-Speed P2P Active</p>
                        <p className="text-[11px] text-blue-300/80">
                          Compatible across phones, laptops, and PCs on either same Wi-Fi, mobile hotspot, or different networks. Connections stay alive until manually ended or after 1 minute of complete inactivity.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start space-x-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-white mb-0.5">Offline Network Detected</p>
                        <p className="text-[11px] text-blue-300/80">
                          Device is disconnected from the internet. You can still transfer files using <strong>Offline Mode</strong> via QR code scanning or direct hotspot connection.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleManualCheck}
                    disabled={isChecking}
                    className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 bg-gray-800 hover:bg-gray-750 text-white rounded-2xl text-xs font-bold border border-gray-700 transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-blue-400' : ''}`} />
                    <span>{isChecking ? 'Checking...' : 'Recheck Status'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDetails(false)}
                    className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
