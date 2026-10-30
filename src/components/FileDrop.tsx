import React, { useCallback, useState, useRef } from 'react';
import { UploadCloud, Files, Plus, ArrowUpCircle, CheckCircle2, Lock, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';

interface FileDropProps {
  onFilesSelect: (files: File[]) => void;
  disabled?: boolean;
  peerConnected?: boolean;
  queueCount?: number;
}

export function FileDrop({ onFilesSelect, disabled = false, peerConnected = false, queueCount = 0 }: FileDropProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSelectionDisabled = disabled || !peerConnected;

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSelectionDisabled) {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none';
      }
      return;
    }

    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, [isSelectionDisabled]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSelectionDisabled) {
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'none';
      }
      return;
    }

    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (!isDragging) {
      setIsDragging(true);
    }
  }, [isSelectionDisabled, isDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSelectionDisabled) {
      dragCounter.current = 0;
      setIsDragging(false);
      return;
    }
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  }, [isSelectionDisabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (isSelectionDisabled) {
      toast.error('Connect to a receiver first to select or drop files');
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesArray = Array.from(e.dataTransfer.files) as File[];
      onFilesSelect(filesArray);
    }
  }, [isSelectionDisabled, onFilesSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSelectionDisabled) {
      toast.error('Connect to a receiver first to select files');
      e.target.value = '';
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files) as File[];
      onFilesSelect(filesArray);
    }
    // Reset input to allow selecting the same file again if desired
    e.target.value = '';
  }, [isSelectionDisabled, onFilesSelect]);

  const openFilePicker = () => {
    if (isSelectionDisabled) {
      toast.error('Connect to a receiver first to select files');
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  };

  return (
    <div
      role="button"
      tabIndex={isSelectionDisabled ? -1 : 0}
      aria-disabled={isSelectionDisabled}
      onKeyDown={handleKeyDown}
      onClick={openFilePicker}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative group overflow-hidden rounded-3xl border-2 transition-all duration-300 select-none outline-none
        ${isSelectionDisabled 
          ? 'cursor-not-allowed bg-gray-50/70 dark:bg-gray-900/40 border-dashed border-gray-300/80 dark:border-gray-700/80 hover:border-amber-400/60 dark:hover:border-amber-500/50' 
          : 'cursor-pointer border-dashed'
        }
        ${!isSelectionDisabled && isDragging 
          ? 'border-blue-500 dark:border-blue-400 bg-blue-500/10 dark:bg-blue-500/15 scale-[1.01] shadow-2xl shadow-blue-500/20 ring-4 ring-blue-500/20' 
          : !isSelectionDisabled ? 'border-gray-300/80 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500/70 bg-gradient-to-b from-white/80 to-gray-50/40 dark:from-gray-800/60 dark:to-gray-900/40 hover:shadow-xl hover:shadow-blue-500/5' : ''
        }
        ${queueCount > 0 ? 'p-6 sm:p-8' : 'p-8 sm:p-12'}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        id="file-upload"
        className="hidden"
        multiple
        onChange={handleFileInput}
        disabled={isSelectionDisabled}
      />

      <AnimatePresence>
        {!isSelectionDisabled && isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-blue-600/10 dark:bg-blue-500/20 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8, y: 10 }}
              animate={{ scale: 1.1, y: 0 }}
              exit={{ scale: 0.8, y: 10 }}
              transition={{ type: 'spring', damping: 15 }}
              className="flex flex-col items-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-500/40 mb-3 animate-bounce">
                <ArrowUpCircle className="w-9 h-9" />
              </div>
              <p className="text-lg font-black text-blue-600 dark:text-blue-400">
                Drop files here to add to queue
              </p>
              <p className="text-xs font-semibold text-blue-700/80 dark:text-blue-300/80 mt-1">
                Release mouse to drop multiple files
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col items-center text-center space-y-4">
        {isSelectionDisabled ? (
          /* Locked / Disabled State View */
          <>
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm transition-transform duration-300 group-hover:scale-105">
                <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500/80 dark:text-amber-400/80" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl sm:text-2xl font-black text-gray-700 dark:text-gray-200 tracking-tight flex items-center justify-center gap-2">
                <span>File Selection Disabled</span>
              </h3>
              <p className="text-sm sm:text-base font-medium text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Connect with receiver first in <span className="font-bold text-gray-700 dark:text-gray-300">Step 1</span> to unlock file selection and drag & drop.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
                <Lock className="w-3.5 h-3.5" />
                <span>Locked until connected</span>
              </span>
              <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60">
                Disables on disconnect
              </span>
            </div>
          </>
        ) : (
          /* Active / Connected State View */
          <>
            <div className="relative">
              <motion.div
                whileHover={{ scale: 1.08, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center transition-all duration-300 shadow-xl ${
                  isDragging
                    ? 'bg-blue-600 text-white shadow-blue-500/40'
                    : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white shadow-blue-500/10'
                }`}
              >
                {queueCount > 0 ? (
                  <Files className="w-8 h-8 sm:w-10 sm:h-10 transition-transform group-hover:scale-110" />
                ) : (
                  <UploadCloud className="w-8 h-8 sm:w-10 sm:h-10 transition-transform group-hover:scale-110" />
                )}
              </motion.div>

              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md">
                <Plus className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                {queueCount > 0 ? 'Drag & drop more files' : 'Drag & drop files here'}
              </h3>
              <p className="mt-1.5 text-sm sm:text-base font-medium text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                or <span className="text-blue-600 dark:text-blue-400 font-semibold underline underline-offset-4 group-hover:text-blue-700 dark:group-hover:text-blue-300">browse from your device</span>
              </p>
            </div>

            {/* Badges / Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/40">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                <span>Receiver Connected</span>
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                Multiple files supported
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700/60">
                No size limit
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
