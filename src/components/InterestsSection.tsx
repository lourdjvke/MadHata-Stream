import React, { useState, useRef, useEffect } from 'react';
import { INTERESTS } from '../data/content.ts';

export const InterestsSection: React.FC = () => {
  const [pressedInterests, setPressedInterests] = useState<Record<string, boolean>>({});
  const sectionRef = useRef<HTMLElement>(null);

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

  return (
    <section className="int" ref={sectionRef}>
      <h2>Your interests?</h2>
      <div className="tgs" id="pills">
        {INTERESTS.map((interest, i) => {
          const isPressed = !!pressedInterests[interest];
          return (
            <button
              key={interest}
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
    </section>
  );
};
