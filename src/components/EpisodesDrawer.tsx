import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraggableRow } from '../hooks/useDraggableRow.ts';
import { MediaItem, storeActiveMedia } from '../utils/mediaWorkerApi.ts';
import { decodeHtmlEntities } from '../utils/textUtils.ts';

interface EpisodesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeMedia?: MediaItem | null;
}

export const EpisodesDrawer: React.FC<EpisodesDrawerProps> = ({ isOpen, activeMedia, onClose }) => {
  const navigate = useNavigate();
  const epwRef = useRef<HTMLDivElement>(null);
  const rowRef = useDraggableRow<HTMLDivElement>();
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const seqRef = useRef(0);

  const episodeList = useMemo(() => {
    if (!activeMedia) return [];
    if (activeMedia.downloads && activeMedia.downloads.length > 0) {
      return activeMedia.downloads.map((d, i) => ({
        id: i,
        title: decodeHtmlEntities(d.label || `Episode ${i + 1}`),
        url: d.url,
      }));
    }
    // Single movie case
    return [{
      id: 0,
      title: decodeHtmlEntities(activeMedia.cleanTitle || activeMedia.title),
      url: activeMedia.url || activeMedia.original_url || '',
    }];
  }, [activeMedia]);

  const isPlayingRef = useRef<boolean[]>([]);
  
  useEffect(() => {
    isPlayingRef.current = episodeList.map(() => false);
  }, [episodeList]);

  const playVideo = (index: number) => {
    if (!episodeList[index] || isPlayingRef.current[index]) return;
    let v = videoRefs.current[index];
    const card = cardRefs.current[index];
    const streamUrl = episodeList[index].url;

    if (!v && card && streamUrl) {
      v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.setAttribute('playsinline', '');
      v.setAttribute('aria-hidden', 'true');
      v.style.position = 'absolute';
      v.style.inset = '0';
      v.style.width = '100%';
      v.style.height = '100%';
      v.style.objectFit = 'cover';
      v.style.zIndex = '0';
      v.style.opacity = '0';
      v.style.transition = 'opacity 0.5s';
      
      v.addEventListener('playing', () => {
        if (v) v.style.opacity = '1';
      });
      v.src = streamUrl;
      card.prepend(v);
      videoRefs.current[index] = v;
    }
    if (!v) return;

    isPlayingRef.current[index] = true;
    const startPlay = () => {
      if (!isPlayingRef.current[index] || !v) return;
      v.play().catch(() => {});
    };

    if (v.readyState >= 1) {
      startPlay();
    } else {
      v.addEventListener('loadedmetadata', startPlay, { once: true });
    }
  };

  const stopVideo = (index: number) => {
    if (!isPlayingRef.current[index]) return;
    isPlayingRef.current[index] = false;
    const v = videoRefs.current[index];
    if (v) {
      v.pause();
      v.style.opacity = '0';
    }
  };

  const stopAllVideos = () => {
    episodeList.forEach((_, i) => stopVideo(i));
  };

  // Stagger animation on open and close
  useEffect(() => {
    const epw = epwRef.current;
    const eprow = rowRef.current;
    if (!epw || !eprow) return;

    const calm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const ecs = cardRefs.current.filter(Boolean) as HTMLElement[];

    const fromX = (c: HTMLElement) => Math.max(window.innerWidth - c.getBoundingClientRect().left + 24, c.offsetWidth * 0.6);

    const q = ++seqRef.current;

    if (isOpen) {
      epw.classList.add('open');
      (epw as unknown as { inert: boolean }).inert = false;
      epw.removeAttribute('aria-hidden');
      ecs.forEach((c) => c.getAnimations().forEach((a) => a.cancel()));
      eprow.scrollLeft = 0;

      if (!calm) {
        ecs.forEach((c, i) =>
          c.animate(
            [
              { transform: `translateX(${fromX(c)}px) scale(.86) rotate(4deg)`, opacity: 0 },
              { opacity: 1, offset: 0.3 },
              { transform: 'none', opacity: 1 },
            ],
            {
              duration: 900,
              delay: 120 + i * 90,
              easing: 'cubic-bezier(.2,.9,.25,1)',
              fill: 'backwards',
            }
          )
        );
      }

      // Silent play/stop logic to resolve media when drawer opens
      if (episodeList.length > 0) {
        setTimeout(() => {
          if (q === seqRef.current && isOpen) {
            playVideo(0);
            setTimeout(() => stopVideo(0), 1000);
          }
        }, 1000);
      }

      [350, 950].forEach((t) =>
        setTimeout(() => {
          if (q === seqRef.current && epw) {
            epw.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, t)
      );
    } else {
      stopAllVideos();
      const t = calm ? 0 : 380 + (ecs.length - 1) * 45;
      if (t) {
        ecs
          .slice()
          .reverse()
          .forEach((c, i) =>
            c.animate(
              [
                { transform: 'none', opacity: 1 },
                { transform: `translateX(${fromX(c) * 0.6}px) scale(.88)`, opacity: 0 },
              ],
              {
                duration: 380,
                delay: i * 45,
                easing: 'cubic-bezier(.5,0,.85,.3)',
                fill: 'forwards',
              }
            )
          );
      }
      setTimeout(() => {
        if (q !== seqRef.current) return;
        epw.classList.remove('open');
        (epw as unknown as { inert: boolean }).inert = true;
        epw.setAttribute('aria-hidden', 'true');
        setTimeout(() => {
          if (q === seqRef.current) {
            ecs.forEach((c) => c.getAnimations().forEach((a) => a.cancel()));
          }
        }, 900);
      }, t);
    }
  }, [isOpen, episodeList]);

  const handleEpisodeClick = (index: number) => {
    if (!activeMedia) return;
    storeActiveMedia(activeMedia);
    const url = activeMedia.url || activeMedia.original_url || '';
    const source = activeMedia.source || '1';
    navigate(`/watch?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}&ep=${index}`);
    onClose();
  };

  return (
    <div
      className={`epw ${isOpen ? 'open' : ''}`}
      id="epw"
      ref={epwRef}
      {...(!isOpen ? { 'aria-hidden': 'true' } : {})}
    >
      <div className="epi">
        <div className="row eprow" id="eprow" ref={rowRef}>
          {episodeList.map((ep, i) => (
            <article
              key={`${ep.title}-${i}`}
              className="ec"
              tabIndex={0}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              style={{ 
                backgroundImage: activeMedia?.poster ? `url(${activeMedia.poster})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                flex: '0 0 300px',
                aspectRatio: '16/9',
                position: 'relative',
                overflow: 'hidden'
              }}
              onClick={() => handleEpisodeClick(i)}
              onPointerEnter={(e) => {
                if (e.pointerType === 'mouse') playVideo(i);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === 'mouse') stopVideo(i);
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.8))', zIndex: 1 }} />
              <b style={{ position: 'relative', zIndex: 2, padding: '0.8rem', display: 'block' }}>{ep.title}</b>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
