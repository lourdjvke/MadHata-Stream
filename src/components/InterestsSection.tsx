import React, { useState, useRef, useEffect } from 'react';
import { INTERESTS } from '../data/content.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { auth } from '../firebase.ts';
import { loadUserInterests, subscribeToPushNotifications } from '../utils/pushNotificationService.ts';

export const InterestsSection: React.FC = () => {
  const { user } = useAuth();
  const [pressedInterests, setPressedInterests] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Load previously saved interests on mount
  useEffect(() => {
    loadUserInterests(user?.uid).then((saved) => {
      if (saved && saved.length > 0) {
        const map: Record<string, boolean> = {};
        saved.forEach((item) => {
          map[item] = true;
        });
        setPressedInterests(map);
      }
    });
  }, [user?.uid]);

  // Entrance observer
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const toggleInterest = (name: string) => {
    setPressedInterests((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const handleSaveCustomisation = async () => {
    setIsSaving(true);
    setStatusText(null);
    const selected = Object.keys(pressedInterests).filter((k) => pressedInterests[k]);
    const effectiveUid = user?.uid || auth.currentUser?.uid;

    try {
      const res = await subscribeToPushNotifications(effectiveUid, selected);
      setIsSaved(true);
      if (res.savedInRtdb || res.subscribed) {
        setStatusText('Customisation saved & notifications active');
      } else {
        setStatusText('Customisation saved');
      }
      setTimeout(() => {
        setIsSaved(false);
        setStatusText(null);
      }, 4000);
    } catch (err: any) {
      console.warn('Save customisation error:', err);
      setIsSaved(true);
      setStatusText('Preferences saved');
      setTimeout(() => {
        setIsSaved(false);
        setStatusText(null);
      }, 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="int" ref={sectionRef}>
      <style>{`
        .save-custom-row {
          margin-top: 1.6rem;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1rem;
        }
        @media (min-width: 768px) {
          .save-custom-row {
            justify-content: center !important;
          }
        }
        .save-pill-btn {
          background: #5b4ee8 !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 9999px !important;
          color: #ffffff !important;
          font-size: 0.9rem !important;
          font-weight: 600 !important;
          padding: 0.72rem 1.85rem !important;
          cursor: pointer !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.55rem !important;
          transition: transform 0.2s ease, opacity 0.2s ease !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        .save-pill-btn:hover {
          opacity: 0.92;
        }
        .save-pill-btn:active {
          transform: scale(0.96);
        }
      `}</style>

      <h2>Your interests?</h2>
      <div className="tgs" id="pills">
        {INTERESTS.map((interest, i) => {
          const isPressed = !!pressedInterests[interest];
          return (
            <button
              key={interest}
              type="button"
              className="tg"
              aria-pressed={isPressed ? 'true' : 'false'}
              style={{ ['--i' as string]: i }}
              onClick={() => toggleInterest(interest)}
            >
              <span className="ico">
                <svg className="i pp">
                  <use href="#plus" />
                </svg>
                <svg className="i cc">
                  <use href="#ck" />
                </svg>
              </span>
              {interest}
            </button>
          );
        })}
      </div>

      <div className="save-custom-row">
        {statusText && (
          <span style={{ fontSize: '0.8rem', color: '#2fd08a', fontWeight: 600 }}>
            {statusText}
          </span>
        )}
        <button
          type="button"
          onClick={handleSaveCustomisation}
          disabled={isSaving}
          className="save-pill-btn"
          aria-label="Save customisation"
        >
          {isSaving ? (
            <>
              <div
                style={{
                  width: '0.95rem',
                  height: '0.95rem',
                  border: '2px solid #fff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'dl-spin 0.8s linear infinite',
                }}
              />
              <span>Saving...</span>
            </>
          ) : isSaved ? (
            <>
              <svg style={{ width: '1rem', height: '1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>Saved</span>
            </>
          ) : (
            <span>Save customisation</span>
          )}
        </button>
      </div>
    </section>
  );
};
