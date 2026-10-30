import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, Zap } from 'lucide-react';

export interface ResetLoadingScreenProps {
  isVisible: boolean;
  stepMessage: string;
  progress: number;
  onDismiss?: () => void;
}

export function ResetLoadingScreen({
  isVisible,
  stepMessage,
  progress,
  onDismiss,
}: ResetLoadingScreenProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="reset-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease: 'easeInOut' } }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#020617] text-white select-none px-6"
          style={{ backgroundColor: '#020617' }}
        >
          {/* Ambient background glow matching the app theme */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(37,99,235,0.18),transparent_65%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,rgba(79,70,229,0.12),transparent_55%)] pointer-events-none" />

          {/* Central Animated Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 flex flex-col items-center max-w-sm w-full text-center"
          >
            {/* Animated Icon Ring */}
            <div className="relative mb-8 flex items-center justify-center">
              {/* Outer rotating dashed ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                className="absolute w-28 h-28 rounded-full border-2 border-dashed border-blue-500/30"
              />

              {/* Pulsing glow aura */}
              <motion.div
                animate={{
                  scale: [1, 1.25, 1],
                  opacity: [0.35, 0.7, 0.35],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute w-24 h-24 rounded-3xl bg-blue-600/30 blur-xl"
              />

              {/* Main Badge Container */}
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 p-0.5 shadow-2xl shadow-blue-500/40 flex items-center justify-center">
                <div className="w-full h-full bg-[#030712] rounded-[22px] flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-indigo-600/20" />
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                  >
                    <RefreshCw className="w-9 h-9 text-blue-400" />
                  </motion.div>
                </div>
              </div>

              {/* Mini corner Zap badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15 }}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-500 border-2 border-[#020617] flex items-center justify-center shadow-lg shadow-blue-500/50"
              >
                <Zap className="w-3.5 h-3.5 text-white fill-current" />
              </motion.div>
            </div>

            {/* Brand Title */}
            <h2 className="text-2xl font-black tracking-tight text-white mb-2">
              Resetting Application
            </h2>

            {/* Step Message */}
            <div className="h-10 flex items-center justify-center mb-6 px-4">
              <motion.p
                key={stepMessage}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="text-xs sm:text-sm font-medium text-gray-400 tracking-wide"
              >
                {stepMessage}
              </motion.p>
            </div>

            {/* Progress bar container */}
            <div className="w-full max-w-xs bg-gray-900/80 border border-gray-800 rounded-full h-2.5 overflow-hidden p-0.5 shadow-inner mb-4">
              <motion.div
                initial={{ width: '10%' }}
                animate={{ width: `${Math.min(100, Math.max(10, progress))}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 shadow-md shadow-blue-500/50"
              />
            </div>

            {/* Percentage indicator */}
            <div className="flex items-center justify-between w-full max-w-xs px-1 text-[11px] font-mono font-bold tracking-wider text-gray-500">
              <span className="uppercase">Resetting...</span>
              <span>{Math.round(progress)}%</span>
            </div>

            {/* Safe dismiss in case user wants to force proceed */}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="mt-6 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1 px-3 rounded-lg hover:bg-gray-800/40"
              >
                Cancel / Skip
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
