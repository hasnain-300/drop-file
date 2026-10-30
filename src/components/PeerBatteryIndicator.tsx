import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Battery, 
  BatteryCharging, 
  BatteryWarning, 
  AlertTriangle, 
  Info, 
  X, 
  Smartphone, 
  Laptop,
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { PeerBatteryState, formatBatteryDuration, isLowBattery } from '../lib/battery';

export interface PeerBatteryIndicatorProps {
  localBattery?: PeerBatteryState | null;
  remoteBattery?: PeerBatteryState | null;
  isTransferring?: boolean;
  variant?: 'badge' | 'compact' | 'minimal' | 'full';
  className?: string;
  showModalByDefault?: boolean;
}

/**
 * Pixel-perfect SVG Battery Gauge with accurate fill level and optional charging bolt
 */
export const BatteryGaugeIcon: React.FC<{
  level?: number;
  charging?: boolean;
  supported?: boolean;
  isPulsing?: boolean;
  className?: string;
}> = ({ level = 100, charging = false, supported = true, isPulsing = false, className = 'w-5 h-3.5' }) => {
  if (!supported) {
    return (
      <div className={`relative inline-flex items-center text-gray-400 dark:text-gray-500 ${className}`} title="Battery API not supported on this browser">
        <Battery className="w-full h-full opacity-60" />
      </div>
    );
  }

  // Determine color based on charge status & percentage
  let color = 'text-emerald-500 dark:text-emerald-400';
  let fillColor = '#10b981'; // emerald-500
  if (charging) {
    color = 'text-emerald-500 dark:text-emerald-400';
    fillColor = '#10b981';
  } else if (level <= 20) {
    color = 'text-rose-500 dark:text-rose-400';
    fillColor = '#f43f5e'; // rose-500
  } else if (level <= 50) {
    color = 'text-amber-500 dark:text-amber-400';
    fillColor = '#f59e0b'; // amber-500
  }

  // Calculate inner fill width (inner viewBox width is approx 18 units)
  const maxFillWidth = 16.5;
  const fillWidth = Math.max(1.5, Math.min(maxFillWidth, (level / 100) * maxFillWidth));

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {isPulsing && level <= 20 && !charging && (
        <span className="absolute -inset-1 rounded-md bg-rose-500/30 animate-ping" />
      )}
      <svg
        viewBox="0 0 25 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full ${color} transition-colors duration-300`}
      >
        {/* Outer Battery Shell */}
        <rect
          x="1"
          y="1"
          width="20"
          height="12"
          rx="3"
          stroke="currentColor"
          strokeWidth="1.8"
          className="opacity-90"
        />
        {/* Battery Positive Terminal Tip */}
        <path
          d="M 23 4.5 C 23.8 4.5 24 5.2 24 6 L 24 8 C 24 8.8 23.8 9.5 23 9.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* Inner Battery Level Fill */}
        <rect
          x="2.7"
          y="2.7"
          width={fillWidth}
          height="8.6"
          rx="1.5"
          fill={fillColor}
          className="transition-all duration-500 ease-out"
        />
        {/* Lightning bolt if charging */}
        {charging && (
          <path
            d="M 11.5 2.5 L 7.5 8 L 11 8 L 9.5 12 L 14.5 6.5 L 11 6.5 Z"
            fill="#ffffff"
            stroke="currentColor"
            strokeWidth="0.8"
            className="filter drop-shadow-sm"
          />
        )}
      </svg>
    </div>
  );
};

