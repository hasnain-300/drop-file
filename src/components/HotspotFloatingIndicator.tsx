import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, Wifi, ArrowRight, X } from 'lucide-react';
import { useHotspot } from '../context/HotspotContext';

export function HotspotFloatingIndicator() {
  const { isHotspotActive, hotspotRoomId, hotspotRole, isPeerConnected, hotspotKey, stopHotspot } = useHotspot();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isHotspotActive) return null;

  // Determine if the user is already actively viewing the connection screen
  const isCurrentlyOnSendOffline = location.pathname === '/send';
  const isCurrentlyOnReceiveSignal = location.pathname.startsWith('/receive');

  // If the user is actively on the Send or Receive screen, the primary connection card is already visible.
  // The floating indicator is designed to guide them back when they navigate away or accidentally back out.
  if (isCurrentlyOnSendOffline || isCurrentlyOnReceiveSignal) return null;

  const handleReturnToSignal = () => {
    if (hotspotRole === 'sender') {
      navigate('/send?mode=offline');
    } else {
      navigate(`/receive?hotspot=1&room=${hotspotRoomId}${hotspotKey ? `&key=${encodeURIComponent(hotspotKey)}` : ''}`);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="fixed top-20 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-40 max-w-sm w-[92%] sm:w-auto"
      >
        <div className="flex items-center space-x-3 px-4 py-2.5 rounded-2xl bg-[#030712]/95 border border-blue-500/40 shadow-2xl shadow-blue-950/60 backdrop-blur-xl text-white">
          {/* Pulsing signal beacon */}
          <div className="relative flex items-center justify-center flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-400 opacity-40" />
            <div className="relative w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/40">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
          </div>

          {/* Signal Info */}
          <button
            onClick={handleReturnToSignal}
            className="flex flex-col items-start text-left min-w-0 flex-1 hover:opacity-90 transition-opacity"
            title="Click to return to active connection signal"
          >
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                Hotspot Signal Active
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            </div>
            <span className="text-xs font-mono font-bold text-gray-200 truncate">
              Room #{hotspotRoomId} {isPeerConnected ? '• Connected' : '• Ready to connect'}
            </span>
          </button>

          {/* Action button to return */}
          <button
            onClick={handleReturnToSignal}
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center space-x-1 shadow-md shadow-blue-600/30 transition-all flex-shrink-0"
          >
            <span>Connect</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Quick stop button */}
          <button
            onClick={stopHotspot}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors flex-shrink-0"
            title="Stop Hotspot Network"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
