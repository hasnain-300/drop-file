import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Zap, X } from 'lucide-react';
import { useInstall } from '../context/InstallContext';

export function InstallNavbarBanner() {
  const { isInstalled, showInstallBanner, handleInstall, dismissBanner } = useInstall();

  // If installed or user closed banner, do not show
  if (isInstalled || !showInstallBanner) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="w-full bg-gradient-to-r from-blue-950/90 via-[#0a152e]/90 to-blue-950/90 border-b border-blue-500/30 text-white z-40 backdrop-blur-md overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <span className="flex-shrink-0 p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Zap className="w-4 h-4 fill-current" />
            </span>
            <p className="font-medium text-gray-200 truncate">
              <span className="font-bold text-white">Offline Transfer Mode:</span> Install Fast Share on this device to share files without internet.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              className="px-3.5 py-1.5 cursor-pointer rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md shadow-blue-500/30 transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install Now</span>
            </button>
            
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
