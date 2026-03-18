import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('gfp_install_dismissed') === 'true'
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (installed || dismissed || !deferredPrompt) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('gfp_install_dismissed', 'true');
  };

  return (
    <div className="bg-[var(--navy)] text-white px-4 py-2 flex items-center justify-center gap-3 text-sm">
      <span>Installer GoForPrice sur votre appareil pour un accès rapide</span>
      <button
        onClick={handleInstall}
        className="px-3 py-1 rounded bg-[var(--p)] hover:bg-[var(--p-dk)] text-white text-xs font-semibold transition-colors"
      >
        Installer
      </button>
      <button
        onClick={handleDismiss}
        className="text-[#8A9BB0] hover:text-white text-xs transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
