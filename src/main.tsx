import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Capture beforeinstallprompt event as early as possible so it is never missed
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    (window as any).__pwaInstallPrompt = e;
    window.dispatchEvent(new CustomEvent('madhata-pwa-installable'));
  });
}

// Register Service Worker immediately for true offline support and PWA installability
registerSW({
  immediate: true,
  onRegistered(registration) {
    if (registration) {
      console.log('MadHata PWA Service Worker registered:', registration.scope);
    }
  },
  onRegisterError(error) {
    console.warn('MadHata PWA Service Worker registration failed:', error);
  },
});

createRoot(document.getElementById('root')!).render(<App />);
