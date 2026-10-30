import React, { useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { FileDrop } from '../components/FileDrop';
import { FileQueue, FileQueueItem } from '../components/FileQueue';
import { QueuedFileList } from '../components/QueuedFileList';
import { PeerConnection, PeerSignalQuality } from '../webrtc/peer';
import { FileSender } from '../webrtc/fileSender';
import { SignalStrengthIndicator } from '../components/SignalStrengthIndicator';
import { useLocation } from 'react-router-dom';
import { AlertCircle, RefreshCw, Lock, QrCode, Scan, ShieldCheck, Wifi, WifiOff, Download, Send as SendIcon, Clock, UploadCloud, Files as FilesIcon, Radio, Copy, Power } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';

import { generateEncryptionKey, decryptText, encryptText, deriveKeyFromPin } from '../lib/crypto';
import { addHistoryRecord, updateHistoryRecord } from '../lib/db';
import { networkStatus } from '../lib/networkStatus';
import { TransferRateChart } from '../components/TransferRateChart';
import { useHotspot } from '../context/HotspotContext';

import { motion, AnimatePresence } from 'motion/react';

export function Send() {
  const location = useLocation();
  const { isHotspotActive, hotspotRoomId, hotspotKey, hotspotSsid, directUrl, startHotspot, stopHotspot, setPeerConnectedStatus } = useHotspot();
  const [roomId, setRoomId] = useState<string>('');
  const [encryptionKey, setEncryptionKey] = useState<string>('');
  const [peerConnected, setPeerConnected] = useState(false);
  const [files, setFiles] = useState<FileQueueItem[]>([]);
  const [status, setStatus] = useState<'waiting' | 'connected' | 'error'>('waiting');
  const [connectionDetail, setConnectionDetail] = useState<string>('Waiting for receiver...');
  const [isManualMode, setIsManualMode] = useState(false);
  const [localSdp, setLocalSdp] = useState('');
  const [remoteSdp, setRemoteSdp] = useState('');
  const [manualKey, setManualKey] = useState(() => {
    try {
      return sessionStorage.getItem('fs_hotspot_manual_key') || localStorage.getItem('fs_hotspot_key') || '';
    } catch {
      return '';
    }
  });
  const [isGatheringIce, setIsGatheringIce] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [showQr, setShowQr] = useState(false);
  const [showHotspotQr, setShowHotspotQr] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [transportMode, setTransportMode] = useState<'p2p' | 'relay'>('p2p');
  const [signalQuality, setSignalQuality] = useState<PeerSignalQuality | null>(null);
  const [idleCountdown, setIdleCountdown] = useState<number>(60);
  const [isTransferringActive, setIsTransferringActive] = useState(false);
  const [isPageDragging, setIsPageDragging] = useState(false);
  const pageDragCounter = useRef(0);
  const peerRef = useRef<PeerConnection | null>(null);
  const sendersRef = useRef<Map<number, FileSender>>(new Map());
  const nextFileId = useRef(1);

  const pendingFiles = useMemo(() => files.filter(f => f.status === 'pending'), [files]);
  const activeOrCompletedFiles = useMemo(() => files.filter(f => f.status !== 'pending'), [files]);

  const setupDataChannel = (peer: PeerConnection, channel: any, key?: string) => {
    const sendMessage = async (message: any) => {
      peer.resetActivity();
      
      if (channel.readyState !== 'open') {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Timeout waiting for data channel")), 10000);
          const check = () => {
            if (channel.readyState === 'open') {
              clearTimeout(timeout);
              resolve(null);
            } else if (channel.readyState === 'closed' || channel.readyState === 'closing') {
              clearTimeout(timeout);
              reject(new Error("Data channel closed"));
            } else {
              setTimeout(check, 500);
            }
          };
          check();
        });
      }

      if (key) {
        const encrypted = await encryptText(JSON.stringify(message), key);
        channel.send(JSON.stringify({ type: 'encrypted', payload: encrypted }));
      } else {
        channel.send(JSON.stringify(message));
      }
    };

    peer.sendMessage = sendMessage;

    channel.onmessage = async (event) => {
      peer.resetActivity();
      if (typeof event.data === 'string') {
        try {
          let data = JSON.parse(event.data);
          
          if (data.type === 'ping') {
            if (data.sendTime) {
              peer.sendMessage?.({ type: 'pong', sendTime: data.sendTime }).catch(() => {});
            }
            return;
          }
          if (data.type === 'pong') {
            if (data.sendTime) {
              const rtt = Math.max(1, Date.now() - data.sendTime);
              peer.reportPingRtt(rtt);
            }
            return;
          }

          if (data.type === 'encrypted' && key) {
            const decrypted = await decryptText(data.payload, key);
            data = JSON.parse(decrypted);
          }

          if (data.type === 'cancel') {
            const sender = sendersRef.current.get(data.fileId);
            if (sender) {
              sender.cancel();
              sendersRef.current.delete(data.fileId);
            }
            setFiles(prev => prev.map(f => {
              if (f.id === data.fileId) {
                if (f.dbId) updateHistoryRecord(f.dbId, { status: 'cancelled' });
                return { ...f, status: 'cancelled' };
              }
              return f;
            }));
          } else if (data.type === 'pause') {
            sendersRef.current.get(data.fileId)?.pause();
            setFiles(prev => prev.map(f => f.id === data.fileId ? { ...f, status: 'paused', speed: 0 } : f));
          } else if (data.type === 'resume') {
            sendersRef.current.get(data.fileId)?.resume();
            setFiles(prev => prev.map(f => f.id === data.fileId ? { ...f, status: 'transferring' } : f));
          } else if (data.type === 'disconnect') {
            handleManualDisconnect();
          }
        } catch (e) {
          console.error("Error parsing message", e);
        }
      }
    };
  };

  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('mode') === 'offline') {
      setIsManualMode(true);
    }
  }, [location.search]);

  useEffect(() => {
    setPeerConnectedStatus(peerConnected);
  }, [peerConnected, setPeerConnectedStatus]);

  // Keep manualKey in sync with active hotspotKey
  useEffect(() => {
    if (hotspotKey && hotspotKey !== manualKey) {
      setManualKey(hotspotKey);
      try {
        sessionStorage.setItem('fs_hotspot_manual_key', hotspotKey);
      } catch {}
    }
  }, [hotspotKey, manualKey]);

  useEffect(() => {
    const initRoom = async () => {
      // If hotspot already has an active room, reuse that exact room so WebRTC peer listens on it
      const activeId = (isHotspotActive && hotspotRoomId) ? hotspotRoomId : Math.floor(1000 + Math.random() * 8999).toString();
      const newKey = await deriveKeyFromPin(activeId);
      setRoomId(activeId);
      setEncryptionKey(newKey);

      const peer = new PeerConnection(activeId, true);
      peerRef.current = peer;

      peer.onError = (msg) => {
        toast.error(msg);
      };

      peer.onManualSignal = (signal) => {
        setLocalSdp(signal);
        setIsGatheringIce(false);
      };

      peer.onTransportModeChange = (mode) => {
        setTransportMode(mode);
      };

      peer.onSignalQualityChange = (q) => {
        setSignalQuality(q);
      };

      peer.onInactivityTick = (remaining, transferring) => {
        setIdleCountdown(remaining);
        setIsTransferringActive(transferring);
      };

      peer.onConnectionStateChange = (state) => {
        console.log("Send Peer State:", state);
        networkStatus.reportPeerStatus(state as any);
        if (state === 'connecting') {
          setConnectionDetail('Exchanging signals with receiver...');
        } else if (state === 'connected') {
          setPeerConnected(true);
          setStatus('connected');
          setSignalQuality(peer.getSignalQuality());
          toast.success('Receiver connected!');
          
          // Setup message listener for the data channel
          if (peer.dataChannel) {
            setupDataChannel(peer, peer.dataChannel as any, newKey);
          }
        } else if (state === 'disconnected') {
          setPeerConnected(false);
          setSignalQuality(null);
          setStatus('waiting');
          setConnectionDetail('Connection unstable or disconnected, attempting to reconnect...');
          toast.error('Receiver disconnected. File selection is disabled.');
        } else if (state === 'failed' || state === 'closed') {
          setPeerConnected(false);
          setSignalQuality(null);
          setStatus('error');
          setConnectionDetail('Connection closed');
          toast.error('Connection closed. File selection is disabled.');
        }
      };

      peer.onDataChannel = (channel) => {
        setupDataChannel(peer, channel as any, newKey);
      };

      peer.onDisconnect = (reason) => {
        setPeerConnected(false);
        setStatus('error');
        if (reason === 'inactivity') {
          toast.error('Disconnected due to 1 minute of inactivity.');
        } else {
          toast.error('Session disconnected.');
        }
      };
    };

    initRoom();

    return () => {
      if (peerRef.current) {
        peerRef.current.close();
      }
    };
  }, []);

  const handleManualConnect = async (sdpOverride?: string) => {
    const sdpToUse = sdpOverride || remoteSdp;
    if (!sdpToUse) {
      toast.error("Please paste the answer from the receiver");
      return;
    }
    
    // Update setupDataChannel with manual key if provided
    if (peerRef.current?.dataChannel) {
      setupDataChannel(peerRef.current, peerRef.current.dataChannel as any, manualKey || undefined);
    }

    try {
      await peerRef.current?.setManualSignal(sdpToUse);
      setConnectionDetail('Connecting to receiver...');
    } catch (e) {
      toast.error("Invalid answer string");
    }
  };

  const startManualGathering = () => {
    setIsGatheringIce(true);
    peerRef.current?.createManualOffer();
  };

  const startScanner = () => {
    setShowScanner(true);
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );
      scanner.render((decodedText) => {
        setRemoteSdp(decodedText);
        scanner.clear();
        setShowScanner(false);
        toast.success("Answer string scanned!");
        // Auto-trigger connection
        handleManualConnect(decodedText);
      }, (error) => {
        // console.warn(error);
      });
    }, 100);
  };

  const handleFilesSelect = (selectedFiles: File[]) => {
    if (!peerConnected) {
      toast.error('Connect to a receiver first to select files');
      return;
    }

    peerRef.current?.resetActivity();
    if (!selectedFiles || selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter(f => f && typeof f.name === 'string');
    if (validFiles.length === 0) return;

    const newItems: FileQueueItem[] = validFiles.map(f => ({
      id: nextFileId.current++,
      dbId: uuidv4(),
      name: f.name,
      size: f.size,
      progress: 0,
      speed: 0,
      status: 'pending', // Keep as pending/queued until user clicks transfer
      file: f,
      type: f.type
    }));
    
    setFiles(prev => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} file${newItems.length > 1 ? 's' : ''} to queue`);
  };

  const handleTransferAllQueued = () => {
    if (!peerConnected || !peerRef.current?.dataChannel) {
      toast.error('Please connect to receiver first before transferring');
      return;
    }

    const pendingFiles = files.filter(f => f.status === 'pending' && f.file);
    if (pendingFiles.length === 0) {
      toast.error('No queued files ready to transfer');
      return;
    }

    pendingFiles.forEach(item => {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'transferring' } : f));
      startTransfer(item.file!, item.id, item.dbId!, peerRef.current!.dataChannel!);
    });

    toast.success(`Starting transfer of ${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}`);
  };

  const handleTransferQueuedItem = (id: number) => {
    if (!peerConnected || !peerRef.current?.dataChannel) {
      toast.error('Please connect to receiver first before transferring');
      return;
    }

    const item = files.find(f => f.id === id && f.status === 'pending');
    if (!item || !item.file) return;

    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'transferring' } : f));
    startTransfer(item.file, item.id, item.dbId!, peerRef.current!.dataChannel!);
    toast.success(`Starting transfer for ${item.name}`);
  };

  const handleRemoveQueuedItem = (id: number) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    toast.success('Removed file from queue');
  };

  const handleClearQueued = () => {
    setFiles(prev => prev.filter(f => f.status !== 'pending'));
    toast.success('Cleared queued files');
  };

  const handleClearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status === 'transferring' || f.status === 'pending' || f.status === 'paused'));
    toast.success('Cleared completed transfers');
  };

  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (!peerConnected) return;
      if (e.dataTransfer?.types?.includes('Files')) {
        pageDragCounter.current += 1;
        setIsPageDragging(true);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (!peerConnected) {
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'none';
        }
        return;
      }
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (!peerConnected) {
        pageDragCounter.current = 0;
        setIsPageDragging(false);
        return;
      }
      pageDragCounter.current -= 1;
      if (pageDragCounter.current <= 0) {
        pageDragCounter.current = 0;
        setIsPageDragging(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      pageDragCounter.current = 0;
      setIsPageDragging(false);

      if (!peerConnected) {
        toast.error('Connect to a receiver first to select or drop files');
        return;
      }

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const droppedFiles = Array.from(e.dataTransfer.files) as File[];
        handleFilesSelect(droppedFiles);
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [peerConnected]);

  const startTransfer = async (fileToSend: File, fileId: number, dbId: string, channel: any) => {
    peerRef.current?.setTransferring(true);
    await addHistoryRecord({
      id: dbId,
      fileName: fileToSend.name,
      fileSize: fileToSend.size,
      fileType: fileToSend.type,
      direction: 'sent',
      status: 'failed', // Default to failed, update to completed when done
      timestamp: Date.now(),
    });

    const activeKey = isManualMode ? (manualKey || undefined) : encryptionKey;
    const sender = new FileSender(channel, fileToSend, fileId, activeKey);
    sendersRef.current.set(fileId, sender);

    sender.onProgress = (p, s) => {
      peerRef.current?.resetActivity();
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: p, speed: s } : f));
    };

    sender.onComplete = () => {
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'completed', progress: 100, speed: 0 } : f));
      sendersRef.current.delete(fileId);
      if (sendersRef.current.size === 0) {
        peerRef.current?.setTransferring(false);
      }
      updateHistoryRecord(dbId, { status: 'completed' });
      toast.success(`File sent: ${fileToSend.name}`);
    };

    sender.onError = (err) => {
      console.error(err);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'error' } : f));
      sendersRef.current.delete(fileId);
      if (sendersRef.current.size === 0) {
        peerRef.current?.setTransferring(false);
      }
      updateHistoryRecord(dbId, { status: 'failed' });
      toast.error(`Error sending file: ${fileToSend.name}`);
    };

    sender.start();
  };

  const handleCancel = (id: number) => {
    const sender = sendersRef.current.get(id);
    if (sender) {
      sender.cancel();
      sendersRef.current.delete(id);
      if (sendersRef.current.size === 0) {
        peerRef.current?.setTransferring(false);
      }
    }
    setFiles(prev => prev.map(f => {
      if (f.id === id) {
        if (f.dbId) updateHistoryRecord(f.dbId, { status: 'cancelled' });
        return { ...f, status: 'cancelled' };
      }
      return f;
    }));
  };

  const handleRetry = (id: number) => {
    const fileItem = files.find(f => f.id === id);
    if (fileItem && fileItem.file && peerConnected && peerRef.current?.dataChannel) {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'transferring', progress: 0, speed: 0 } : f));
      startTransfer(fileItem.file, id, fileItem.dbId!, peerRef.current.dataChannel);
    }
  };

  const handlePause = (id: number) => {
    const sender = sendersRef.current.get(id);
    if (sender) {
      sender.pause();
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'paused', speed: 0 } : f));
    }
  };

  const handleResume = (id: number) => {
    const sender = sendersRef.current.get(id);
    if (sender) {
      sender.resume();
      setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'transferring' } : f));
    }
  };

  const handleManualDisconnect = () => {
    if (peerRef.current && !isDisconnecting) {
      setIsDisconnecting(true);
      console.log("Initiating manual disconnect...");
      // Try to notify the other peer before closing
      peerRef.current.sendMessage?.({ type: 'disconnect' }).catch(() => {});
      setTimeout(() => {
        peerRef.current?.close();
        setPeerConnected(false);
        setStatus('waiting');
        toast.success('Disconnected successfully');
        // Reload page to reset state completely
        window.location.reload();
      }, 200); // Slightly longer delay to ensure message is sent
    }
  };


  // Reset activity on user interaction
  useEffect(() => {
    const handleUserActivity = () => {
      if (peerConnected) {
        peerRef.current?.resetActivity();
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('touchstart', handleUserActivity);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
    };
  }, [peerConnected]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto p-4 sm:p-6"
    >
      <div className="text-center mb-10 sm:mb-14">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-block p-4 bg-blue-100 dark:bg-blue-900/30 rounded-3xl mb-6 shadow-xl shadow-blue-500/10"
        >
          <SendIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </motion.div>
        <h1 className="text-4xl sm:text-6xl font-black text-gray-900 dark:text-white mb-6 tracking-tighter">Send Files</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-lg mx-auto leading-relaxed font-medium text-lg">Securely share files directly with another device. Your data never touches any server.</p>
        
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <div className="inline-flex items-center space-x-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-green-200 dark:border-green-800/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>End-to-End Encrypted</span>
          </div>
          <div className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${isOnline ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30'}`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Online Mode Available' : 'Offline Mode Only'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-8 lg:sticky lg:top-24">
          <motion.div 
            layout
            className="glass rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/30 overflow-hidden"
          >
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-8 flex items-center space-x-4">
                <span className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-sm font-black shadow-xl shadow-blue-500/30">1</span>
                <span>Connection Setup</span>
              </h2>
              
              <div className="inline-flex p-1.5 bg-gray-100/50 dark:bg-gray-900/50 rounded-[1.5rem] border border-gray-200/50 dark:border-gray-700/50 w-full mb-10">
                <button
                  onClick={() => setIsManualMode(false)}
                  className={`flex-1 py-3.5 rounded-2xl text-sm font-black transition-all duration-300 ${!isManualMode ? 'bg-white dark:bg-gray-700 shadow-xl text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  Online Mode
                </button>
                <button
                  onClick={() => setIsManualMode(true)}
                  className={`flex-1 py-3.5 rounded-2xl text-sm font-black transition-all duration-300 ${isManualMode ? 'bg-white dark:bg-gray-700 shadow-xl text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  Offline Mode
                </button>
              </div>

              <AnimatePresence mode="wait">
                {!isManualMode ? (
                  <motion.div
                    key="online"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {roomId ? (
                      <div className="text-center">
                        {!isOnline && (
                          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs rounded-2xl border border-amber-200 dark:border-amber-800/30 flex items-center space-x-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>You are currently offline. Please switch to "Offline Mode" or check your internet connection.</span>
                          </div>
                        )}
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-4">Share this code with receiver</p>
                        <div className="text-5xl sm:text-7xl font-mono font-black text-blue-600 dark:text-blue-400 tracking-[0.2em] py-10 bg-blue-50/50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 shadow-inner">
                          {roomId}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-48 bg-gray-100/50 dark:bg-gray-800/50 animate-pulse rounded-3xl"></div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="manual"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {!isHotspotActive ? (
                      <div className="space-y-5">
                        {/* Secret Key Input - Strictly Required */}
                        <div className="bg-gray-50/50 dark:bg-gray-900/30 p-5 sm:p-6 rounded-2xl border border-blue-200 dark:border-blue-900/40">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
                              Secret Key <span className="text-rose-500 font-bold">*Required</span>
                            </label>
                            <span className="text-[11px] font-semibold text-blue-500">Required for pairing</span>
                          </div>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500" />
                            <input
                              type="text"
                              value={manualKey}
                              onChange={(e) => {
                                const val = e.target.value;
                                setManualKey(val);
                                try {
                                  sessionStorage.setItem('fs_hotspot_manual_key', val);
                                  localStorage.setItem('fs_hotspot_key', val);
                                } catch {}
                              }}
                              placeholder="Create a Secret Key (e.g. 1234 or fast@pass)"
                              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-mono font-bold"
                            />
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                            The receiver connected to your hotspot only needs this Secret Key to pair devices.
                          </p>
                        </div>

                        {/* Turn on Hotspot Network */}
                        <div className="p-5 sm:p-6 bg-gradient-to-br from-blue-950/40 via-slate-900/60 to-indigo-950/40 rounded-3xl border border-blue-500/30 shadow-xl space-y-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2.5 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              <Radio className="w-5 h-5 animate-pulse" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-bold text-white">Local Hotspot Network</h4>
                              <p className="text-xs text-gray-400">Broadcast connection signal across hotspot for automatic receiver pairing</p>
                            </div>
                          </div>

                          <motion.button
                            whileHover={manualKey.trim() ? { scale: 1.01 } : {}}
                            whileTap={manualKey.trim() ? { scale: 0.98 } : {}}
                            onClick={() => {
                              const keyToUse = manualKey.trim() || hotspotKey || (typeof window !== 'undefined' ? (sessionStorage.getItem('fs_hotspot_manual_key') || localStorage.getItem('fs_hotspot_key') || '') : '');
                              if (!keyToUse) {
                                toast.error('Secret Key is required! Please enter a Secret Key above.');
                                return;
                              }
                              setManualKey(keyToUse);
                              try {
                                sessionStorage.setItem('fs_hotspot_manual_key', keyToUse);
                                localStorage.setItem('fs_hotspot_key', keyToUse);
                              } catch {}
                              startHotspot(roomId, keyToUse);
                            }}
                            className={`w-full py-4 text-white rounded-2xl text-sm font-black transition-all flex items-center justify-center space-x-2.5 ${
                              manualKey.trim()
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-500/30 active:scale-95 cursor-pointer'
                                : 'bg-gray-400 dark:bg-gray-800 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <Wifi className="w-4 h-4" />
                            <span>Turn On Hotspot Network</span>
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 sm:p-6 bg-gradient-to-br from-blue-950/50 via-slate-900/80 to-indigo-950/50 rounded-3xl border-2 border-blue-500/40 shadow-2xl shadow-blue-950/50 space-y-4 sm:space-y-5">
                        {/* Active Connection Signal Header - Mobile Optimized */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-gray-800/80">
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="relative flex items-center justify-center flex-shrink-0">
                              <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-40" />
                              <div className="relative w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/40">
                                <Radio className="w-5 h-5 animate-pulse" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                                  Connection Signal Active
                                </h4>
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/40 animate-pulse flex-shrink-0">
                                  BROADCASTING
                                </span>
                              </div>
                              <p className="text-xs text-blue-200/80 font-mono mt-0.5 truncate">
                                Network: <strong className="text-white font-semibold">{hotspotSsid}</strong>
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={stopHotspot}
                            className="self-end sm:self-auto px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white text-xs font-bold transition-all border border-rose-500/30 flex items-center space-x-1.5 flex-shrink-0 active:scale-95"
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span>Turn Off</span>
                          </button>
                        </div>

                        {/* Automatic pairing guidance */}
                        <div className="p-3.5 sm:p-4 bg-slate-950/70 rounded-2xl border border-blue-500/20 text-xs text-gray-300 space-y-2">
                          <div className="flex items-center space-x-2 text-blue-400 font-bold">
                            <Wifi className="w-4 h-4 animate-pulse" />
                            <span>Signal Open on Hotspot Network</span>
                          </div>
                          <p className="text-gray-300 text-xs leading-relaxed">
                            When receiver connects to your hotspot Wi-Fi and opens Fast Share, this connection signal will <strong>automatically appear</strong> on their device. They only need to enter your Secret Key below.
                          </p>
                        </div>

                        {/* Required Secret Key Highlight */}
                        {(() => {
                          const effectiveKey = manualKey || hotspotKey || (typeof window !== 'undefined' ? (sessionStorage.getItem('fs_hotspot_manual_key') || localStorage.getItem('fs_hotspot_key') || '') : '');
                          return (
                            <div className="p-4 bg-blue-950/60 border border-blue-500/40 rounded-2xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                                  <span>Secret Key for Receiver</span>
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                                  REQUIRED
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3 bg-slate-950/90 border border-blue-500/30 px-4 py-3.5 rounded-xl">
                                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                  <span className="font-mono text-base sm:text-xl font-black text-white tracking-widest break-all select-all">
                                    {effectiveKey || 'No Key Configured'}
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    if (effectiveKey) {
                                      navigator.clipboard.writeText(effectiveKey);
                                      toast.success('Secret Key copied!');
                                    } else {
                                      toast.error('No Secret Key available to copy');
                                    }
                                  }}
                                  className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all active:scale-95 shadow-md shadow-blue-600/30 flex-shrink-0 cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy Key</span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
          
          <div className="flex flex-col items-center space-y-3 w-full px-4">
            <div className="flex flex-wrap items-center justify-center gap-2 bg-white/50 dark:bg-gray-800/50 px-5 py-2.5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${peerConnected ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                {peerConnected ? (
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-500 animate-ping"></div>
                ) : (
                  <div className="absolute inset-0 w-3 h-3 rounded-full bg-amber-500 animate-pulse"></div>
                )}
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                {peerConnected ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span>Receiver Connected</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold">
                      {transportMode === 'p2p' ? 'Direct P2P' : 'Hotspot/Relay'}
                    </span>
                    <SignalStrengthIndicator
                      quality={signalQuality}
                      isTransferring={isTransferringActive}
                      variant="compact"
                    />
                  </span>
                ) : connectionDetail}
              </span>
            </div>

            {peerConnected && (
              <div className="flex items-center space-x-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 px-3.5 py-1.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span>
                  {isTransferringActive
                    ? 'Transferring files (Active)'
                    : `Auto-disconnect if idle: ${idleCountdown}s`}
                </span>
              </div>
            )}
            
            {peerConnected && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleManualDisconnect}
                className="px-6 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-all border border-red-100 dark:border-red-900/30"
              >
                Disconnect Session
              </motion.button>
            )}
          </div>

          {status === 'error' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-3xl p-8 text-center w-full shadow-xl shadow-red-500/5"
            >
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-red-900 dark:text-red-100 mb-2">Connection Error</h3>
              <p className="text-red-700/70 dark:text-red-300/70 text-sm mb-8 leading-relaxed max-w-xs mx-auto">The peer connection was lost or failed. Please check your network and try again.</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  window.location.hash = '';
                  window.location.reload();
                }}
                className="px-8 py-3.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl text-sm font-bold transition-all shadow-xl shadow-gray-900/10 dark:shadow-white/10 flex items-center space-x-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Restart Connection</span>
              </motion.button>
            </motion.div>
          )}
        </div>

        <div className="lg:col-span-7 space-y-8">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
              <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center space-x-4">
                <span className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-sm font-black shadow-xl shadow-blue-500/30">2</span>
                <span>Select Files</span>
              </h2>
              {peerConnected ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/40 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span>Unlocked & Ready</span>
                  </span>
                  <SignalStrengthIndicator
                    quality={signalQuality}
                    isTransferring={isTransferringActive}
                    variant="badge"
                  />
                </div>
              ) : (
                <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 shadow-sm">
                  <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Disabled until connected</span>
                </span>
              )}
            </div>
            
            <div className="space-y-6">
              <FileDrop 
                onFilesSelect={handleFilesSelect} 
                peerConnected={peerConnected} 
                disabled={!peerConnected}
                queueCount={pendingFiles.length}
              />
              
              <AnimatePresence>
                {pendingFiles.length > 0 && (
                  <QueuedFileList
                    files={files}
                    onTransferAll={handleTransferAllQueued}
                    onTransferItem={handleTransferQueuedItem}
                    onRemoveItem={handleRemoveQueuedItem}
                    onClearQueue={handleClearQueued}
                    peerConnected={peerConnected}
                  />
                )}
              </AnimatePresence>

              <AnimatePresence>
                {activeOrCompletedFiles.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <FileQueue 
                      files={activeOrCompletedFiles} 
                      title="Transfer Status & History"
                      onCancel={handleCancel} 
                      onRetry={handleRetry} 
                      onPause={handlePause} 
                      onResume={handleResume} 
                      onClearCompleted={handleClearCompleted}
                      signalQuality={signalQuality}
                      isTransferring={isTransferringActive}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showScanner && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowScanner(false)}
                className="fixed inset-0 bg-black/90 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl z-[101]"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Scan Answer QR</h3>
                  <button 
                    onClick={() => setShowScanner(false)} 
                    className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div id="qr-reader" className="overflow-hidden rounded-3xl border-4 border-gray-100 dark:border-gray-800 shadow-inner"></div>
                <p className="text-center text-xs text-gray-600 mt-6 font-medium">Point your camera at the receiver's QR code</p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isPageDragging && peerConnected && (
            <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-blue-950/70 dark:bg-black/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="relative max-w-lg w-full p-8 sm:p-12 rounded-[2.5rem] bg-white dark:bg-gray-900 border-4 border-dashed border-blue-500 shadow-2xl text-center flex flex-col items-center z-10"
              >
                <div className="w-24 h-24 rounded-3xl bg-blue-600 text-white flex items-center justify-center shadow-2xl shadow-blue-500/50 mb-6 animate-bounce">
                  <UploadCloud className="w-12 h-12" />
                </div>
                <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
                  Drop Files to Send
                </h3>
                <p className="text-base font-medium text-gray-600 dark:text-gray-300 leading-relaxed mb-6 max-w-sm">
                  Release anywhere to add multiple files directly into your transfer queue.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                    Multiple files supported
                  </span>
                  {peerConnected ? (
                    <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800/50">
                      ⚡ Review in queue & transfer
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                      ⏳ Queues until receiver connects
                    </span>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}
