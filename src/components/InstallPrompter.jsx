import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';

export function InstallPrompter() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
      setTimeout(() => setVisible(true), 50);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') dismiss();
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setShowPrompt(false), 300);
  };

  if (!showPrompt) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(24px)',
      }}
    >
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.15),0_4px_16px_rgba(15,23,42,0.08)]">
        {/* gradient top strip */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#FF7052] via-[#FFCA42] to-[#5EDAD0]" />

        <div className="p-4 pt-5">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-[#FF7052] to-[#FFCA42] flex items-center justify-center shadow-[0_4px_12px_rgba(255,112,82,0.35)]">
              <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
                <polygon points="16,4 28,14 4,14" fill="white" />
                <rect x="6" y="14" width="20" height="13" rx="1" fill="white" />
                <rect x="12" y="20" width="8" height="7" rx="1" fill="#FF7052" />
                <rect x="8" y="17.5" width="5" height="1.5" rx="0.75" fill="#5EDAD0" />
                <rect x="9.75" y="15.75" width="1.5" height="5" rx="0.75" fill="#5EDAD0" />
              </svg>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="font-black text-[#1e293b] text-sm leading-tight">Add MathVillage to your home screen</p>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Play offline, get faster load times</p>
            </div>

            {/* Dismiss */}
            <button
              onClick={dismiss}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={dismiss}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF7052] to-[#FFCA42] py-2.5 text-sm font-black text-white shadow-[0_4px_12px_rgba(255,112,82,0.35)] hover:opacity-90 transition-all"
            >
              <Download size={14} /> Install
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
