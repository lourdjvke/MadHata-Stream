import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEASONS_DATA } from '../data/movieDetailsData.ts';
import { MediaItem, MediaDownload } from '../utils/mediaWorkerApi.ts';
import { subscribeThumbnails } from '../utils/thumbnailGenerator.ts';
import { decodeHtmlEntities, extractSeasonInfo, getWatchedEp } from '../utils/textUtils.ts';
import { auth } from '../firebase.ts';
import { recordDownload } from '../utils/userDataService.ts';
import { opfsService } from '../utils/opfsService.ts';

interface EpisodesSectionProps {
  currentEpisode: [number, number];
  onSelectEpisode: (seasonIdx: number, episodeIdx: number) => void;
  onPlayEpisode?: (seasonIdx: number, episodeIdx: number) => void;
  activeMedia?: MediaItem | null;
}

export const EpisodesSection: React.FC<EpisodesSectionProps> = ({
  currentEpisode,
  onSelectEpisode,
  onPlayEpisode,
  activeMedia,
}) => {
  const navigate = useNavigate();
  const [selectedSeason, setSelectedSeason] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    return subscribeThumbnails((data) => {
      if (data.episodes.length > 0) {
        setThumbnails([...data.episodes]);
      }
    });
  }, []);

  // Intersection observer to animate entrance and ring completion
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
          setTimeout(() => {
            setIsReady(true);
          }, 450);
        }
      },
      { threshold: 0.1 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Season detection from title / URL
  const seasonInfo = extractSeasonInfo(activeMedia?.title || '', activeMedia?.url);
  const hasRealDownloads = Array.isArray(activeMedia?.downloads) && activeMedia!.downloads!.length > 0;
  
  // Available season tabs list
  const seasonTabs = seasonInfo.seasonNumber
    ? [seasonInfo.seasonLabel]
    : hasRealDownloads
    ? ['Season 1']
    : SEASONS_DATA.map((_, idx) => `Season ${idx + 1}`);

  const mediaId = activeMedia?.id || activeMedia?.slug || '';
  const lastWatchedEp = mediaId ? getWatchedEp(mediaId) : -1;

  const staticEpisodes = SEASONS_DATA[selectedSeason] || [];

  const episodeList = hasRealDownloads
    ? activeMedia!.downloads!.map((dl: MediaDownload, idx: number) => {
        const decodedLabel = decodeHtmlEntities(dl.label || `Episode ${idx + 1}`);
        const isWatched = lastWatchedEp >= 0 && idx < lastWatchedEp;
        const isCurrentWatched = lastWatchedEp >= 0 && idx === lastWatchedEp;
        const progress = isWatched ? 1 : isCurrentWatched ? 0.5 : 0;
        return {
          title: decodedLabel,
          duration: 50,
          progress,
          downloadUrl: dl.url,
          quality: dl.quality || 'HD',
          size: dl.size_human || '',
        };
      })
    : staticEpisodes.map(([t, m, p]: [string, number, number], idx: number) => {
        const isWatched = lastWatchedEp >= 0 && idx < lastWatchedEp;
        const isCurrentWatched = lastWatchedEp >= 0 && idx === lastWatchedEp;
        const progress = isWatched ? 1 : isCurrentWatched ? 0.5 : 0;
        return {
          title: decodeHtmlEntities(t),
          duration: m,
          progress,
          downloadUrl: activeMedia?.url || '',
          quality: 'HD',
          size: '',
        };
      });

  const fractionWatched = episodeList.reduce((acc: number, ep: { progress: number }) => acc + ep.progress, 0) / (episodeList.length || 1);
  const episodesWatchedCount = episodeList.filter((ep: { progress: number }) => ep.progress >= 1).length;
  const minutesWatched = Math.round(episodeList.reduce((acc: number, ep: { duration: number; progress: number }) => acc + ep.duration * ep.progress, 0));

  const strokeDashoffset = isReady ? (113.1 * (1 - fractionWatched)).toFixed(1) : 113.1;
  const percentageText = `${Math.round(fractionWatched * 100)}%`;
  const summaryA = `${episodesWatchedCount} of ${episodeList.length} episodes watched`;
  const activeSeasonName = seasonTabs[selectedSeason] || seasonTabs[0] || 'Season 1';
  const summaryB = minutesWatched
    ? `${Math.floor(minutesWatched / 60)}h ${minutesWatched % 60}m watched`
    : `${activeSeasonName} (${episodeList.length} episodes)`;

  const [activeDownloads, setActiveDownloads] = useState<any[]>([]);

  useEffect(() => {
    const unsub = opfsService.subscribe((active) => {
      setActiveDownloads(active);
    });
    return unsub;
  }, []);

  const handleDownloadEpisode = async (e: React.MouseEvent, url: string, title: string) => {
    e.stopPropagation();
    const mediaTitle = activeMedia?.cleanTitle || activeMedia?.title || 'Series';
    const mediaId = activeMedia?.id || activeMedia?.slug || mediaTitle;

    if (opfsService.isDownloading(mediaId)) return;

    try {
      await opfsService.startDownload({
        id: mediaId,
        title: mediaTitle,
        type: 'series',
        url: url,
        posterUrl: activeMedia?.poster,
        quality: 'HD',
        sub: title,
        label: `S${selectedSeason + 1}`,
        sizeMb: 520,
        year: String(activeMedia?.year || '2026'),
        synopsis: activeMedia?.synopsis
      });

      if (auth.currentUser?.uid) {
        recordDownload(auth.currentUser.uid, {
          id: `${activeMedia?.id || activeMedia?.cleanTitle || 'ep'}_${title}`,
          title: `${mediaTitle} - ${title}`,
          url,
        });
      }
    } catch (err: any) {
      alert(err?.message || 'Storage limit exceeded! Unable to start download.');
    }
  };

  return (
    <section className="sec" id="episodes" ref={sectionRef}>
      <style>{`
        @keyframes dl-spin { to { transform: rotate(360deg); } }
        .dl-spinner { animation: dl-spin 1s linear infinite; }
      `}</style>
      <div className="eh">
        <div>
          <h2>Episodes ({episodeList.length})</h2>
          <div className="tabs" id="tabs" role="tablist">
            {seasonTabs.map((seasonLabel, idx) => (
              <button
                key={idx}
                role="tab"
                className={idx === selectedSeason ? 'on' : ''}
                onClick={() => setSelectedSeason(idx)}
              >
                {seasonLabel}
              </button>
            ))}
          </div>
        </div>

        <div className="sum">
          <div className="ring">
            <svg viewBox="0 0 40 40">
              <circle className="t" cx="20" cy="20" r="18" />
              <circle
                className="v"
                id="rv"
                cx="20"
                cy="20"
                r="18"
                style={{ strokeDashoffset: Number(strokeDashoffset) }}
              />
            </svg>
            <span id="rp">{percentageText}</span>
          </div>
          <div>
            <b id="sa">{summaryA}</b>
            <span id="sb">{summaryB}</span>
          </div>
        </div>
      </div>

      <div className="eps" id="eps">
        {episodeList.map((ep: { title: string; duration: number; progress: number; downloadUrl: string; quality: string; size: string }, i: number) => {
          const isCurrent = currentEpisode[0] === selectedSeason && currentEpisode[1] === i;
          const left = Math.round(ep.duration * (1 - ep.progress));
          const thumbKey = (i + selectedSeason * 2) % 6;
          // Prefer active posterartwork or thumbnail generator frame
          const thumbUrl = activeMedia?.poster || thumbnails[thumbKey];

          const isDownloading = activeDownloads.some(d => d.mediaId === (activeMedia?.id || activeMedia?.slug || activeMedia?.title) && (d.sub === ep.title || d.l === `S${selectedSeason + 1}:E${i + 1}`));
          const dlItem = activeDownloads.find(d => d.mediaId === (activeMedia?.id || activeMedia?.slug || activeMedia?.title) && (d.sub === ep.title || d.l === `S${selectedSeason + 1}:E${i + 1}`));
          const dlProgress = dlItem ? dlItem.p : 0;

          return (
            <button
              key={`${ep.title}-${i}`}
              className={`ep ${isCurrent ? 'on' : ''}`}
              style={{
                ['--i' as string]: i,
                ['--p' as string]: ep.progress,
              }}
              data-i={i}
              onClick={() => onSelectEpisode(selectedSeason, i)}
            >
              <span
                className="th"
                data-k={thumbKey}
                style={thumbUrl ? { backgroundImage: `url(${thumbUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >
                {ep.progress > 0 && (
                  <span className="pb">
                    <i />
                  </span>
                )}
                {ep.progress >= 1 && (
                  <svg className="i ck">
                    <use href="#ck" />
                  </svg>
                )}
                {isCurrent && (
                  <span className="eq">
                    <b />
                    <b />
                    <b />
                  </span>
                )}
                <span
                  className="pl"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onPlayEpisode) {
                      onPlayEpisode(selectedSeason, i);
                    } else {
                      navigate('/watch');
                    }
                  }}
                >
                  <svg className="i">
                    <use href="#play" />
                  </svg>
                </span>
              </span>

              <span className="tx" style={{ flex: 1, minWidth: 0 }}>
                <small>
                  E{i + 1} · {ep.quality} {ep.size ? `· ${ep.size}` : ''}
                </small>
                <b>{ep.title}</b>
                <em>
                  {ep.progress >= 1 ? 'Watched' : ep.progress > 0 ? `${left}m left` : 'Available to stream'}
                </em>
              </span>

              {/* Episode Download Icon Button */}
              {ep.downloadUrl && (
                <span
                  className="b"
                  title={isDownloading ? `Downloading: ${Math.round(dlProgress * 100)}%` : `Download ${ep.title}`}
                  onClick={(e) => handleDownloadEpisode(e, ep.downloadUrl, ep.title)}
                  style={{
                    width: '2.4rem',
                    height: '2.4rem',
                    borderRadius: '50%',
                    background: isDownloading ? 'rgba(91, 78, 232, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '.4rem',
                    flexShrink: 0,
                    position: 'relative',
                    overflow: 'hidden',
                    border: isDownloading ? '1px solid var(--acc)' : 'none'
                  }}
                >
                  {isDownloading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'var(--acc)', opacity: 0.15, transformOrigin: 'left', transform: `scaleX(${dlProgress})` }} />
                  )}
                  <svg className={`i ${isDownloading ? 'dl-spinner' : ''}`} style={{ width: '1.1rem', height: '1.1rem', color: isDownloading ? 'var(--acc)' : 'inherit' }}>
                    <use href={isDownloading ? "#gear" : "#dl"} />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

