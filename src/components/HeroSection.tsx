import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SLIDES } from '../data/content.ts';
import { EpisodesDrawer } from './EpisodesDrawer.tsx';
import { MediaItem, searchMediaWorker, storeActiveMedia, fetchMediaDetails } from '../utils/mediaWorkerApi.ts';
import { decodeHtmlEntities } from '../utils/textUtils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { addToWatchlist, removeFromWatchlist, listenToWatchlist, recordDownload } from '../utils/userDataService.ts';
import { opfsService } from '../utils/opfsService.ts';

interface HeroSectionProps {
  onSeeAllClick: () => void;
  isTasteInView: boolean;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ isTasteInView }) => {
  const navigate = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [featuredItems, setFeaturedItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const metaRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const bdRef = useRef<HTMLDivElement>(null);

  const prevIndexRef = useRef(0);

  // Helper for elevator text roll
  const roll = useCallback((
    el: HTMLElement | null,
    newHtml: string,
    delay: number
  ) => {
    if (!el) return;
    const calm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const old = el.lastElementChild as HTMLElement | null;
    if (!old) {
      el.innerHTML = `<span class="rt">${newHtml}</span>`;
      return;
    }
    if (calm) {
      old.innerHTML = newHtml;
      return;
    }

    const nu = document.createElement('span');
    nu.className = 'rt';
    nu.innerHTML = newHtml;
    old.style.cssText = 'position:absolute;top:.1em;left:0;right:0';
    el.appendChild(nu);

    const opts: KeyframeAnimationOptions = {
      duration: 640,
      delay,
      easing: 'cubic-bezier(.7,0,.2,1)',
      fill: 'both',
    };

    old
      .animate(
        [
          { transform: 'translateY(0)', opacity: 1 },
          { transform: 'translateY(115%)', opacity: 0 },
        ],
        opts
      )
      .onfinish = () => old.remove();

    nu.animate(
      [
        { transform: 'translateY(-115%)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 },
      ],
      opts
    );
  }, []);

  const showSlide = useCallback((n: number, items: MediaItem[]) => {
    if (items.length === 0) return;
    const item = items[n];
    const bd = bdRef.current;
    
    // Aesthetic fallbacks from static slides if needed
    const aesthetic = SLIDES[n % SLIDES.length];
    
    if (bd) {
      aesthetic.c.forEach((c, i) => bd.style.setProperty(`--c${i + 1}`, c));
      bd.style.setProperty('--h', `${aesthetic.h}deg`);
      bd.classList.remove('sw');
      void bd.offsetWidth;
      bd.classList.add('sw');
    }

    const title = decodeHtmlEntities(item.cleanTitle || item.title);
    const metaHtml = `<span>TV-MA</span><span>${item.year || 2026}</span><span>HDR</span><span class="chip">HD</span>`;
    const desc = item.synopsis || aesthetic.d;

    roll(titleRef.current, title, 0);
    roll(metaRef.current, metaHtml, 90);
    roll(descRef.current, desc, 180);

    setSlideIndex(n);
    setIsSynopsisExpanded(false);
  }, [roll]);

  // Load featured items gradually
  useEffect(() => {
    let isMounted = true;
    const titles = [
      'Carrie 2026', 
      'Venom Last Dance', 
      'Heated Rivalry', 
      'Gladiator II', 
      'Deadpool Wolverine', 
      'Joker Folie Deux', 
      'Nosferatu 2024',
      'The Last of Us Season 2'
    ];
    
    const loadItems = async () => {
      const results: MediaItem[] = [];
      for (const t of titles) {
        try {
          const res = await searchMediaWorker(t);
          if (res.results && res.results.length > 0) {
            // Fetch full details for synopsis and better poster
            const details = await fetchMediaDetails(res.results[0]);
            results.push(details);
            if (isMounted) {
              setFeaturedItems([...results]);
              if (results.length === 1) {
                showSlide(0, results);
                setIsLoading(false);
              }
            }
          }
          // Gradual loading delay
          await new Promise(r => setTimeout(r, 600));
        } catch (e) {
          console.warn(`Hero failed to load ${t}:`, e);
        }
      }
    };

    loadItems();
    return () => { isMounted = false; };
  }, [showSlide]);

  // Auto-cycle slides every 7s
  useEffect(() => {
    if (featuredItems.length === 0) return;
    const timer = setInterval(() => {
      if (!isTasteInView && !isEpisodesOpen && !document.hidden && !isSynopsisExpanded) {
        const next = (prevIndexRef.current + 1) % featuredItems.length;
        prevIndexRef.current = next;
        showSlide(next, featuredItems);
      }
    }, 7000);

    return () => clearInterval(timer);
  }, [isTasteInView, isEpisodesOpen, featuredItems, showSlide, isSynopsisExpanded]);

  const handlePlayClick = () => {
    const item = featuredItems[slideIndex];
    if (!item) return;
    storeActiveMedia(item);
    const url = item.url || item.original_url || '';
    const source = item.source || '1';
    navigate(`/details?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}`);
  };

  const currentActiveMedia = featuredItems[slideIndex] || null;
  const { user } = useAuth();
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isWatchlistAnimating, setIsWatchlistAnimating] = useState(false);

  // Sync watchlist status from RTDB for current media
  useEffect(() => {
    if (!user?.uid || !currentActiveMedia) {
      setIsInWatchlist(false);
      return;
    }
    const mediaId = currentActiveMedia.id || currentActiveMedia.slug || currentActiveMedia.title;
    const unsub = listenToWatchlist(user.uid, (items) => {
      const found = items.some((it) => it.id === mediaId || it.title === currentActiveMedia.title);
      setIsInWatchlist(found);
    });
    return () => unsub();
  }, [user?.uid, currentActiveMedia]);

  const handleToggleWatchlist = async () => {
    if (!currentActiveMedia || !user?.uid) return;
    const mediaId = currentActiveMedia.id || currentActiveMedia.slug || currentActiveMedia.title;

    setIsWatchlistAnimating(true);
    setTimeout(() => setIsWatchlistAnimating(false), 500);

    if (isInWatchlist) {
      setIsInWatchlist(false);
      await removeFromWatchlist(user.uid, mediaId);
    } else {
      setIsInWatchlist(true);
      await addToWatchlist(user.uid, {
        id: mediaId,
        title: currentActiveMedia.cleanTitle || currentActiveMedia.title,
        poster: currentActiveMedia.poster,
        url: currentActiveMedia.url || currentActiveMedia.original_url || '',
        source: currentActiveMedia.source || '1',
        year: String(currentActiveMedia.year || '2026'),
        type: currentActiveMedia.downloads?.length ? 'Series' : 'Movie',
        rating: '4.8',
      });
    }
  };

  const [activeDownloads, setActiveDownloads] = useState<any[]>([]);

  useEffect(() => {
    const unsub = opfsService.subscribe((active) => {
      setActiveDownloads(active);
    });
    return unsub;
  }, []);

  const handleDownloadHero = async () => {
    if (!currentActiveMedia) return;
    const title = currentActiveMedia.cleanTitle || currentActiveMedia.title || 'Video';
    const mediaId = currentActiveMedia.id || currentActiveMedia.slug || title;

    if (opfsService.isDownloading(mediaId)) return;

    try {
      const downloadUrl = currentActiveMedia.downloads?.[0]?.url || currentActiveMedia.url || currentActiveMedia.original_url || '';
      
      await opfsService.startDownload({
        id: mediaId,
        title,
        type: currentActiveMedia.downloads?.length ? 'series' : 'movie',
        url: downloadUrl,
        posterUrl: currentActiveMedia.poster,
        quality: 'HD',
        sub: currentActiveMedia.downloads?.length ? 'Episode 1' : 'Movie',
        sizeMb: currentActiveMedia.downloads?.length ? 650 : 1400,
        year: String(currentActiveMedia.year || '2026'),
        synopsis: currentActiveMedia.synopsis
      });

      if (user?.uid) {
        recordDownload(user.uid, {
          id: mediaId,
          title,
          url: downloadUrl,
        });
      }
    } catch (err: any) {
      alert(err?.message || 'Storage limit exceeded! Unable to start download.');
    }
  };

  const isDownloading = currentActiveMedia && activeDownloads.some(d => d.mediaId === (currentActiveMedia.id || currentActiveMedia.slug || currentActiveMedia.title));
  const dlProgress = currentActiveMedia ? activeDownloads.find(d => d.mediaId === (currentActiveMedia.id || currentActiveMedia.slug || currentActiveMedia.title))?.p || 0 : 0;

  return (
    <section className="hero" id="home">
      <style>{`
        @keyframes dl-spin { to { transform: rotate(360deg); } }
        .dl-spinner { animation: dl-spin 1s linear infinite; }
      `}</style>
      <div
        className="bd"
        aria-hidden="true"
        ref={bdRef}
        style={{
          ['--c1' as string]: SLIDES[0].c[0],
          ['--c2' as string]: SLIDES[0].c[1],
          ['--c3' as string]: SLIDES[0].c[2],
          ['--h' as string]: `${SLIDES[0].h}deg`,
        }}
      >
        {currentActiveMedia?.poster && (
          <img 
            src={currentActiveMedia.poster} 
            alt="" 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover', 
              opacity: 0.55, 
              filter: 'blur(3px) brightness(0.65)',
              zIndex: 0
            }} 
            loading="lazy"
          />
        )}
      </div>

      <header className="top rv" style={{ ['--n' as string]: 0 }}>
        <div className="brand">
          <span className="logo">M</span>
          <span>Mad<b>Hata</b></span>
        </div>
      </header>

      <div className="info">
        <h1 className="rv rl" style={{ ['--n' as string]: 1 }} ref={titleRef}>
          {isLoading ? <span className="skeleton sk-title" /> : <span className="rt" />}
        </h1>
        <div className="meta rv rl" style={{ ['--n' as string]: 2 }} ref={metaRef}>
          {isLoading ? <span className="skeleton sk-meta" /> : <span className="rt" />}
        </div>
        <div className="desc-wrap rv rl" style={{ ['--n' as string]: 3 }}>
          <p className={`desc ${isSynopsisExpanded ? 'full' : 'clamped'}`} ref={descRef}>
            {isLoading ? <span className="skeleton sk-desc" /> : <span className="rt" />}
          </p>
          {!isLoading && currentActiveMedia?.synopsis && currentActiveMedia.synopsis.length > 150 && (
            <button 
              className="read-more" 
              onClick={() => setIsSynopsisExpanded(!isSynopsisExpanded)}
              style={{ color: 'var(--acc)', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.4rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative', zIndex: 10 }}
            >
              {isSynopsisExpanded ? 'Show less' : 'Read more...'}
            </button>
          )}
        </div>

        <div className="acts rv" style={{ ['--n' as string]: 4 }}>
          <button
            className="b pri"
            aria-label="Play"
            onClick={handlePlayClick}
            disabled={isLoading}
          >
            <svg className="i">
              <use href="#play" />
            </svg>
          </button>
          <button
            className="b"
            id="epb"
            aria-label="Episodes"
            aria-expanded={isEpisodesOpen ? 'true' : 'false'}
            aria-controls="epw"
            onClick={() => setIsEpisodesOpen((prev) => !prev)}
            disabled={isLoading}
          >
            <svg className="i">
              <use href="#list" />
            </svg>
          </button>
          <button
            className={`b ${isInWatchlist ? 'on' : ''}`}
            aria-label={isInWatchlist ? "Remove from watchlist" : "Add to watchlist"}
            title={isInWatchlist ? "In Watchlist" : "Add to Watchlist"}
            onClick={handleToggleWatchlist}
            style={{
              transition: 'transform 0.4s cubic-bezier(.22,1,.36,1), background 0.3s, border-color 0.3s',
              transform: isWatchlistAnimating ? 'scale(1.2) rotate(15deg)' : 'scale(1)',
              background: isInWatchlist ? 'var(--acc)' : undefined,
              boxShadow: isInWatchlist ? '0 0.5rem 1.4rem rgba(91, 78, 232, 0.6)' : undefined,
            }}
          >
            <svg
              className="i"
              style={{
                transition: 'transform 0.35s ease',
                transform: isWatchlistAnimating ? 'scale(0.8)' : 'scale(1)',
                color: isInWatchlist ? '#fff' : undefined,
              }}
            >
              <use href={isInWatchlist ? "#ck" : "#plus"} />
            </svg>
          </button>
          <button 
            className="b" 
            aria-label="Download" 
            title={isDownloading ? `Downloading: ${Math.round(dlProgress * 100)}%` : "Download"} 
            onClick={handleDownloadHero}
            style={{
              background: isDownloading ? 'rgba(91, 78, 232, 0.2)' : undefined,
              border: isDownloading ? '1px solid var(--acc)' : 'none',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {isDownloading && (
              <div style={{ position: 'absolute', inset: 0, background: 'var(--acc)', opacity: 0.15, transformOrigin: 'left', transform: `scaleX(${dlProgress})` }} />
            )}
            <svg className={`i ${isDownloading ? 'dl-spinner' : ''}`} style={{ color: isDownloading ? 'var(--acc)' : 'inherit' }}>
              <use href={isDownloading ? "#gear" : "#dl"} />
            </svg>
          </button>
        </div>
      </div>

      <EpisodesDrawer
        isOpen={isEpisodesOpen}
        onClose={() => setIsEpisodesOpen(false)}
        activeMedia={currentActiveMedia}
      />
    </section>
  );
};
