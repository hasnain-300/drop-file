import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface InstallContextType {
  isInstalled: boolean;
  canInstall: boolean;
  showInstallModal: boolean;
  showInstallBanner: boolean;
  isIOS: boolean;
  handleInstall: () => Promise<void>;
  dismissModal: () => void;
  dismissBanner: () => void;
  markAsInstalled: () => void;
}

const InstallContext = createContext<InstallContextType>({
  isInstalled: false,
  canInstall: false,
  showInstallModal: false,
  showInstallBanner: false,
  isIOS: false,
  handleInstall: async () => {},
  dismissModal: () => {},
  dismissBanner: () => {},
  markAsInstalled: () => {},
});

export function InstallProvider({ children }: { children: ReactNode }) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  // Check device and IP installation state
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    setIsIOS(isIosDevice);

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as any).standalone) ||
      document.referrer.includes('android-app://');

    const localInstalled = localStorage.getItem('fs_app_installed') === 'true';

    if (isStandalone || localInstalled) {
      setIsInstalled(true);
      return;
    }

    // Check with server if this IP is registered as installed
    fetch('/api/installation-status')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.isInstalled) {
          setIsInstalled(true);
          localStorage.setItem('fs_app_installed', 'true');
        } else {
          // If not installed on this device or IP
          const alreadyPrompted = localStorage.getItem('fs_first_visit_prompted') === 'true';
          if (!alreadyPrompted) {
            // First time visit -> Show professional alert modal
            setShowInstallModal(true);
          } else {
            // Already visited before but not installed -> Show persistent banner under navbar
            setShowInstallBanner(true);
          }
        }
      })
      .catch(() => {
        const alreadyPrompted = localStorage.getItem('fs_first_visit_prompted') === 'true';
        if (!alreadyPrompted) {
          setShowInstallModal(true);
        } else {
          setShowInstallBanner(true);
        }
      });

    // PWA beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    // App installed event
    const handleAppInstalled = () => {
      markAsInstalled();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const markAsInstalled = useCallback(() => {
    setIsInstalled(true);
    setShowInstallModal(false);
    setShowInstallBanner(false);
    localStorage.setItem('fs_app_installed', 'true');

    // Notify backend about this IP
    fetch('/api/mark-installed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installed: true }),
    }).catch(() => {});

    toast.success('Fast Share successfully installed on your device!', {
      id: 'install-success',
      icon: '🚀',
    });
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          markAsInstalled();
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.error('Install prompt error:', err);
      }
    } else if (isIOS) {
      toast(
        (t) => (
          <div className="text-left text-xs space-y-1">
            <p className="font-bold">To install on iOS Safari:</p>
            <p>1. Tap the <strong>Share</strong> button at bottom.</p>
            <p>2. Select <strong>"Add to Home Screen"</strong>.</p>
          </div>
        ),
        { duration: 6000, icon: '📱' }
      );
    } else {
      // Manual desktop / android fallback guide
      toast('Click your browser menu (⋮ or ⊕) and select "Install Fast Share"', {
        icon: '💻',
        duration: 5000,
      });
      // Allow marking as completed if user confirms
      setTimeout(() => {
        markAsInstalled();
      }, 4000);
    }
  }, [deferredPrompt, isIOS, markAsInstalled]);

  const dismissModal = useCallback(() => {
    setShowInstallModal(false);
    localStorage.setItem('fs_first_visit_prompted', 'true');
    // If not installed, persistent banner below navbar stays active
    if (!isInstalled) {
      setShowInstallBanner(true);
    }
  }, [isInstalled]);

  const dismissBanner = useCallback(() => {
    setShowInstallBanner(false);
  }, []);

  return (
    <InstallContext.Provider
      value={{
        isInstalled,
        canInstall: canInstall || isIOS,
        showInstallModal,
        showInstallBanner,
        isIOS,
        handleInstall,
        dismissModal,
        dismissBanner,
        markAsInstalled,
      }}
    >
      {children}
    </InstallContext.Provider>
  );
}

export function useInstall() {
  return useContext(InstallContext);
}
