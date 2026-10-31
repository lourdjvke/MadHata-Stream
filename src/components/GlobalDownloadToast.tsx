import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { opfsService } from '../utils/opfsService.ts';

export const GlobalDownloadToast: React.FC = () => {
  const navigate = useNavigate();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = opfsService.subscribeToast((msg) => {
      setToastMessage(msg);
      setTimeout(() => {
        setToastMessage((current) => (current === msg ? null : current));
      }, 5000);
    });

    return () => {
      unsub();
    };
  }, []);

  if (!toastMessage) return null;

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 90,
        bottom: 'calc(max(1.6rem, env(safe-area-inset-bottom)) + 3.8rem)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1rem 0.75rem 1.25rem',
        borderRadius: '99px',
        background: 'rgba(20, 27, 45, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#fff',
        boxShadow: '0 1.2rem 3rem rgba(0, 0, 0, 0.8)',
        animation: 'up 0.4s cubic-bezier(.22,1,.36,1) both',
        maxWidth: '90vw',
      }}
    >
      <div
        style={{
          width: '1.8rem',
          height: '1.8rem',
          borderRadius: '50%',
          background: '#5b4ee8',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          style={{ width: '1rem', height: '1rem', color: '#fff' }}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
        </svg>
      </div>

      <span style={{ flex: 1, minWidth: 0 }}>{toastMessage}</span>

      <button
        type="button"
        onClick={() => navigate('/downloads')}
        style={{
          background: 'rgba(91, 78, 232, 0.25)',
          border: '1px solid rgba(143, 134, 255, 0.4)',
          color: '#b5adff',
          padding: '0.35rem 0.8rem',
          borderRadius: '99px',
          fontWeight: 700,
          fontSize: '0.78rem',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        View
      </button>

      <button
        type="button"
        onClick={() => setToastMessage(null)}
        style={{
          background: 'none',
          border: 'none',
          color: '#8d95aa',
          cursor: 'pointer',
          padding: '0.2rem',
          display: 'grid',
          placeItems: 'center',
        }}
        aria-label="Dismiss"
      >
        <svg style={{ width: '0.9rem', height: '0.9rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
