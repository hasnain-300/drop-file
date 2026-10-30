/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Send } from './pages/Send';
import { Receive } from './pages/Receive';
import { History } from './pages/History';
import { Send as SendIcon, Download, Smartphone, Zap, RefreshCw, Clock, Lock, ArrowLeft, Radio, ArrowRight, Wifi } from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';
import { NetworkStatusIndicator } from './components/NetworkStatusIndicator';
import { SessionMetricsButton } from './components/SessionMetricsModal';
import { ResetProvider, useReset } from './context/ResetContext';
import { InstallProvider, useInstall } from './context/InstallContext';
import { HotspotProvider, useHotspot } from './context/HotspotContext';
import { InstallModal } from './components/InstallModal';
import { InstallNavbarBanner } from './components/InstallNavbarBanner';
import { HotspotFloatingIndicator } from './components/HotspotFloatingIndicator';


function Home() {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { triggerReset, isResetting } = useReset();
  const { detectedSignal, hotspotRole } = useHotspot();

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandaloneMode = ('standalone' in window.navigator && (window.navigator as any).standalone) || window.matchMedia('(display-mode: standalone)').matches;
    
    setIsIOS(isIosDevice);
    setIsStandalone(isStandaloneMode);
  }, []);

  const handleReset = () => {
    setShowResetConfirm(false);
    triggerReset();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-6 sm:pt-12 sm:pb-8 sm:px-6 lg:px-8 text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="inline-flex items-center space-x-2 bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8 border border-blue-100/50 dark:border-blue-800/30 shadow-xl shadow-blue-500/5">
          <Zap className="w-3 h-3 fill-current" />
          <span>v2.0 is now live</span>
        </div>
        
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter leading-none">
          Share files <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">instantly.</span>
        </h1>
        
        <p className="text-base sm:text-xl text-gray-600 dark:text-gray-400 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed font-medium">
          Fast Share uses peer-to-peer technology to transfer files directly between devices. No servers, no limits, just pure speed.
        </p>

        {/* Instant Hotspot Network Signal Detection Banner */}
        {detectedSignal && hotspotRole !== 'sender' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 max-w-md mx-auto p-3.5 sm:p-4 bg-gradient-to-r from-blue-950/80 via-slate-900/90 to-indigo-950/80 border-2 border-blue-500/50 rounded-3xl shadow-2xl flex items-center justify-between text-left"
          >
            <div className="flex items-center space-x-3 min-w-0">
              <div className="relative flex items-center justify-center flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-blue-400 opacity-40" />
                <div className="relative w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/40">
                  <Radio className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                    Sender Signal Detected!
                  </span>
                  <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-[9px] font-bold rounded border border-blue-500/40">
                    HOTSPOT
                  </span>
                </div>
                <p className="text-xs text-gray-200 font-mono truncate font-bold mt-0.5">
                  Room #{detectedSignal.roomId} • {detectedSignal.ssid}
                </p>
              </div>
            </div>
            <Link
              to={`/receive?hotspot=1&room=${detectedSignal.roomId}`}
              className="ml-3 px-3.5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md shadow-blue-600/30 flex items-center space-x-1 flex-shrink-0 active:scale-95 transition-all"
            >
              <span>Connect</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-10 sm:mb-12">
          <Link to="/send" className="w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto px-9 py-4 sm:py-4.5 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] text-base sm:text-lg font-black transition-all shadow-2xl shadow-blue-500/40 flex items-center justify-center space-x-3"
            >
              <SendIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>Send Files</span>
            </motion.button>
          </Link>
          <Link to="/receive" className="w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto px-9 py-4 sm:py-4.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-[2rem] text-base sm:text-lg font-black transition-all shadow-xl hover:shadow-2xl border border-gray-100 dark:border-gray-700 flex items-center justify-center space-x-3"
            >
              <Download className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>Receive Files</span>
            </motion.button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto mb-2">
          {[
            { icon: Lock, title: "Private", desc: "End-to-end encrypted transfers" },
            { icon: Zap, title: "Fast", desc: "Direct peer-to-peer connection" },
            { icon: Smartphone, title: "Simple", desc: "No account or setup required" }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + (i * 0.1) }}
              className="p-6 sm:p-7 glass rounded-[2.5rem] text-center group hover:scale-105 transition-transform"
            >
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:rotate-12 transition-transform">
                <feature.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white mb-1.5 tracking-tight">{feature.title}</h3>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
      
      {isIOS && !isStandalone && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8 max-w-lg mx-auto glass border border-blue-200 dark:border-blue-800 rounded-[2.5rem] p-6 text-sm text-blue-800 dark:text-blue-300 flex items-start space-x-4 text-left shadow-xl shadow-blue-500/5"
        >
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-sm mb-1">Install on iOS</p>
            <p className="opacity-80 leading-relaxed text-xs font-medium">Tap the <strong>Share</strong> button in Safari and select <strong>"Add to Home Screen"</strong> for the best experience.</p>
          </div>
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-8 pt-6 border-t border-gray-100/60 dark:border-gray-800/60"
      >
        <button 
          onClick={() => setShowResetConfirm(true)}
          className="px-6 py-3 text-[11px] font-black text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all flex items-center space-x-2 mx-auto bg-gray-100/40 dark:bg-gray-800/40 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 uppercase tracking-widest"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Reset Application Settings</span>
        </button>
      </motion.div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showResetConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowResetConfirm(false)}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 z-[101]"
              >
                <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <RefreshCw className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-4">Reset Application?</h3>
                <p className="text-gray-600 dark:text-gray-400 text-center mb-8 leading-relaxed">
                  This will clear all local storage, history, and settings. The page will reload. Continue?
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-2xl text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isResetting}
                    onClick={handleReset}
                    className="py-3.5 bg-amber-600 text-white rounded-2xl text-sm font-bold hover:bg-amber-700 transition-all shadow-xl shadow-amber-500/20 disabled:opacity-50"
                  >
                    {isResetting ? 'Resetting...' : 'Yes, Reset'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const { isInstalled, handleInstall } = useInstall();

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#030712]/90 backdrop-blur-xl border-b border-gray-800/80 shadow-md shadow-black/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center space-x-4">
            <AnimatePresence mode="wait">
              {!isHome && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={() => navigate(-1)}
                  className="text-gray-600 p-2 cursor-pointer hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all shadow-sm"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-8 h-5" />
                </motion.button>
              )}
            </AnimatePresence>

            <Link to="/" className="flex items-center space-x-3 group">
              <div className="p-2 bg-blue-600 rounded-2xl group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/20">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="font-black text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">Fast Share</span>
            </Link>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Desktop / Tablet: Navbar Status Buttons */}
            <div className="hidden md:flex items-center space-x-2.5">
              <SessionMetricsButton variant="navbar" />
              <NetworkStatusIndicator variant="navbar" />
            </div>

            <Link to="/history" className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all rounded-2xl hover:bg-gray-100/50 dark:hover:bg-gray-800/50 font-bold text-sm">
              <Clock className="w-4 h-4" />
              <span className="">History</span>
            </Link>
            
           
          </div>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  useEffect(() => {
    // Force dark mode
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <InstallProvider>
      <HotspotProvider>
        <ResetProvider>
          <Router>
            <Toaster 
              position="bottom-center" 
              toastOptions={{ 
                duration: 4000,
                style: {
                  background: '#1f2937',
                  color: '#fff',
                  borderRadius: '1rem',
                  padding: '1rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                }
              }} 
            />

            {/* Global Install Alert Modal (for first-time visitors if not installed) */}
            <InstallModal />

            {/* Global Persistent Hotspot Indicator (visible on screen whenever hotspot is active) */}
            <HotspotFloatingIndicator />

            <div className="min-h-screen bg-transparent font-sans text-gray-900 dark:text-gray-100 selection:bg-blue-200 dark:selection:bg-blue-900">
              <Navbar />

              {/* Persistent Install Banner right below Navbar (if modal dismissed & not installed) */}
              <InstallNavbarBanner />

              <main className="relative z-10 pb-8 sm:pb-12">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/send" element={<Send />} />
                  <Route path="/receive" element={<Receive />} />
                  <Route path="/receive/:roomId" element={<Receive />} />
                  <Route path="/history" element={<History />} />
                </Routes>
              </main>

              {/* Mobile-Only Floating Action Buttons: Stacked vertically at bottom-right corner */}
              <div 
                className="fixed bottom-5 right-4 z-40 md:hidden flex flex-col items-end space-y-2 pointer-events-auto"
                aria-label="Mobile Floating Status Actions"
              >
                <SessionMetricsButton variant="floating" />
                <NetworkStatusIndicator variant="floating" />
              </div>
            </div>
          </Router>
        </ResetProvider>
      </HotspotProvider>
    </InstallProvider>
  );
}
