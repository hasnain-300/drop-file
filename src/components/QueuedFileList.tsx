import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Trash2, 
  X, 
  Layers, 
  ArrowRight, 
  HardDrive, 
  Tag, 
  Wifi, 
  WifiOff, 
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { FileQueueItem } from './FileQueue';
import { getFileIconInfo } from '../lib/icons';
import { formatBytes, getFileTypeInfo } from '../lib/fileFormatters';

interface QueuedFileListProps {
  files: FileQueueItem[];
  onTransferAll: () => void;
  onTransferItem?: (id: number) => void;
  onRemoveItem: (id: number) => void;
  onClearQueue: () => void;
  peerConnected: boolean;
  disabled?: boolean;
}

function QueuedFileThumbnail({ file, name, type }: { file?: File; name: string; type?: string }) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const isImage = type?.startsWith('image/') || name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);

  React.useEffect(() => {
    if (!isImage || !file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, name, type, isImage]);

  if (previewUrl && isImage) {
    return (
      <div className="relative w-11 h-11 flex-shrink-0 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shadow-sm">
        <img 
          src={previewUrl} 
          alt={name} 
          className="w-full h-full object-cover" 
        />
      </div>
    );
  }

  const { icon: Icon, color, bg } = getFileIconInfo(name, type);
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border border-gray-200/60 dark:border-gray-700/60 ${bg} shadow-sm`}>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
  );
}

export function QueuedFileList({
  files,
  onTransferAll,
  onTransferItem,
  onRemoveItem,
  onClearQueue,
  peerConnected,
  disabled = false
}: QueuedFileListProps) {
  const queuedFiles = useMemo(() => {
    return files.filter(f => f.status === 'pending');
  }, [files]);

  const totalSize = useMemo(() => {
    return queuedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  }, [queuedFiles]);

  if (queuedFiles.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full bg-white dark:bg-gray-800/90 rounded-3xl p-5 sm:p-6 border border-gray-200/80 dark:border-gray-700/80 shadow-xl space-y-5"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-700/60 gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200/60 dark:border-blue-800/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                Queued Files
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                {queuedFiles.length} {queuedFiles.length === 1 ? 'file' : 'files'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Ready to send • Review file details before transferring
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 self-end sm:self-auto">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300 text-xs font-bold border border-gray-200/60 dark:border-gray-600/40">
            <HardDrive className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span>Total: {formatBytes(totalSize)}</span>
          </div>

          <button
            onClick={onClearQueue}
            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all border border-transparent hover:border-red-200 dark:hover:border-red-900/30"
            title="Clear all queued files"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {queuedFiles.map((item, index) => {
            const typeInfo = getFileTypeInfo(item.name, item.type);
            const sizeShare = totalSize > 0 ? Math.round((item.size / totalSize) * 100) : 0;

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="group relative flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-gray-50/70 dark:bg-gray-900/40 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 border border-gray-200/70 dark:border-gray-700/50 hover:border-blue-200 dark:hover:border-blue-800/40 transition-all gap-3"
              >
                {/* Left: Thumbnail & Name */}
                <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 w-4 text-center select-none hidden sm:inline-block">
                    {index + 1}
                  </span>
                  
                  <QueuedFileThumbnail file={item.file} name={item.name} type={item.type} />

                  <div className="flex flex-col min-w-0 flex-1">
                    <span 
                      className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        {formatBytes(item.size)}
                      </span>
                      {queuedFiles.length > 1 && (
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          ({sizeShare}%)
                        </span>
                      )}
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <span className="truncate max-w-[140px] text-[11px] font-mono text-gray-400 dark:text-gray-500">
                        {item.type || typeInfo.mimeType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Type Badge & Action Buttons */}
                <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/50 dark:border-gray-800/50">
                  {/* Type Badge */}
                  <div className="flex items-center space-x-1.5">
                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${typeInfo.badgeBg} ${typeInfo.badgeText} ${typeInfo.badgeBorder}`}>
                      <Tag className="w-3 h-3 opacity-70" />
                      <span>{typeInfo.label}</span>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1.5">
                    {onTransferItem && peerConnected && (
                      <button
                        onClick={() => onTransferItem(item.id)}
                        disabled={disabled}
                        className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl text-xs font-bold text-blue-600 hover:text-white dark:text-blue-400 hover:bg-blue-600 dark:hover:bg-blue-500 transition-all border border-blue-200 dark:border-blue-800/50 hover:border-transparent flex items-center space-x-1"
                        title={`Send ${item.name} now`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Send</span>
                      </button>
                    )}

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Transfer Action Footer */}
      <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60">
        {peerConnected ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-green-600 dark:text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span>Receiver is connected and ready to receive</span>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onTransferAll}
              disabled={disabled}
              className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-blue-500/25 flex items-center justify-center space-x-2.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>
                Transfer All ({queuedFiles.length} {queuedFiles.length === 1 ? 'file' : 'files'} • {formatBytes(totalSize)})
              </span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </motion.button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-900/20 border border-amber-200/80 dark:border-amber-800/40">
            <div className="flex items-center space-x-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>Connect with receiver in Step 1 to enable transfer</span>
            </div>

            <button
              disabled
              className="w-full sm:w-auto px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Waiting for Connection</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
