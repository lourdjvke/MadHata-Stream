import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallStrip: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If running in standalone mode or user dismissed the strip, do not show
  if (isInstalled || dismissed) {
    return null;
  }

  // Show only on browsers/devices that allow installation or iOS Safari
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <div
        className="pwa-strip"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: 'rgba(18, 26, 43, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '0.45rem 1.1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          fontSize: '0.82rem',
          color: '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '1.7rem',
              height: '1.7rem',
              borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, #7f63ff, #3b2fd0)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: '0.9rem',
              flexShrink: 0,
            }}
          >
            M
          </div>
          <span style={{ fontWeight: 600, color: '#e2e7f4' }}>
            Install 0.5MB
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isInstallable && (
            <button
              type="button"
              onClick={install}
              style={{
                background: '#5b4ee8',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.78rem',
                padding: '0.35rem 0.85rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(91, 78, 232, 0.4)',
                transition: 'background 0.2s',
              }}
            >
              Install
            </button>
          )}

          {isIOS && !isInstallable && (
            <button
              type="button"
              onClick={() => setShowIOSGuide(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.12)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.75rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Install on iOS
            </button>
          )}

          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Close install prompt"
            style={{
              background: 'none',
              border: 'none',
              color: '#8d95aa',
              cursor: 'pointer',
              padding: '0.2rem',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg
              style={{ width: '1rem', height: '1rem' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {showIOSGuide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 110,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '22rem',
              borderRadius: '1rem',
              background: '#121a2b',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '1.5rem',
              color: '#fff',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Install on iOS</h3>
            <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: '#9aa1b4', lineHeight: 1.5 }}>
              1. Tap the <strong>Share</strong> icon in Safari toolbar.<br />
              2. Scroll down and tap <strong>Add to Home Screen</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              style={{
                marginTop: '1.2rem',
                width: '100%',
                padding: '0.6rem',
                borderRadius: '0.6rem',
                background: '#5b4ee8',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
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