export const PeerBatteryIndicator: React.FC<PeerBatteryIndicatorProps> = ({
  localBattery,
  remoteBattery,
  isTransferring = false,
  variant = 'compact',
  className = '',
  showModalByDefault = false,
}) => {
  const [showModal, setShowModal] = useState(showModalByDefault);

  const localLevel = localBattery?.supported ? localBattery.level : null;
  const remoteLevel = remoteBattery?.supported ? remoteBattery.level : null;

  const localLow = isLowBattery(localBattery);
  const remoteLow = isLowBattery(remoteBattery);
  const anyLow = localLow || remoteLow;

  const localCharging = Boolean(localBattery?.charging);
  const remoteCharging = Boolean(remoteBattery?.charging);

  // Styling based on lowest battery state
  const isCritical = (localLow && !localCharging) || (remoteLow && !remoteCharging);

  return (
    <>
      {variant === 'minimal' ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title={`Battery: You (${localLevel !== null ? `${localLevel}%` : 'N/A'}), Peer (${remoteLevel !== null ? `${remoteLevel}%` : 'N/A'})`}
          className={`inline-flex items-center space-x-1.5 p-1.5 rounded-xl transition-all active:scale-95 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
        >
          <BatteryGaugeIcon
            level={localBattery?.level}
            charging={localCharging}
            supported={localBattery?.supported}
            isPulsing={localLow}
            className="w-4 h-3"
          />
          {remoteBattery && (
            <BatteryGaugeIcon
              level={remoteBattery.level}
              charging={remoteCharging}
              supported={remoteBattery.supported}
              isPulsing={remoteLow}
              className="w-4 h-3 opacity-90"
            />
          )}
        </button>
      ) : variant === 'compact' ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          title="Click to view power & battery status for both connected peers"
          className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all active:scale-95 cursor-pointer shadow-xs ${
            isCritical
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/60 animate-pulse'
              : anyLow
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
              : 'bg-gray-50/90 hover:bg-gray-100 dark:bg-gray-800/80 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
          } ${className}`}
        >
          {/* Local Battery */}
          <div className="inline-flex items-center space-x-1">
            <BatteryGaugeIcon
              level={localBattery?.level}
              charging={localCharging}
              supported={localBattery?.supported}
              isPulsing={localLow}
              className="w-4 h-2.8"
            />
            <span className="font-mono text-[11px] font-bold">
              {localBattery?.supported && localLevel !== null ? `${localLevel}%` : 'You'}
              {localCharging && <Zap className="inline-block w-2.5 h-2.5 text-emerald-500 ml-0.5" />}
            </span>
          </div>

          {/* Divider if peer is connected */}
          {remoteBattery && (
            <>
              <span className="text-gray-300 dark:text-gray-600 font-light">|</span>
              {/* Remote Battery */}
              <div className="inline-flex items-center space-x-1">
                <BatteryGaugeIcon
                  level={remoteBattery.level}
                  charging={remoteCharging}
                  supported={remoteBattery.supported}
                  isPulsing={remoteLow}
                  className="w-4 h-2.8"
                />
                <span className="font-mono text-[11px] font-bold">
                  {remoteBattery.supported && remoteLevel !== null ? `${remoteLevel}%` : 'Peer'}
                  {remoteCharging && <Zap className="inline-block w-2.5 h-2.5 text-emerald-500 ml-0.5" />}
                </span>
              </div>
            </>
          )}
        </button>
      ) : (
        /* Full / Badge Variant */
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => setShowModal(true)}
          title="Click to view power & battery status for both connected peers"
          className={`inline-flex items-center space-x-2.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all shadow-sm cursor-pointer ${
            isCritical
              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800/60'
              : anyLow
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
              : 'bg-white/90 hover:bg-gray-50 dark:bg-gray-800/90 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
          } ${className}`}
        >
          {/* Local Pill */}
          <div className="flex items-center space-x-1.5">
            <BatteryGaugeIcon
              level={localBattery?.level}
              charging={localCharging}
              supported={localBattery?.supported}
              isPulsing={localLow}
              className="w-4 h-3"
            />
            <span className="font-mono text-xs">
              {localBattery?.supported && localLevel !== null ? `${localLevel}%` : 'You'}
              {localCharging && ' ⚡'}
            </span>
          </div>

          {remoteBattery && (
            <>
              <span className="text-gray-300 dark:text-gray-600 font-light">•</span>
              {/* Peer Pill */}
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-400">Peer:</span>
                <BatteryGaugeIcon
                  level={remoteBattery.level}
                  charging={remoteCharging}
                  supported={remoteBattery.supported}
                  isPulsing={remoteLow}
                  className="w-4 h-3"
                />
                <span className="font-mono text-xs">
                  {remoteBattery.supported && remoteLevel !== null ? `${remoteLevel}%` : 'Active'}
                  {remoteCharging && ' ⚡'}
                </span>
              </div>
            </>
          )}
        </motion.button>
      )}

      {/* Battery & Power Diagnostics Modal via Portal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[125] flex items-center justify-center p-4 sm:p-6 overflow-y-auto no-scrollbar">
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
                className="relative w-full max-w-md my-auto bg-gray-900 border border-gray-700/80 rounded-3xl p-6 sm:p-7 shadow-2xl z-[126] text-left text-white"
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-800">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
                      <BatteryCharging className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                        <span>Peer Power Status</span>
                        {isTransferring && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse">
                            TRANSFERRING
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium mt-0.5">
                        Real-time Web Battery API monitoring for file transfers
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Low Battery Warning Banner if any peer is low */}
                {anyLow && (
                  <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-start space-x-3 animate-pulse">
                    <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-rose-300">Low Battery Detected!</p>
                      <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                        {localLow && remoteLow
                          ? 'Both devices are low on battery and not charging.'
                          : localLow
                          ? 'This device is below 20% battery. Connect to a charger to prevent transfer interruption.'
                          : 'Connected peer device is below 20% battery. Transfer might stop if their device powers down.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Devices Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-5">
                  {/* Local Device Card */}
                  <div className="p-4 rounded-2xl bg-gray-800/80 border border-gray-700/60 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2 text-xs font-bold text-gray-300">
                        <Smartphone className="w-4 h-4 text-blue-400" />
                        <span>This Device</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-bold">
                        Local
                      </span>
                    </div>

                    <div className="flex items-baseline space-x-2 mb-2">
                      <span className="text-3xl font-black font-mono tracking-tight">
                        {localBattery?.supported && localLevel !== null ? `${localLevel}%` : 'N/A'}
                      </span>
                      {localCharging && (
                        <span className="text-xs font-bold text-emerald-400 flex items-center">
                          <Zap className="w-3.5 h-3.5 mr-0.5" /> Charging
                        </span>
                      )}
                    </div>

                    {/* Progress Bar Gauge */}
                    <div className="w-full bg-gray-700/70 h-2 rounded-full overflow-hidden mb-2.5">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          localCharging
                            ? 'bg-emerald-400'
                            : (localLevel ?? 100) <= 20
                            ? 'bg-rose-500'
                            : (localLevel ?? 100) <= 50
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${localBattery?.supported ? (localLevel ?? 100) : 100}%` }}
                      />
                    </div>

                    <div className="text-[11px] text-gray-400 space-y-0.5">
                      <p className="flex justify-between">
                        <span>Source:</span>
                        <strong className="text-gray-200">
                          {localCharging ? 'AC / USB Power' : 'Battery Power'}
                        </strong>
                      </p>
                      {localBattery?.chargingTime && (
                        <p className="flex justify-between">
                          <span>Full in:</span>
                          <strong className="text-emerald-400 font-mono">
                            {formatBatteryDuration(localBattery.chargingTime)}
                          </strong>
                        </p>
                      )}
                      {localBattery?.dischargingTime && (
                        <p className="flex justify-between">
                          <span>Remaining:</span>
                          <strong className="text-amber-400 font-mono">
                            {formatBatteryDuration(localBattery.dischargingTime)}
                          </strong>
                        </p>
                      )}
                      {!localBattery?.supported && (
                        <p className="text-[10px] text-gray-500 italic">
                          (Battery API restricted by Safari/iOS)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Remote Peer Card */}
                  <div className="p-4 rounded-2xl bg-gray-800/80 border border-gray-700/60 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2 text-xs font-bold text-gray-300">
                        <Laptop className="w-4 h-4 text-indigo-400" />
                        <span>Remote Peer</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold">
                        {remoteBattery ? 'Connected' : 'Waiting'}
                      </span>
                    </div>

                    {remoteBattery ? (
                      <>
                        <div className="flex items-baseline space-x-2 mb-2">
                          <span className="text-3xl font-black font-mono tracking-tight">
                            {remoteBattery.supported && remoteLevel !== null ? `${remoteLevel}%` : 'N/A'}
                          </span>
                          {remoteCharging && (
                            <span className="text-xs font-bold text-emerald-400 flex items-center">
                              <Zap className="w-3.5 h-3.5 mr-0.5" /> Charging
                            </span>
                          )}
                        </div>

                        {/* Progress Bar Gauge */}
                        <div className="w-full bg-gray-700/70 h-2 rounded-full overflow-hidden mb-2.5">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              remoteCharging
                                ? 'bg-emerald-400'
                                : (remoteLevel ?? 100) <= 20
                                ? 'bg-rose-500'
                                : (remoteLevel ?? 100) <= 50
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${remoteBattery.supported ? (remoteLevel ?? 100) : 100}%` }}
                          />
                        </div>

                        <div className="text-[11px] text-gray-400 space-y-0.5">
                          <p className="flex justify-between">
                            <span>Source:</span>
                            <strong className="text-gray-200">
                              {remoteCharging ? 'AC / USB Power' : 'Battery Power'}
                            </strong>
                          </p>
                          <p className="flex justify-between">
                            <span>Status:</span>
                            <strong className={remoteLow ? 'text-rose-400' : 'text-emerald-400'}>
                              {remoteLow ? 'Critically Low' : 'Normal'}
                            </strong>
                          </p>
                          {!remoteBattery.supported && (
                            <p className="text-[10px] text-gray-500 italic">
                              (Peer browser does not expose Battery API)
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="py-6 text-center text-gray-500 text-xs">
                        <Battery className="w-8 h-8 mx-auto mb-2 opacity-40 animate-pulse" />
                        <p>No peer connected yet.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Long Transfer Safety Guidance */}
                <div className="p-3.5 rounded-2xl bg-gray-800/40 border border-gray-700/50 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-gray-300">
                    <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span>Power Tips for Long File Transfers:</span>
                  </div>
                  <ul className="text-[11px] text-gray-400 space-y-1.5 pl-5 list-disc leading-relaxed">
                    <li>
                      <strong className="text-gray-300">Keep plugged in:</strong> Large transfers stream data at high speeds, keeping Wi-Fi transmitters and CPU active.
                    </li>
                    <li>
                      <strong className="text-gray-300">Prevent sleep:</strong> Keep the screen awake or avoid closing the browser tab to maintain active WebRTC streaming.
                    </li>
                    <li>
                      <strong className="text-gray-300">Auto-Pause protection:</strong> If battery drops to zero, unfinished files cannot be saved.
                    </li>
                  </ul>
                </div>

                {/* Footer action */}
                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold transition-all border border-gray-700"
                  >
                    Got it
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

/**
 * Prominent Low Battery Warning Toast/Banner component during active transfers
 */
export const LowBatteryAlertBanner: React.FC<{
  localBattery?: PeerBatteryState | null;
  remoteBattery?: PeerBatteryState | null;
  isTransferring?: boolean;
  onDismiss?: () => void;
}> = ({ localBattery, remoteBattery, isTransferring = false, onDismiss }) => {
  const localLow = isLowBattery(localBattery);
  const remoteLow = isLowBattery(remoteBattery);

  if (!isTransferring || (!localLow && !remoteLow)) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-rose-950/80 via-red-900/60 to-rose-950/80 border-2 border-rose-500/50 shadow-xl shadow-rose-950/40 text-white flex items-center justify-between gap-3 mb-4"
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 flex-shrink-0 animate-bounce">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs sm:text-sm font-black text-rose-200 tracking-wide flex items-center gap-1.5">
            <span>Low Power Alert During Active Transfer!</span>
          </h4>
          <p className="text-[11px] sm:text-xs text-rose-100/90 leading-tight mt-0.5">
            {localLow && remoteLow
              ? 'Both devices are below 20% power. Please plug in immediately to prevent data loss.'
              : localLow
              ? `Your device is at ${localBattery?.level}%. Connect charger to avoid file transfer abort.`
              : `Remote peer is at ${remoteBattery?.level}%. Connect charger to avoid file transfer abort.`}
          </p>
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-800/40 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};
