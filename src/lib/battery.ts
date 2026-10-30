/**
 * Battery Status Utilities & Web Battery API integration
 * Supports reading local battery status via navigator.getBattery()
 * and manages peer battery exchange during P2P file transfers.
 */

export interface PeerBatteryState {
  level: number; // 0 to 100 percentage
  charging: boolean;
  chargingTime: number | null; // in seconds until full
  dischargingTime: number | null; // in seconds until empty
  supported: boolean;
  lastUpdated: number;
}

export async function getBatteryManager(): Promise<any | null> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }
  if ('getBattery' in navigator && typeof (navigator as any).getBattery === 'function') {
    try {
      const bm = await (navigator as any).getBattery();
      return bm;
    } catch (err) {
      console.warn('[Battery] navigator.getBattery() access error or restricted:', err);
      return null;
    }
  }
  return null;
}

export function subscribeLocalBattery(
  onChange: (state: PeerBatteryState) => void
): () => void {
  let active = true;
  let cleanupEvents: (() => void) | null = null;

  getBatteryManager().then((bm) => {
    if (!active) return;
    
    if (!bm) {
      // Browser does not support Web Battery API (e.g., Safari / iOS or Firefox)
      onChange({
        level: 100,
        charging: true,
        chargingTime: null,
        dischargingTime: null,
        supported: false,
        lastUpdated: Date.now()
      });
      return;
    }

    const update = () => {
      if (!active) return;
      const rawLevel = typeof bm.level === 'number' ? bm.level : 1;
      const levelPct = Math.round(rawLevel * 100);
      
      onChange({
        level: Math.min(100, Math.max(0, levelPct)),
        charging: Boolean(bm.charging),
        chargingTime: typeof bm.chargingTime === 'number' && isFinite(bm.chargingTime) && bm.chargingTime > 0 ? bm.chargingTime : null,
        dischargingTime: typeof bm.dischargingTime === 'number' && isFinite(bm.dischargingTime) && bm.dischargingTime > 0 ? bm.dischargingTime : null,
        supported: true,
        lastUpdated: Date.now()
      });
    };

    // Immediate initial measurement
    update();

    const handlers: Record<string, () => void> = {
      levelchange: update,
      chargingchange: update,
      chargingtimechange: update,
      dischargingtimechange: update
    };

    Object.entries(handlers).forEach(([evt, handler]) => {
      try {
        bm.addEventListener(evt, handler);
      } catch (e) {}
    });

    cleanupEvents = () => {
      Object.entries(handlers).forEach(([evt, handler]) => {
        try {
          bm.removeEventListener(evt, handler);
        } catch (e) {}
      });
    };
  });

  return () => {
    active = false;
    cleanupEvents?.();
  };
}

/**
 * Format remaining battery seconds to friendly string (e.g. "1h 24m")
 */
export function formatBatteryDuration(seconds: number | null | undefined): string | null {
  if (!seconds || !isFinite(seconds) || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Determines whether a peer's battery state is at critical/warning level (< 20% and not charging)
 */
export function isLowBattery(battery: PeerBatteryState | null | undefined): boolean {
  if (!battery || !battery.supported) return false;
  return battery.level <= 20 && !battery.charging;
}
