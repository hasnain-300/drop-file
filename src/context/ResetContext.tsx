import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toast } from 'react-hot-toast';
import { ResetLoadingScreen } from '../components/ResetLoadingScreen';

interface ResetContextType {
  isResetting: boolean;
  triggerReset: () => void;
}

const ResetContext = createContext<ResetContextType>({
  isResetting: false,
  triggerReset: () => {},
});

export function ResetProvider({ children }: { children: ReactNode }) {
  const [isResetting, setIsResetting] = useState(false);
  const [stepMessage, setStepMessage] = useState('Resetting application...');
  const [progress, setProgress] = useState(0);

  // Check if we just completed a reset upon page reload
  useEffect(() => {
    try {
      const wasReloaded = sessionStorage.getItem('fs_reset_reloaded');
      if (wasReloaded === 'true') {
        sessionStorage.removeItem('fs_reset_reloaded');
        setIsResetting(false);
        toast.success('Application reset successfully', {
          id: 'app-reset-success',
          duration: 3000,
        });
      }
    } catch {
      // Ignore sessionStorage access errors
    }
  }, []);

  const triggerReset = useCallback(() => {
    setIsResetting(true);
    setProgress(20);
    setStepMessage('Clearing session data and local cache...');

    // Step 1: Disconnect & clean
    const t1 = setTimeout(() => {
      setProgress(50);
      setStepMessage('Closing peer channels and network relays...');
    }, 280);

    // Step 2: Storage wipe
    const t2 = setTimeout(() => {
      setProgress(80);
      setStepMessage('Restoring default application settings...');
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (err) {
        console.error('Storage clear error:', err);
      }
    }, 600);

    // Step 3: Flag reload and trigger navigation
    const t3 = setTimeout(() => {
      setProgress(100);
      setStepMessage('Reloading Fast Share...');
      try {
        sessionStorage.setItem('fs_reset_reloaded', 'true');
      } catch {
        // Fallback
      }
    }, 900);

    // Final navigation with zero white flash
    const t4 = setTimeout(() => {
      window.location.href = window.location.origin;
    }, 1150);

    // Failsafe: auto-dismiss if window navigation is stalled
    const failsafe = setTimeout(() => {
      setIsResetting(false);
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <ResetContext.Provider value={{ isResetting, triggerReset }}>
      {children}
      <ResetLoadingScreen
        isVisible={isResetting}
        stepMessage={stepMessage}
        progress={progress}
        onDismiss={() => setIsResetting(false)}
      />
    </ResetContext.Provider>
  );
}

export function useReset() {
  return useContext(ResetContext);
}
