import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface HotspotContextType {
  isHotspotActive: boolean;
  hotspotRoomId: string;
  hotspotKey: string;
  hotspotRole: 'sender' | 'receiver' | null;
  hotspotSsid: string;
  directUrl: string;
  isPeerConnected: boolean;
  detectedSignal: { roomId: string; ssid: string } | null;
  startHotspot: (roomId: string, secretKey: string) => void;
  stopHotspot: () => void;
  setPeerConnectedStatus: (connected: boolean) => void;
  registerReceiverHotspot: (roomId: string, secretKey?: string) => void;
}

const HotspotContext = createContext<HotspotContextType>({
  isHotspotActive: false,
  hotspotRoomId: '',
  hotspotKey: '',
  hotspotRole: null,
  hotspotSsid: '',
  directUrl: '',
  isPeerConnected: false,
  detectedSignal: null,
  startHotspot: () => {},
  stopHotspot: () => {},
  setPeerConnectedStatus: () => {},
  registerReceiverHotspot: () => {},
});

export function HotspotProvider({ children }: { children: ReactNode }) {
  const [isHotspotActive, setIsHotspotActive] = useState(false);
  const [hotspotRoomId, setHotspotRoomId] = useState('');
  const [hotspotKey, setHotspotKey] = useState('');
  const [hotspotRole, setHotspotRole] = useState<'sender' | 'receiver' | null>(null);
  const [hotspotSsid, setHotspotSsid] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const [detectedSignal, setDetectedSignal] = useState<{ roomId: string; ssid: string } | null>(null);

  // Restore hotspot session from sessionStorage and localStorage on load
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('fs_hotspot_session');
      const backupKey = localStorage.getItem('fs_hotspot_key') || '';
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.active && parsed.roomId) {
          setIsHotspotActive(true);
          setHotspotRoomId(parsed.roomId);
          setHotspotKey(parsed.key || backupKey);
          setHotspotRole(parsed.role || 'sender');
          setHotspotSsid(parsed.ssid || `FastShare-Direct-${parsed.roomId}`);
          setDirectUrl(parsed.url || '');
        }
      } else if (backupKey) {
        setHotspotKey(backupKey);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }, []);

  // Poll for active network hotspot signals (enables instant zero-config receiver discovery)
  useEffect(() => {
    let isMounted = true;
    const checkActiveSignal = async () => {
      try {
        const res = await fetch('/api/hotspot/active');
        if (res.ok) {
          const data = await res.json();
          if (!isMounted) return;
          if (data.active && data.signal) {
            setDetectedSignal({ roomId: data.signal.roomId, ssid: data.signal.ssid });
          } else {
            setDetectedSignal(null);
          }
        }
      } catch (err) {
        // Ignore network errors in offline/poll
      }
    };

    checkActiveSignal();
    const interval = setInterval(checkActiveSignal, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const startHotspot = useCallback((roomId: string, secretKey: string) => {
    const origin = window.location.origin;
    const url = `${origin}/receive?hotspot=1&room=${roomId}&key=${encodeURIComponent(secretKey)}`;
    const ssid = `FastShare-Direct-${roomId}`;

    setIsHotspotActive(true);
    setHotspotRoomId(roomId);
    setHotspotKey(secretKey);
    setHotspotRole('sender');
    setHotspotSsid(ssid);
    setDirectUrl(url);

    // Broadcast signal to local network server
    fetch('/api/hotspot/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, ssid }),
    }).catch(() => {});

    try {
      localStorage.setItem('fs_hotspot_key', secretKey);
      sessionStorage.setItem(
        'fs_hotspot_session',
        JSON.stringify({
          active: true,
          roomId,
          key: secretKey,
          role: 'sender',
          ssid,
          url,
        })
      );
    } catch {}

    toast.success('Hotspot Network Signal activated!', {
      icon: '📡',
      duration: 3500,
    });
  }, []);

  const registerReceiverHotspot = useCallback((roomId: string, secretKey: string = '') => {
    setIsHotspotActive(true);
    setHotspotRoomId(roomId);
    setHotspotKey(secretKey);
    setHotspotRole('receiver');
    setHotspotSsid(`FastShare-Direct-${roomId}`);

    try {
      if (secretKey) {
        localStorage.setItem('fs_hotspot_key', secretKey);
      }
      sessionStorage.setItem(
        'fs_hotspot_session',
        JSON.stringify({
          active: true,
          roomId,
          key: secretKey,
          role: 'receiver',
          ssid: `FastShare-Direct-${roomId}`,
        })
      );
    } catch {}
  }, []);

  const stopHotspot = useCallback(() => {
    setIsHotspotActive(false);
    setHotspotRoomId('');
    setHotspotKey('');
    setHotspotRole(null);
    setHotspotSsid('');
    setDirectUrl('');
    setIsPeerConnected(false);

    // Stop signal on local server
    fetch('/api/hotspot/stop', { method: 'POST' }).catch(() => {});

    try {
      sessionStorage.removeItem('fs_hotspot_session');
      localStorage.removeItem('fs_hotspot_key');
    } catch {}

    toast('Hotspot Network turned off', {
      icon: '📴',
    });
  }, []);

  const setPeerConnectedStatus = useCallback((connected: boolean) => {
    setIsPeerConnected(connected);
  }, []);

  return (
    <HotspotContext.Provider
      value={{
        isHotspotActive,
        hotspotRoomId,
        hotspotKey,
        hotspotRole,
        hotspotSsid,
        directUrl,
        isPeerConnected,
        detectedSignal,
        startHotspot,
        stopHotspot,
        setPeerConnectedStatus,
        registerReceiverHotspot,
      }}
    >
      {children}
    </HotspotContext.Provider>
  );
}

export function useHotspot() {
  return useContext(HotspotContext);
}
