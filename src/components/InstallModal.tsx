import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Download, WifiOff, Zap, ShieldCheck, Smartphone, X } from 'lucide-react';
import { useInstall } from '../context/InstallContext';

export function InstallModal() {
  const { showInstallModal, handleInstall, dismissModal, isIOS } = useInstall();

  if (!showInstallModal || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={dismissModal}
          className="fixed inset-0 bg-[#020617]/85 backdrop-blur-md"
        />

        {/* Compact, perfectly centered Modal with ZERO scroll */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          className="relative w-full max-w-[360px] overflow-hidden bg-[#0f172a]/95 border border-blue-500/30 rounded-3xl p-4 sm:p-5 text-white shadow-2xl shadow-blue-950/70 z-[101]"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={dismissModal}
            className="absolute top-3.5 right-3.5 p-1 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close installation alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="flex flex-col items-center text-center">
            {/* Header Icon */}
            <div className="relative mb-2">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-blue-500/30 p-2.5">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center border-2 border-[#0f172a]">
                <WifiOff className="w-2 h-2 text-black stroke-[3]" />
              </div>
            </div>

            {/* Tag */}
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-wider mb-1.5">
              <Zap className="w-2.5 h-2.5 fill-current" />
              <span>Offline Transfer Setup</span>
            </div>

            {/* Title */}
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight mb-1">
              Install Fast Share
            </h3>

            {/* Concise Message */}
            <p className="text-[11px] text-gray-300 leading-normal max-w-xs mb-2.5 font-normal">
              To transfer files <strong className="text-white font-semibold">100% offline</strong> without internet or Wi-Fi router, install Fast Share on this device.
            </p>

            {/* Micro Feature Chips - div:nth-of-type(3) with compact bottom margin */}
            <div className="flex items-center justify-center gap-1.5 w-full mb-3 text-[10px] font-medium text-gray-300">
              <span className="px-2 py-0.5 rounded-md bg-gray-900/80 border border-gray-800 flex items-center space-x-1">
                <WifiOff className="w-2.5 h-2.5 text-blue-400" />
                <span>Offline</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-900/80 border border-gray-800 flex items-center space-x-1">
                <Zap className="w-2.5 h-2.5 text-emerald-400" />
                <span>Direct P2P</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-900/80 border border-gray-800 flex items-center space-x-1">
                <ShieldCheck className="w-2.5 h-2.5 text-purple-400" />
                <span>Private</span>
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 w-full">
              <button
                onClick={handleInstall}
                className="w-full cursor-pointer py-2.5 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-blue-500/30 flex items-center justify-center space-x-1.5 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isIOS ? 'Install on iOS' : 'Install Fast Share App'}</span>
              </button>

              <button
                onClick={dismissModal}
                className="w-full cursor-pointer py-1.5 px-2 text-[11px] font-semibold text-gray-400 hover:text-white transition-colors"
              >
                Continue in Browser
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
