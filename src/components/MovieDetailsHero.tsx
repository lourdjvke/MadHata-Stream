import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEASONS_DATA } from '../data/movieDetailsData.ts';
import { getStoredActiveMedia, MediaItem } from '../utils/mediaWorkerApi.ts';
import { getWatchedEp, extractSeasonInfo, cleanSynopsis } from '../utils/textUtils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { addToWatchlist, removeFromWatchlist, listenToWatchlist, recordDownload } from '../utils/userDataService.ts';
import { opfsService } from '../utils/opfsService.ts';

interface MovieDetailsHeroProps {
  currentEpisode: [number, number]; // [seasonIndex, episodeIndex]
  onResumeClick: () => void;
  activeMedia?: MediaItem | null;
  isLoading?: boolean;
}

export const MovieDetailsHero: React.FC<MovieDetailsHeroProps> = ({
  currentEpisode,
  onResumeClick,
  activeMedia: propActiveMedia,
  isLoading,
}) => {
  const navigate = useNavigate();
  const [showFullSynopsis, setShowFullSynopsis] = React.useState(false);
  const storedMedia = useMemo(() => getStoredActiveMedia(), []);
  const activeMedia = propActiveMedia || storedMedia;

  const [s, i] = currentEpisode;
  const season = SEASONS_DATA[s] || SEASONS_DATA[0];
  const episode = season[i] || season[0];
  const [, m, p] = episode;

  // Track last watched episode from localStorage per media item
  const mediaId = activeMedia?.id || activeMedia?.slug || '';
  const lastWatchedIdx = mediaId ? getWatchedEp(mediaId) : i;

  const seasonInfo = extractSeasonInfo(activeMedia?.title || '', activeMedia?.url);
  const displaySeason = seasonInfo.seasonNumber ? seasonInfo.seasonNumber : s + 1;

  const actionLabel = p >= 1 ? 'Rewatch' : p > 0 ? 'Resume' : 'Play';
  const subtitle = `S${displaySeason} · E${i + 1}`;
  
  // Logic fix: Only show progress text if they have actually watched some of it
  const nowText = p > 0 ? `Last EP — E${lastWatchedIdx + 1}` : `New Release · E${i + 1}`;

  const heroTitle = activeMedia?.cleanTitle || activeMedia?.title || 'HOUSES & DRAGONS';
  const heroYear = activeMedia?.year || '2026';
  const heroSynopsis = cleanSynopsis(activeMedia?.synopsis, heroTitle);

  const { user } = useAuth();
  const [isInWatchlist, setIsInWatchlist] = React.useState(false);
  const [isWatchlistAnimating, setIsWatchlistAnimating] = React.useState(false);

  // Sync watchlist status from RTDB for this media
  React.useEffect(() => {
    if (!user?.uid || !activeMedia) {
      setIsInWatchlist(false);
      return;
    }
    const currentId = activeMedia.id || activeMedia.slug || activeMedia.title;
    const unsub = listenToWatchlist(user.uid, (items) => {
      const found = items.some((it) => it.id === currentId || it.title === activeMedia.title);
      setIsInWatchlist(found);
    });
    return () => unsub();
  }, [user?.uid, activeMedia]);

  const handleToggleWatchlist = async () => {
    if (!activeMedia || !user?.uid) return;
    const currentId = activeMedia.id || activeMedia.slug || activeMedia.title;

    setIsWatchlistAnimating(true);
    setTimeout(() => setIsWatchlistAnimating(false), 500);

    if (isInWatchlist) {
      setIsInWatchlist(false);
      await removeFromWatchlist(user.uid, currentId);
    } else {
      setIsInWatchlist(true);
      await addToWatchlist(user.uid, {
        id: currentId,
        title: heroTitle,
        poster: activeMedia.poster,
        url: activeMedia.url || activeMedia.original_url || '',
        source: activeMedia.source || '1',
        year: String(heroYear || '2026'),
        type: activeMedia.downloads?.length ? 'Series' : 'Movie',
        rating: '4.8',
      });
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const [activeDownloads, setActiveDownloads] = React.useState<any[]>([]);

  React.useEffect(() => {
    const unsub = opfsService.subscribe((active) => {
      setActiveDownloads(active);
    });
    return unsub;
  }, []);

  const handleDownloadMovie = async () => {
    const currentId = activeMedia?.id || activeMedia?.slug || heroTitle;
    if (opfsService.isDownloading(currentId)) return;

    try {
      await opfsService.startDownload({
        id: currentId,
        title: heroTitle,
        type: activeMedia?.downloads?.length ? 'series' : 'movie',
        posterUrl: activeMedia?.poster,
        quality: 'HD',
        sub: activeMedia?.downloads?.length ? `S${displaySeason}:E${i + 1}` : 'Movie',
        label: activeMedia?.downloads?.length ? `S${displaySeason}:E${i + 1}` : '',
        sizeMb: activeMedia?.downloads?.length ? 550 : 1600,
      });

      if (user?.uid) {
        recordDownload(user.uid, {
          id: currentId,
          title: heroTitle,
          url: activeMedia?.url || '',
        });
      }
    } catch (err: any) {
      alert(err?.message || 'Storage limit exceeded! Unable to start download.');
    }
  };

  const isDownloading = activeMedia && activeDownloads.some(d => d.mediaId === (activeMedia.id || activeMedia.slug || activeMedia.title));
  const dlProgress = activeMedia ? activeDownloads.find(d => d.mediaId === (activeMedia.id || activeMedia.slug || activeMedia.title))?.p || 0 : 0;

  return (
    <section className="hero" style={{ minHeight: 'clamp(34rem, 84svh, 62rem)' }}>
      <style>{`
        @keyframes dl-spin { to { transform: rotate(360deg); } }
        .dl-spinner { animation: dl-spin 1s linear infinite; }
      `}</style>
      <div className="bd" aria-hidden="true">
        {activeMedia?.poster ? (
          <img
            src={activeMedia.poster}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 25%',
              opacity: 0.35,
              filter: 'blur(2px) brightness(0.8)',
            }}
          />
        ) : null}
      </div>

      <header className="top rv" style={{ ['--n' as string]: 0 }}>
        <button className="ic bk" aria-label="Back" onClick={handleBack} style={{ position: 'absolute', left: 'calc(var(--rail) + 1.25rem)', zIndex: 10 }}>
          <svg className="i">
            <use href="#al" />
          </svg>
        </button>
        <div className="brand">
          <span className="logo">M</span>
          <span>Mad<b>Hata</b></span>
        </div>
      </header>

      <div className="info" style={{ padding: '2rem var(--g) 2.4rem calc(var(--rail) + var(--g))' }}>
        <h1 className="rv" style={{ ['--n' as string]: 1, textTransform: 'uppercase' }}>
          {isLoading ? <span className="skeleton sk-title" /> : heroTitle}
        </h1>
        <div className="meta rv" style={{ ['--n' as string]: 2 }}>
          {isLoading ? (
            <span className="skeleton sk-meta" />
          ) : (
            <>
              <span>TV-MA</span>
              <span>{heroYear}</span>
              <span>HDR</span>
              <span className="chip" style={{ background: 'rgba(91, 78, 232, 0.3)', borderColor: 'rgba(143, 134, 255, 0.4)' }}>
                HD
              </span>
              <span className="chip">
                {activeMedia?.downloads?.length ? `${activeMedia.downloads.length} Episodes / Links` : 'Streaming'}
              </span>
            </>
          )}
        </div>
        <div className="desc-container rv" style={{ ['--n' as string]: 3 }}>
          <p className={`desc ${showFullSynopsis ? 'full' : 'clamped'}`}>
            {isLoading ? <span className="skeleton sk-desc" /> : heroSynopsis}
          </p>
          {!isLoading && heroSynopsis.length > 180 && (
            <button 
              className="read-more"
              onClick={() => setShowFullSynopsis(!showFullSynopsis)}
              style={{ color: 'var(--acc)', fontSize: '0.85rem', fontWeight: 600, marginTop: '0.4rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative', zIndex: 10 }}
            >
              {showFullSynopsis ? 'Show less' : 'Read more...'}
            </button>
          )}
        </div>
        <div className="acts rv" style={{ ['--n' as string]: 4 }}>
          <button className="go" id="go" onClick={onResumeClick} disabled={isLoading}>
            <svg className="i">
              <use href="#play" />
            </svg>
            <span>
              <b id="gl">{actionLabel}</b>
              <small id="gs">{subtitle}</small>
            </span>
          </button>
          <button className="b" aria-label="Playlist">
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
            onClick={handleDownloadMovie} 
            title={isDownloading ? `Downloading: ${Math.round(dlProgress * 100)}%` : "Download Video"}
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
        <div className="now rv" style={{ ['--n' as string]: 5 }}>
          <div className="bar">
            <i id="nb" style={{ ['--p' as string]: p }} />
          </div>
          <span id="nt">{nowText}</span>
        </div>
      </div>
    </section>
  );
};

