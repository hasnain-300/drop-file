import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { sessionMetrics, SessionMetricsState, formatBytes, formatSpeed } from '../lib/sessionMetrics';
import { TransferRateChart } from './TransferRateChart';
import { Activity, X, BarChart3, ArrowUpRight, ArrowDownLeft, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SessionMetricsButtonProps {
  variant?: 'navbar' | 'floating';
}

export const SessionMetricsButton: React.FC<SessionMetricsButtonProps> = ({ variant = 'navbar' }) => {
  const [metrics, setMetrics] = useState<SessionMetricsState>(sessionMetrics.getState());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = sessionMetrics.subscribe((state) => {
      setMetrics(state);
    });
    return () => unsubscribe();
  }, []);

  return (
    <>
      {variant === 'navbar' ? (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20 transition-all shadow-sm"
          title="View Total Session Data & D3 Transfer Rates"
          aria-label="Session Transfer Rates"
        >
          <Activity className={`w-3.5 h-3.5 ${metrics.isActive ? 'text-emerald-400 animate-pulse' : 'text-blue-400'}`} />
          <span className="font-mono">{formatBytes(metrics.totalBytesTransferred)}</span>
          <BarChart3 className="w-3 h-3 opacity-60 hidden sm:inline" />
        </motion.button>
      ) : (
        /* Floating Action Button for mobile screen bottom-right */
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20 transition-all shadow-sm"
          title="Session Data Transferred & D3 Speed"
          aria-label="Mobile Session Data"
        >
          <Activity className={`w-3.5 h-3.5 ${metrics.isActive ? 'text-emerald-400 animate-pulse' : 'text-blue-400'}`} />
          <div className="flex flex-col items-start leading-none text-left">
            <span className="font-mono text-xs text-white font-bold">
              {formatBytes(metrics.totalBytesTransferred)}
              {metrics.isActive && (
                <span className="text-emerald-400 ml-1 text-[10px]">({formatSpeed(metrics.currentRateBps)})</span>
              )}
            </span>
          </div>
          <BarChart3 className="w-3.5 h-3.5 text-blue-400 ml-1 opacity-80" />
        </motion.button>
      )}

      {/* Centered Modal Details Dialog - Mounted at document.body via Portal to guarantee top stacking */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto no-scrollbar">
              {/* Dimmed backdrop blur */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
              />

              {/* Centered Modal Content Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="relative w-full max-w-3xl my-auto bg-gray-900 border border-gray-700/80 rounded-3xl p-5 sm:p-7 md:p-8 shadow-2xl z-[101] max-h-[92vh] overflow-y-auto no-scrollbar text-left"
              >
                <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-800">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-blue-500/10 rounded-2xl text-blue-400 border border-blue-500/20">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                        Session Transfer Analytics
                      </h3>
                      <p className="text-xs text-gray-400">
                        Total data transferred & real-time D3 transfer speed visualizer
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
                    aria-label="Close modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* D3 Transfer Rate Chart & Statistics */}
                <TransferRateChart compact={false} />

                <div className="mt-6 pt-4 border-t border-gray-800/80 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20"
                  >
                    Done
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
