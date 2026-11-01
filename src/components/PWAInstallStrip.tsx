import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallStrip: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // If running in standalone mode (already installed) or dismissed, hide
  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (!success) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <div
        className="pwa-strip"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 70,
          background: 'rgba(11, 14, 22, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '0.45rem 1.1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          fontSize: '0.82rem',
          color: '#fff',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <img
            src="/pwa-192.png"
            alt="MadHata Logo"
            style={{
              width: '1.9rem',
              height: '1.9rem',
              borderRadius: '0.5rem',
              objectFit: 'cover',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 700, color: '#fff', lineHeight: 1.15 }}>
              MadHata
            </span>
            <span style={{ fontSize: '0.72rem', color: '#9aa1b4', fontWeight: 600 }}>
              Install 0.5MB
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={handleInstallClick}
            style={{
              background: 'var(--acc, #5b4ee8)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.78rem',
              padding: '0.38rem 0.95rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(91, 78, 232, 0.45)',
              transition: 'transform 0.2s, background 0.2s',
            }}
          >
            Install
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Close install prompt"
            style={{
              background: 'none',
              border: 'none',
              color: '#8d95aa',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg
              style={{ width: '1.1rem', height: '1.1rem' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {showGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 120,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.2rem',
          }}
          onClick={() => setShowGuide(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '22rem',
              borderRadius: '1.2rem',
              background: '#121a2b',
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '1.6rem',
              color: '#fff',
              boxShadow: '0 2rem 5rem rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <img
                src="/pwa-192.png"
                alt="Logo"
                style={{ width: '2.4rem', height: '2.4rem', borderRadius: '0.6rem' }}
              />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Install MadHata</h3>
                <p style={{ fontSize: '0.76rem', color: '#9aa1b4' }}>Watch movies & series offline</p>
              </div>
            </div>

            {isIOS ? (
              <p style={{ fontSize: '0.85rem', color: '#c5c9d6', lineHeight: 1.6 }}>
                1. Tap the <strong>Share</strong> icon (square with arrow) at the bottom of Safari.<br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.<br />
                3. Open MadHata from your home screen for full offline support!
              </p>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#c5c9d6', lineHeight: 1.6 }}>
                1. Tap the <strong>⋮ (three dots)</strong> menu icon in your browser.<br />
                2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.<br />
                3. Launch MadHata directly from your apps to watch offline anytime!
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              style={{
                marginTop: '1.4rem',
                width: '100%',
                padding: '0.7rem',
                borderRadius: '0.7rem',
                background: 'var(--acc, #5b4ee8)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.88rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
