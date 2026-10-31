import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CARDS, VID, T } from '../data/content.ts';
import { subscribeThumbnails } from '../utils/thumbnailGenerator.ts';

interface TasteCarouselProps {
  onTasteInViewChange: (inView: boolean) => void;
}

export const TasteCarousel: React.FC<TasteCarouselProps> = ({ onTasteInViewChange }) => {
  const tasteRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [activeDot, setActiveDot] = useState(2);

  const N = CARDS.length;
  const mod = (n: number) => ((n % N) + N) % N;
  const wrap = (d: number) => ((d + N / 2) % N + N) % N - N / 2;
  const STEP = 1.04;

  const posRef = useRef(2);
  const widthRef = useRef(1);
  const dragRef = useRef<{
    x: number;
    p: number;
    m: number;
    lx: number;
    t: number;
    v: number;
  } | null>(null);
  const movedRef = useRef(0);
  const inTasteRef = useRef(false);
  const wheelLockRef = useRef(0);
  const startedRef = useRef(false);
  const curRef = useRef(-1);

  useEffect(() => {
    return subscribeThumbnails((data) => {
      if (data.cards.length > 0) {
        setThumbnails([...data.cards]);
      }
    });
  }, []);

  const vidFor = useCallback(
    (i: number) => {
      let v = videoRefs.current[i];
      const card = cardRefs.current[i];
      if (!v && card) {
        v = document.createElement('video');
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.setAttribute('playsinline', '');
        v.setAttribute('aria-hidden', 'true');
        v.addEventListener(
          'loadedmetadata',
          () => {
            if (v) v.currentTime = T[i];
          },
          { once: true }
        );
        v.addEventListener('playing', () => v?.classList.add('live'));
        v.src = VID;
        card.prepend(v);
        videoRefs.current[i] = v;
      }
      return v;
    },
    [N]
  );

  const pauseAll = useCallback((exceptIdx: number) => {
    videoRefs.current.forEach((v, j) => {
      if (v && j !== exceptIdx) {
        v.pause();
      }
    });
  }, []);

  const playVideo = useCallback(
    (i: number) => {
      if (i < 0 || !startedRef.current || !inTasteRef.current || document.hidden) return;
      const v = vidFor(i);
      if (!v) return;
      const goPlay = () => v.play().catch(() => {});
      if (v.readyState >= 1) {
        goPlay();
      } else {
        v.addEventListener('loadedmetadata', goPlay, { once: true });
      }
    },
    [vidFor]
  );

  const activate = useCallback(() => {
    const i = mod(Math.round(posRef.current));
    if (i === curRef.current) return;
    curRef.current = i;
    pauseAll(i);
    playVideo(i);
  }, [pauseAll, playVideo]);

  const toggleVideo = useCallback(() => {
    startedRef.current = true;
    const v = vidFor(curRef.current);
    if (!v) return;
    if (v.paused) {
      playVideo(curRef.current);
    } else {
      v.pause();
    }
  }, [vidFor, playVideo]);

  const renderCards = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
    if (cards.length === 0) return;

    const W = cards[0].offsetWidth || 1;
    widthRef.current = W;
    const pos = posRef.current;

    cards.forEach((c, i) => {
      const d = wrap(i - pos);
      const a = Math.abs(d);
      const k = Math.max(-2, Math.min(2, d));
      const m = Math.min(a, 2);

      c.style.transform = `translate(-50%,-50%) translateX(${d * W * STEP}px) translateZ(${-m * W * 0.1}px) rotateY(${-k * 21}deg) scale(${1 - m * 0.06})`;
      c.style.opacity = String(Math.max(0, Math.min(1, 3 - a)));
      c.style.zIndex = String(10 - Math.round(a));
      c.style.setProperty('--o', (m * 0.2).toFixed(2));
      c.classList.toggle('on', a < 0.5);
      c.setAttribute('aria-hidden', String(a >= 0.5));
    });

    const act = mod(Math.round(pos));
    setActiveDot(act);
    activate();
  }, [activate]);

  const goTo = useCallback(
    (targetPos: number) => {
      startedRef.current = true;
      posRef.current = targetPos;
      renderCards();
    },
    [renderCards]
  );

  const step = useCallback(
    (offset: number) => {
      goTo(Math.round(posRef.current) + offset);
    },
    [goTo]
  );

  // Setup initial render and observers
  useEffect(() => {
    const stage = stageRef.current;
    const taste = tasteRef.current;
    if (!stage || !taste) return;

    renderCards();
    const animId = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        stage.classList.add('rdy');
      });
    });

    const ro = new ResizeObserver(() => {
      renderCards();
    });
    ro.observe(stage);

    const tasteObserver = new IntersectionObserver(
      ([e]) => {
        const inT = e.isIntersecting;
        inTasteRef.current = inT;
        document.body.classList.toggle('t', inT);
        onTasteInViewChange(inT);
        if (inT) {
          playVideo(curRef.current);
          taste.classList.add('seen');
        } else {
          pauseAll(-1);
        }
      },
      { threshold: 0.5 }
    );
    tasteObserver.observe(taste);

    const handleVisibility = () => {
      if (document.hidden) {
        pauseAll(-1);
      } else {
        playVideo(curRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!inTasteRef.current) return;
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      tasteObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('t');
    };
  }, [renderCards, onTasteInViewChange, playVideo, pauseAll, step]);

  // Pointer drag events on stage
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onPointerDown = (e: PointerEvent) => {
      dragRef.current = {
        x: e.clientX,
        p: posRef.current,
        m: 0,
        lx: e.clientX,
        t: performance.now(),
        v: 0,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.m && Math.abs(dx) > 6) {
        drag.m = 1;
        startedRef.current = true;
        stage.classList.add('drag');
        try {
          stage.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      if (!drag.m) return;
      const t = performance.now();
      if (t > drag.t) {
        drag.v = (e.clientX - drag.lx) / (t - drag.t);
      }
      drag.lx = e.clientX;
      drag.t = t;
      const W = widthRef.current || 1;
      posRef.current = drag.p - dx / (W * STEP);
      renderCards();
    };

    const onPointerUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (drag.m) {
        stage.classList.remove('drag');
        movedRef.current = 1;
        setTimeout(() => {
          movedRef.current = 0;
        }, 60);
        const base = Math.round(drag.p);
        const W = widthRef.current || 1;
        const target = Math.round(posRef.current - (drag.v * 200) / (W * STEP));
        goTo(Math.max(base - 2, Math.min(base + 2, target)));
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 18) {
        e.preventDefault();
        if (!wheelLockRef.current) {
          wheelLockRef.current = 1;
          step(Math.sign(e.deltaX));
          setTimeout(() => {
            wheelLockRef.current = 0;
          }, 450);
        }
      }
    };

    stage.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      stage.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      stage.removeEventListener('wheel', onWheel);
    };
  }, [renderCards, goTo, step]);

  const handleStageClick = (e: React.MouseEvent) => {
    if (movedRef.current) return;
    const target = e.target as HTMLElement;
    const card = target.closest('.card') as HTMLElement | null;
    if (!card) return;
    const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
    const idx = cards.indexOf(card);
    if (idx === -1) return;
    const d = wrap(idx - Math.round(posRef.current));
    if (d !== 0) {
      goTo(Math.round(posRef.current) + d);
    } else {
      toggleVideo();
    }
  };

  return (
    <section className="taste" id="taste" ref={tasteRef}>
      <div className="hd">
        <h2>Your taste</h2>
        <p>Here are your something which you maybe love</p>
      </div>

      <div
        className="stage"
        id="stage"
        ref={stageRef}
        role="group"
        aria-roledescription="carousel"
        aria-label="Your taste"
        onClick={handleStageClick}
      >
        {CARDS.map((card, i) => (
          <article
            key={card.title}
            className="card"
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            style={{
              background: thumbnails[i]
                ? `url(${thumbnails[i]}) center/cover, ${card.background}`
                : card.background,
            }}
          >
            <div className="cap">
              <div>{card.title}</div>
              <div>
                Animation
                <em>
                  <svg className="i s">
                    <use href="#star" />
                  </svg>
                  {card.rating}
                </em>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="ctl">
        <div className="pill">
          <button id="prev" aria-label="Previous" onClick={() => step(-1)}>
            <svg className="i">
              <use href="#al" />
            </svg>
          </button>
          <button id="next" aria-label="Next" onClick={() => step(1)}>
            <svg className="i">
              <use href="#ar" />
            </svg>
          </button>
        </div>
        <div className="dots" id="dots">
          {CARDS.map((_, i) => (
            <button
              key={i}
              className={i === activeDot ? 'on' : ''}
              aria-label={`Show ${i + 1}`}
              onClick={() => goTo(Math.round(posRef.current) + wrap(i - Math.round(posRef.current)))}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
