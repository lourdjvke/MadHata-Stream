import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import Hls from 'hls.js';
import { auth } from '../firebase.ts';
import { trackSearchQuery, trackShortsView } from '../utils/analyticsTracker.ts';
import '../styles/shorts.css';

interface DramaItem {
  slug: string;
  title: string;
  poster?: string;
}

interface EpisodeDownload {
  label?: string;
  stream_url: string;
  format?: string;
}

interface DramaDetails {
  synopsis?: string;
  downloads?: EpisodeDownload[];
}

const API_BASE = 'https://chartdrama-api.levity-build.workers.dev';

export const ShortsPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [feedItems, setFeedItems] = useState<DramaItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [detailsCache, setDetailsCache] = useState<Record<string, DramaDetails>>({});
  const [activeEpIndex, setActiveEpIndex] = useState<Record<string, number>>({});
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoNextActive, setAutoNextActive] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMsg, setLoadingMsg] = useState<string>('Loading trending dramas...');
  const [expandedSynopsis, setExpandedSynopsis] = useState<Record<string, boolean>>({});
  const [episodesOverlayOpen, setEpisodesOverlayOpen] = useState<Record<string, boolean>>({});
  const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});
  const [watchlist, setWatchlist] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('madhata_watchlist');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Refs
  const feedRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const hlsInstanceRef = useRef<Hls | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const sectionRefs = useRef<Record<number, HTMLElement | null>>({});

  // Helper API fetch
  const getJson = async (path: string) => {
    const res = await fetch(API_BASE + path);
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  };

  // Stop video playback and cleanup Hls
  const stopActiveVideo = useCallback(() => {
    if (hlsInstanceRef.current) {
      hlsInstanceRef.current.destroy();
      hlsInstanceRef.current = null;
    }
    Object.values(videoRefs.current).forEach((video) => {
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    });
  }, []);

  // Play video stream
  const playEpisodeStream = useCallback(
    (video: HTMLVideoElement, url: string, format?: string, startMuted = true) => {
      stopActiveVideo();
      video.muted = startMuted;

      if (format !== 'mp4' && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsInstanceRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!isSearchOpen) {
            video.play().catch(() => {});
          }
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                break;
            }
          }
        });
      } else {
        video.src = url;
        if (!isSearchOpen) {
          video.play().catch(() => {});
        }
      }
    },
    [isSearchOpen, stopActiveVideo]
  );

  // Load drama details and play episode
  const loadAndPlayDrama = useCallback(
    async (idx: number, items: DramaItem[]) => {
      const item = items[idx];
      if (!item) return;

      const video = videoRefs.current[idx];
      if (!video) return;

      let details = detailsCache[item.slug];
      if (!details) {
        try {
          const data = await getJson('/details?slug=' + encodeURIComponent(item.slug));
          details = {
            synopsis: data.synopsis || 'No description available.',
            downloads: data.downloads || [],
          };
          setDetailsCache((prev) => ({ ...prev, [item.slug]: details }));
        } catch {
          details = {
            synopsis: 'Details unavailable for this drama.',
            downloads: [],
          };
          setDetailsCache((prev) => ({ ...prev, [item.slug]: details }));
        }
      }

      const epIdx = activeEpIndex[item.slug] || 0;
      if (details.downloads && details.downloads.length > 0) {
        const ep = details.downloads[epIdx] || details.downloads[0];
        playEpisodeStream(video, ep.stream_url, ep.format, muted);
      }

      // Track short view in RTDB
      trackShortsView(item.slug, 15, false, false, item.title, auth.currentUser?.uid || undefined);
    },
    [activeEpIndex, detailsCache, muted, playEpisodeStream]
  );

  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Fetch Trending feed
  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setLoadingMsg('Loading trending dramas...');
    const targetSlug = (location.state as any)?.slug || searchParams.get('slug');

    try {
      const data = await getJson('/trending');
      let itemsList: DramaItem[] = data.results || [];

      if (targetSlug && itemsList.length > 0) {
        const existingIdx = itemsList.findIndex((it) => it.slug === targetSlug);
        if (existingIdx > 0) {
          const [found] = itemsList.splice(existingIdx, 1);
          itemsList.unshift(found);
        } else if (existingIdx === -1) {
          try {
            const detailData = await getJson('/details?slug=' + encodeURIComponent(targetSlug));
            if (detailData) {
              itemsList.unshift({
                slug: targetSlug,
                title: detailData.title || targetSlug,
                poster: detailData.poster || '',
              });
            }
          } catch {}
        }
      }

      if (itemsList.length > 0) {
        setFeedItems(itemsList);
        setCurrentIdx(0);
      } else {
        setFeedItems([]);
      }
    } catch (err: unknown) {
      console.error(err);
      setFeedItems([]);
    } finally {
      setLoading(false);
    }
  }, [location.state, searchParams]);

  // Search handler
  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    trackSearchQuery(query.trim(), auth.currentUser?.uid || undefined);
    setLoading(true);
    setLoadingMsg(`Searching for "${query}"...`);
    try {
      const data = await getJson('/search?q=' + encodeURIComponent(query));
      if (data.results && data.results.length) {
        setFeedItems(data.results);
        setCurrentIdx(0);
        closeSearch();
        if (feedRef.current) {
          feedRef.current.scrollTop = 0;
        }
      } else {
        alert(`No results found for "${query}"`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert('Search failed: ' + message);
    } finally {
      setLoading(false);
    }
  };

  // Top right button click (Search or Exit Auto-Next mode)
  const handleTopRightButtonClick = () => {
    if (autoNextActive) {
      setAutoNextActive(false);
    } else {
      openSearch();
    }
  };

  const openSearch = () => {
    setIsSearchOpen(true);
    stopActiveVideo();
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 300);
  };

  const closeSearch = () => {
    setIsSearchOpen(false);
    searchInputRef.current?.blur();
    // Resume current video
    if (feedItems[currentIdx]) {
      loadAndPlayDrama(currentIdx, feedItems);
    }
  };

  // Play / Pause toggle
  const togglePlay = (idx: number) => {
    if (isSearchOpen) return;
    const video = videoRefs.current[idx];
    if (!video) return;

    if (video.paused) {
      video
        .play()
        .then(() => {
          setIsPlaying((prev) => ({ ...prev, [feedItems[idx].slug]: true }));
        })
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying((prev) => ({ ...prev, [feedItems[idx].slug]: false }));
    }
  };

  // Toggle Mute
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMuted = !muted;
    setMuted(newMuted);
    Object.values(videoRefs.current).forEach((vid) => {
      if (vid) vid.muted = newMuted;
    });
  };

  // Toggle Auto Next
  const toggleAutoNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAutoNextActive((prev) => !prev);
  };

  // Toggle Episodes Overlay
  const toggleEpisodesOverlay = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    setEpisodesOverlayOpen((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  // Toggle Synopsis Expand
  const toggleSynopsis = (slug: string) => {
    setExpandedSynopsis((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  // Toggle Watchlist
  const toggleWatchlist = (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    setWatchlist((prev) => {
      const updated = { ...prev, [slug]: !prev[slug] };
      try {
        localStorage.setItem('madhata_watchlist', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Handle Video Ended (Auto-Next logic)
  const handleVideoEnded = (slug: string, idx: number) => {
    if (!autoNextActive) return;

    const details = detailsCache[slug];
    const episodes = details?.downloads || [];
    const curEp = activeEpIndex[slug] || 0;
    const nextEp = curEp + 1;

    if (nextEp < episodes.length) {
      // Play next episode of the current drama
      setActiveEpIndex((prev) => ({ ...prev, [slug]: nextEp }));
      const video = videoRefs.current[idx];
      if (video) {
        playEpisodeStream(video, episodes[nextEp].stream_url, episodes[nextEp].format, muted);
      }
    } else if (idx < feedItems.length - 1) {
      // Scroll smoothly to next drama in feed
      const nextIdx = idx + 1;
      setCurrentIdx(nextIdx);
      sectionRefs.current[nextIdx]?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Select specific episode from carousel
  const handleSelectEpisode = (e: React.MouseEvent, slug: string, epIndex: number, idx: number) => {
    e.stopPropagation();
    setActiveEpIndex((prev) => ({ ...prev, [slug]: epIndex }));
    const details = detailsCache[slug];
    if (details?.downloads && details.downloads[epIndex]) {
      const ep = details.downloads[epIndex];
      const video = videoRefs.current[idx];
      if (video) {
        playEpisodeStream(video, ep.stream_url, ep.format, muted);
      }
    }
  };

  // Mount effect: fetch trending
  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  // Setup Intersection Observer for snapping
  useEffect(() => {
    if (!feedRef.current || feedItems.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.getAttribute('data-index') || '0', 10);
            setCurrentIdx(idx);
            loadAndPlayDrama(idx, feedItems);
          }
        });
      },
      { root: feedRef.current, threshold: 0.6 }
    );

    const sections = feedRef.current.querySelectorAll('.snap-item');
    sections.forEach((sec) => observer.observe(sec));

    return () => {
      observer.disconnect();
      stopActiveVideo();
    };
  }, [feedItems, loadAndPlayDrama, stopActiveVideo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSearchOpen) {
        if (e.key === 'Escape') closeSearch();
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        if (currentIdx < feedItems.length - 1) {
          const nextIdx = currentIdx + 1;
          setCurrentIdx(nextIdx);
          sectionRefs.current[nextIdx]?.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        if (currentIdx > 0) {
          const prevIdx = currentIdx - 1;
          setCurrentIdx(prevIdx);
          sectionRefs.current[prevIdx]?.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        togglePlay(currentIdx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, currentIdx, feedItems]);

  return (
    <div className="shorts-root">
      {/* Desktop & Smart TV Centered Phone Container */}
      <main
        id="app-container"
        className={`viewport-container relative w-full max-w-md h-screen md:h-[90vh] md:max-h-[850px] bg-black md:rounded-3xl shadow-2xl overflow-hidden border border-gray-800 flex flex-col justify-center ${
          autoNextActive ? 'auto-next-mode' : ''
        } ${isSearchOpen ? 'search-active' : ''}`}
      >
        {/* Back to Home / App Button */}
        <button
          onClick={() => navigate('/')}
          className="absolute top-4 left-4 bg-black/40 hover:bg-black/70 backdrop-blur-md text-white text-xs px-3.5 py-2 rounded-full z-30 transition-all active:scale-95 border border-white/10 cursor-pointer flex items-center gap-1.5"
          title="Back to MadHata"
        >
          <i className="fa-solid fa-arrow-left text-[11px]"></i>
          <span className="hidden sm:inline font-medium">Back</span>
        </button>

        {/* SEARCH / EXIT MODE BUTTON TOP BADGE */}
        <button
          id="search-btn"
          onClick={handleTopRightButtonClick}
          className={`absolute top-4 right-4 backdrop-blur-md text-white text-xs px-4 py-2 rounded-full z-30 transition-all active:scale-95 border cursor-pointer flex items-center gap-1.5 ${
            isSearchOpen ? 'hidden' : ''
          } ${
            autoNextActive
              ? 'bg-teal-600/80 border-teal-400 hover:bg-teal-600'
              : 'bg-black/40 hover:bg-black/70 border-white/10'
          }`}
        >
          <i
            id="search-btn-icon"
            className={`${autoNextActive ? 'fa-solid fa-compress' : 'fa-solid fa-magnifying-glass'} text-[10px]`}
          ></i>
          <span id="search-btn-text">{autoNextActive ? 'Exit mode' : 'Search'}</span>
        </button>

        {/* Loading Indicator Overlay */}
        <div
          id="loading-overlay"
          className={`absolute inset-0 bg-black/80 backdrop-blur-sm z-40 flex flex-col items-center justify-center transition-opacity duration-300 ${
            loading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p id="loading-text" className="text-xs text-gray-300 font-medium">
            {loadingMsg}
          </p>
        </div>

        {/* ================= TIKTOK VIDEO FEED VIEW ================= */}
        <div id="feed-view" className="feed-view absolute inset-0 w-full h-full z-10">
          <div ref={feedRef} id="feed" className="snap-container no-scrollbar w-full h-full overflow-y-scroll relative">
            {feedItems.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                <i className="fa-solid fa-video-slash text-4xl mb-3 opacity-40"></i>
                <p>No dramas found.</p>
                <button
                  onClick={fetchTrending}
                  className="mt-4 px-4 py-2 bg-teal-600 text-white text-xs rounded-xl hover:bg-teal-500 transition-colors cursor-pointer"
                >
                  Reload Trending
                </button>
              </div>
            )}

            {feedItems.map((item, idx) => {
              const details = detailsCache[item.slug];
              const episodes = details?.downloads || [];
              const curEpIdx = activeEpIndex[item.slug] || 0;
              const isSynopsisExpanded = expandedSynopsis[item.slug];
              const isEpOverlayOpen = episodesOverlayOpen[item.slug];
              const isInWatchlist = watchlist[item.slug];
              const playing = isPlaying[item.slug] ?? false;

              return (
                <section
                  key={`${item.slug}-${idx}`}
                  ref={(el) => {
                    sectionRefs.current[idx] = el;
                  }}
                  className="snap-item relative w-full h-full flex-shrink-0 bg-black overflow-hidden flex items-center justify-center"
                  data-index={idx}
                  data-slug={item.slug}
                >
                  <video
                    ref={(el) => {
                      videoRefs.current[idx] = el;
                    }}
                    className="video-player w-full h-full object-cover cursor-pointer"
                    loop
                    playsInline
                    muted={muted}
                    crossOrigin="anonymous"
                    poster={item.poster || ''}
                    onClick={() => togglePlay(idx)}
                    onPlay={() => setIsPlaying((p) => ({ ...p, [item.slug]: true }))}
                    onPause={() => setIsPlaying((p) => ({ ...p, [item.slug]: false }))}
                    onEnded={() => handleVideoEnded(item.slug, idx)}
                  />

                  {/* Play / Pause overlay */}
                  <div
                    className={`play-overlay absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 pointer-events-none z-10 ${
                      playing ? 'opacity-0' : 'opacity-100'
                    }`}
                  >
                    <i className="fa-solid fa-play text-white/80 text-6xl drop-shadow-lg"></i>
                  </div>

                  {/* Bottom Content Info */}
                  <div className="bottom-overlay absolute bottom-6 left-4 right-4 z-20 text-white pointer-events-none drop-shadow-md">
                    <h2 className="text-base font-bold tracking-wide flex items-center gap-2">
                      @{item.title}
                    </h2>

                    <div
                      className={`synopsis-container mt-1 text-xs text-gray-200 transition-all duration-300 pointer-events-auto ${
                        isSynopsisExpanded ? 'line-clamp-none max-h-36 overflow-y-auto' : 'line-clamp-2 max-h-12 overflow-hidden'
                      }`}
                    >
                      <span className="synopsis-text">
                        {details?.synopsis || 'Fetching details...'}
                      </span>
                    </div>

                    {details?.synopsis && details.synopsis.length > 80 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSynopsis(item.slug);
                        }}
                        className="toggle-synopsis text-[10px] text-teal-400 font-semibold uppercase mt-0.5 pointer-events-auto cursor-pointer block"
                      >
                        {isSynopsisExpanded ? 'Less' : 'More'}
                      </button>
                    )}

                    {/* Inline Episode Carousel Overlay */}
                    <div
                      className={`episodes-overlay mt-3 pt-2 border-t border-white/10 pointer-events-auto ${
                        isEpOverlayOpen ? 'block' : 'hidden'
                      }`}
                    >
                      <p className="text-[10px] uppercase font-bold tracking-wider text-teal-400 mb-1.5 flex items-center justify-between">
                        <span>Episodes</span>
                        <span className="episodes-count text-gray-400 font-normal">
                          {episodes.length} ep
                        </span>
                      </p>
                      <div className="episodes-carousel flex gap-2 overflow-x-auto no-scrollbar py-1">
                        {episodes.length > 0 ? (
                          episodes.map((ep, i) => (
                            <button
                              key={i}
                              onClick={(e) => handleSelectEpisode(e, item.slug, i, idx)}
                              className={`ep-chip flex-shrink-0 px-3 py-1.5 rounded-lg border text-white text-xs transition-colors cursor-pointer ${
                                i === curEpIdx
                                  ? 'bg-teal-600 border-teal-400 font-bold'
                                  : 'bg-white/10 border-white/15 hover:bg-teal-600'
                              }`}
                              data-index={i}
                            >
                              {ep.label || `Ep ${i + 1}`}
                            </button>
                          ))
                        ) : (
                          <div className="text-xs text-gray-400 italic">
                            {details ? 'No streamable episodes.' : 'Loading episodes...'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Floating Glassmorphic Action Icons */}
                    <div className="flex items-center gap-3 mt-3 pointer-events-auto">
                      <button
                        onClick={(e) => toggleWatchlist(e, item.slug)}
                        className={`action-plus w-10 h-10 rounded-full backdrop-blur-sm border flex items-center justify-center text-white active:scale-95 transition-all shadow-lg cursor-pointer ${
                          isInWatchlist
                            ? 'bg-teal-600/90 border-teal-400 text-white'
                            : 'bg-white/10 border-white/20 hover:bg-white/20'
                        }`}
                        title={isInWatchlist ? 'In Watchlist' : 'Add to list'}
                      >
                        <i
                          className={`fa-solid ${
                            isInWatchlist ? 'fa-check text-white' : 'fa-plus'
                          } text-sm`}
                        ></i>
                      </button>

                      <button
                        onClick={toggleAutoNext}
                        className={`action-autonext w-10 h-10 rounded-full backdrop-blur-sm border flex items-center justify-center text-white active:scale-95 transition-all shadow-lg cursor-pointer ${
                          autoNextActive
                            ? 'bg-teal-600 border-teal-400'
                            : 'bg-white/10 border-white/20 hover:bg-white/20'
                        }`}
                        title="Toggle Auto Next Episode"
                      >
                        <i className="fa-solid fa-arrows-up-down text-sm"></i>
                      </button>

                      <button
                        onClick={(e) => toggleEpisodesOverlay(e, item.slug)}
                        className={`action-episodes w-10 h-10 rounded-full backdrop-blur-sm border flex items-center justify-center text-white active:scale-95 transition-all shadow-lg cursor-pointer ${
                          isEpOverlayOpen
                            ? 'bg-teal-600 border-teal-400'
                            : 'bg-white/10 border-white/20 hover:bg-white/20'
                        }`}
                        title="Toggle Episodes Carousel"
                      >
                        <i className="fa-solid fa-tv text-sm"></i>
                      </button>

                      <button
                        onClick={toggleMute}
                        className={`action-mute w-10 h-10 rounded-full backdrop-blur-sm border flex items-center justify-center text-white active:scale-95 transition-all shadow-lg hover:bg-white/20 cursor-pointer ${
                          !muted ? 'bg-teal-600/50 border-teal-400' : 'bg-white/10 border-white/20'
                        }`}
                        title={muted ? 'Unmute' : 'Mute'}
                      >
                        <i
                          className={`fa-solid ${
                            muted ? 'fa-volume-xmark' : 'fa-volume-high'
                          } text-sm mute-icon`}
                        ></i>
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* ================= SEARCH PAGE VIEW ================= */}
        <div
          id="search-view"
          className="search-view absolute inset-0 w-full h-full bg-gray-900 p-6 flex flex-col justify-between z-20"
        >
          <div className="mt-10">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-white">Search</h1>
              <button
                id="close-search-btn"
                onClick={closeSearch}
                className="text-gray-400 hover:text-white text-sm px-3 py-1 rounded-full bg-white/5 border border-white/10 cursor-pointer transition-colors"
              >
                Back
              </button>
            </div>

            <form
              id="search-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch(searchQuery);
              }}
            >
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="search"
                  id="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dramas (e.g. CEO, love)..."
                  className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-400 text-sm rounded-xl pl-4 pr-10 py-3 focus:outline-none focus:border-teal-500 transition-colors"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-3 text-gray-400 hover:text-teal-400 cursor-pointer transition-colors"
                >
                  <i className="fa-solid fa-magnifying-glass"></i>
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-3">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                Quick Searches
              </p>
              <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                {['CEO', 'Revenge', 'Love', 'Secret'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setSearchQuery(tag);
                      handleSearch(tag);
                    }}
                    className="tag-btn bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg border border-gray-700/50 cursor-pointer transition-colors active:scale-95"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-center text-gray-500 mb-2">
            Press Enter or search button to load results into feed
          </p>
        </div>
      </main>
    </div>
  );
};
