import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

export function InstallPrompter() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm">
      <div className="glass-card animate-fade-in-up p-4 flex items-center justify-between bg-slate-800/95 border-primary shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-primary rounded-lg p-2 flex">
            <Download size={20} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-sm">Install MathNinja</p>
            <p className="text-xs text-slate-300">Play offline anytime!</p>
          </div>
        </div>
        <div>
          <button className="btn btn-primary px-4 py-2 text-sm" onClick={handleInstallClick}>
            Install
          </button>
        </div>
      </div>
    </div>
  );
}
