import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { NavigationRail } from '../components/NavigationRail.tsx';
import { SearchHeader } from '../components/SearchHeader.tsx';
import {
  CATEGORIES,
  CategoryDef,
  MediaItem,
  searchMediaWorker,
  fetchCategoryFeed,
  storeActiveMedia,
  formatMediaTitle,
} from '../utils/mediaWorkerApi.ts';
import { useDraggableRow } from '../hooks/useDraggableRow.ts';
import { decodeHtmlEntities } from '../utils/textUtils.ts';

const DEFAULT_RECENT: string[] = [];

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [categoryPosters, setCategoryPosters] = useState<Record<string, string>>({});
  const [recentReleases, setRecentReleases] = useState<MediaItem[]>([]);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('madhata-recent') || localStorage.getItem('slothui-recent');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_RECENT;
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const trendingRowRef = useDraggableRow<HTMLDivElement>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load category posters and recent releases on mount
  useEffect(() => {
    let isMounted = true;

    CATEGORIES.forEach(async (cat) => {
      try {
        const data = await fetchCategoryFeed(cat.slug, 1);
        if (isMounted && data.results && data.results.length > 0) {
          const poster = data.results[0].poster;
          if (poster && !poster.includes('unsplash')) {
            setCategoryPosters((prev) => ({ ...prev, [cat.slug]: poster }));
          }
        }
      } catch {
        // ignore
      }
    });

    fetchCategoryFeed('latest', 1)
      .then((data) => {
        if (isMounted && data.results) {
          setRecentReleases(data.results.slice(0, 10));
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync recent searches with localStorage
  const saveRecent = useCallback((items: string[]) => {
    setRecentSearches(items);
    try {
      localStorage.setItem('madhata-recent', JSON.stringify(items));
    } catch {
      // ignore
    }
  }, []);

  const pushRecent = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      const filtered = recentSearches.filter(
        (x) => x.toLowerCase() !== trimmed.toLowerCase()
      );
      const updated = [trimmed, ...filtered].slice(0, 8);
      saveRecent(updated);
    },
    [recentSearches, saveRecent]
  );

  const removeRecent = useCallback(
    (idx: number) => {
      const updated = recentSearches.filter((_, i) => i !== idx);
      saveRecent(updated);
    },
    [recentSearches, saveRecent]
  );

  const clearAllRecent = useCallback(() => {
    saveRecent([]);
  }, [saveRecent]);

  // Execute worker search
  const executeSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setActiveCategory(null);
    setIsSearching(true);
    setErrorText(null);
    setStatusText(`Searching for "${trimmed}"...`);

    try {
      const data = await searchMediaWorker(trimmed, ac.signal);
      if (!data.results || data.results.length === 0) {
        setMediaItems([]);
        setStatusText(`No search results for "${trimmed}".`);
      } else {
        setMediaItems(data.results);
        setStatusText(`Found ${data.results.length} results for "${trimmed}".`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const msg = err?.message || 'Search failed';
      setErrorText(msg);
      setStatusText(`Search error: ${msg}`);
      setMediaItems([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Execute category load
  const loadCategory = useCallback(async (catSlug: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    setActiveCategory(catSlug);
    setQ('');
    if (inputRef.current) inputRef.current.value = '';
    setIsSearching(true);
    setErrorText(null);
    setStatusText(`Loading ${catSlug}...`);

    try {
      const data = await fetchCategoryFeed(catSlug, 1, ac.signal);
      if (!data.results || data.results.length === 0) {
        setMediaItems([]);
        setStatusText(`No items found in category "${catSlug}".`);
      } else {
        setMediaItems(data.results);
        setStatusText(`Displaying ${data.results.length} items in category "${catSlug}".`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      const msg = err?.message || 'Failed to load category';
      setErrorText(msg);
      setStatusText(`Category load error: ${msg}`);
      setMediaItems([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Read URL query parameters on mount or change
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const catParam = params.get('category');
    const qParam = params.get('q');

    if (catParam) {
      loadCategory(catParam);
    } else if (qParam) {
      setQ(qParam);
      if (inputRef.current) inputRef.current.value = qParam;
      executeSearch(qParam);
    }
  }, [location.search, loadCategory, executeSearch]);

  const handleSelectQuery = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      setQ(trimmed);
      if (inputRef.current) {
        inputRef.current.value = trimmed;
        inputRef.current.focus({ preventScroll: true });
      }
      executeSearch(trimmed);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [executeSearch]
  );

  const handleClearQuery = useCallback(() => {
    setQ('');
    setActiveCategory(null);
    setMediaItems([]);
    setStatusText('');
    setErrorText(null);
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus({ preventScroll: true });
    }
  }, []);

  const handleCategoryClick = useCallback(
    (catSlug: string) => {
      if (activeCategory === catSlug) {
        handleClearQuery();
      } else {
        loadCategory(catSlug);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [activeCategory, handleClearQuery, loadCategory]
  );

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const queryVal = inputRef.current?.value.trim() || q.trim();
    if (queryVal) {
      setQ(queryVal);
      pushRecent(queryVal);
      executeSearch(queryVal);
    }
  };

  const handleCardClick = (item: MediaItem) => {
    storeActiveMedia(item);
    const mediaUrl = item.url || item.original_url || '';
    const source = item.source || '1';
    if (mediaUrl) {
      navigate(`/details?url=${encodeURIComponent(mediaUrl)}&source=${encodeURIComponent(source)}`);
    } else {
      navigate(`/movie/${encodeURIComponent(item.slug || item.id)}`);
    }
  };

  const isActiveSearch = !!q || !!activeCategory || mediaItems.length > 0 || isSearching;

  // Highlight matched query in title
  const renderHighlightedTitle = useCallback(
    (title: string) => {
      if (!q) return title;
      const idx = title.toLowerCase().indexOf(q.toLowerCase());
      if (idx === -1) return title;
      const before = title.slice(0, idx);
      const match = title.slice(idx, idx + q.length);
      const after = title.slice(idx + q.length);
      return (
        <>
          {before}
          <mark>{match}</mark>
          {after}
        </>
      );
    },
    [q]
  );

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const inputEl = inputRef.current;

      if (e.key === '/' && activeEl !== inputEl) {
        e.preventDefault();
        inputEl?.focus();
        return;
      }

      if (e.key === 'Escape' && (q || activeCategory || activeEl === inputEl)) {
        handleClearQuery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [q, activeCategory, handleClearQuery]);

  return (
    <>
      <NavigationRail />
      <SearchHeader />

      {/* Sticky Search Bar with Responsive Search Icon Button */}
      <div className="sb rv" style={{ ['--n' as string]: 1 }}>
        <form
          className="search-row"
          onSubmit={handleSearchSubmit}
          style={{ display: 'flex', gap: '.5rem', alignItems: 'center', width: '100%' }}
        >
          <label className="field" style={{ flex: 1, margin: 0 }}>
            <svg className="i">
              <use href="#search" />
            </svg>
            <input
              id="searchInput"
              ref={inputRef}
              type="search"
              placeholder="Search movies, TV series, titles..."
              autoComplete="off"
              enterKeyHint="search"
              aria-label="Search media"
              defaultValue={q}
              onChange={(e) => {
                const val = e.target.value;
                setQ(val);
                if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                if (!val.trim()) {
                  if (!activeCategory) {
                    setMediaItems([]);
                    setStatusText('');
                  }
                  return;
                }
                debounceTimerRef.current = setTimeout(() => {
                  executeSearch(val.trim());
                }, 350);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearchSubmit();
                  inputRef.current?.blur();
                }
              }}
            />
            <button
              type="button"
              className={`clr ${q ? 'show' : ''}`}
              id="clr"
              aria-label="Clear search"
              tabIndex={-1}
              onClick={handleClearQuery}
            >
              <svg className="i">
                <use href="#x" />
              </svg>
            </button>
          </label>

          {/* Search Icon Button (Mobile Responsive) */}
          <button
            type="submit"
            className="search-submit-btn"
            aria-label="Submit search"
            title="Search"
            style={{
              width: '3.7rem',
              height: '3.7rem',
              borderRadius: '50%',
              background: 'var(--acc)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 4px 14px rgba(91, 78, 232, 0.4)',
              transition: 'transform .2s, background .2s',
              cursor: 'pointer',
            }}
          >
            <svg className="i" style={{ width: '1.25rem', height: '1.25rem' }}>
              <use href="#search" />
            </svg>
          </button>
        </form>

        {/* Category Navigation Bar */}
        <div className="flt" style={{ marginTop: '.85rem' }}>
          <div className="chips" id="categoryTabs" role="group" aria-label="Categories">
            {CATEGORIES.map((cat: CategoryDef) => {
              const isOn = activeCategory === cat.slug;
              return (
                <button
                  key={cat.slug}
                  className={isOn ? 'on' : ''}
                  aria-pressed={isOn}
                  onClick={() => handleCategoryClick(cat.slug)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem' }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main>
        {/* Status indicator bar when searching or browsing */}
        {(statusText || isSearching) && (
          <div
            style={{
              padding: '1.2rem 0 .4rem calc(var(--rail) + var(--g))',
              paddingRight: 'var(--g)',
            }}
          >
            <div className="media-status-bar" id="status" style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                {isSearching && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '.75rem',
                      height: '.75rem',
                      borderRadius: '50%',
                      border: '2px solid rgba(143, 134, 255, 0.3)',
                      borderTopColor: '#8f86ff',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                )}
                <span>{statusText}</span>
              </div>
            </div>
          </div>
        )}

        {/* Idle View (Recent, Category shortcuts, Trending) */}
        {!isActiveSearch ? (
          <div id="idle">
            {/* Recent Searches Section */}
            {recentSearches.length > 0 && (
              <section className="sec rv" id="rcsec" style={{ ['--n' as string]: 2 }}>
                <div className="lb">
                  <span>Recent searches</span>
                  <button id="rclr" onClick={clearAllRecent}>
                    Clear all
                  </button>
                </div>
                <div className="rcs" id="rcs">
                  {recentSearches.map((term, i) => (
                    <span key={term + i} className="rc">
                      <button className="rt" onClick={() => handleSelectQuery(term)}>
                        {term}
                      </button>
                      <button
                        className="rx"
                        aria-label={`Remove ${term}`}
                        onClick={() => removeRecent(i)}
                      >
                        <svg className="i">
                          <use href="#x" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Category Quick Browse */}
            <section className="sec rv" style={{ ['--n' as string]: 3 }}>
              <div className="lb">
                <span>Browse by category</span>
              </div>
              <div className="gts" id="gts">
                {CATEGORIES.map((cat, idx) => {
                  const hues = [260, 215, 340, 160, 25, 290, 45];
                  const h = hues[idx % hues.length];
                  const poster = categoryPosters[cat.slug];
                  return (
                    <button
                      key={cat.slug}
                      className="gt"
                      style={{
                        background: poster
                          ? `linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%), url(${poster}) center/cover`
                          : `linear-gradient(135deg, hsl(${h} 65% 44%), hsl(${(h + 30) % 360} 55% 16%))`,
                      }}
                      onClick={() => handleCategoryClick(cat.slug)}
                    >
                      <span style={{ fontSize: '1.2rem', marginBottom: '.3rem', position: 'relative', zIndex: 1 }}>{cat.icon}</span>
                      <span style={{ position: 'relative', zIndex: 1 }}>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Recent released */}
            <section className="sec rv" style={{ ['--n' as string]: 4 }}>
              <div className="lb">
                <span>Recent released</span>
              </div>
              <div className="row" id="trend" ref={trendingRowRef}>
                {recentReleases.length > 0
                  ? recentReleases.map((item, i) => (
                      <button
                        key={item.id || i}
                        className="p"
                        style={{
                          backgroundImage: item.poster ? `url(${item.poster})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                        onClick={() => handleCardClick(item)}
                      >
                        <span>{decodeHtmlEntities(item.cleanTitle || item.title)}</span>
                      </button>
                    ))
                  : ['Carrie (2026)', 'Venom: The Last Dance', 'Gladiator II', 'Heated Rivalry', 'Joker 2'].map((term) => (
                      <button
                        key={term}
                        className="p"
                        onClick={() => handleSelectQuery(term)}
                      >
                        <span>{term}</span>
                      </button>
                    ))}
              </div>
            </section>
          </div>
        ) : (
          /* Results View */
          <section className="sec" id="res">
            {errorText ? (
              <div
                style={{
                  marginRight: 'var(--g)',
                  padding: '1.5rem',
                  borderRadius: '.85rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  marginBottom: '1.5rem',
                }}
              >
                <h4 style={{ color: '#f87171', fontWeight: 700, marginBottom: '.4rem' }}>Search Error</h4>
                <p style={{ color: '#d1d5db', fontSize: '.84rem' }}>{errorText}</p>
                <button
                  onClick={() => q && executeSearch(q)}
                  style={{
                    marginTop: '.8rem',
                    padding: '.45rem .95rem',
                    borderRadius: '.5rem',
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: '.8rem',
                    fontWeight: 600,
                  }}
                >
                  Retry Search
                </button>
              </div>
            ) : mediaItems.length > 0 ? (
              <div className="grid" id="mediaGrid">
                {mediaItems.map((item, idx) => {
                  const { mainTitle, badge } = formatMediaTitle(item.title);
                  return (
                    <button
                      key={`${item.id}-${idx}`}
                      className="sc n"
                      style={{ ['--i' as string]: idx % 14 }}
                      onClick={() => handleCardClick(item)}
                      title={item.title}
                    >
                      <div className="pz">
                        <img
                          src={item.poster}
                          alt={item.title}
                          loading="lazy"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.src.includes('unsplash')) {
                              target.src = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop&q=80';
                            }
                          }}
                        />
                        <div className="pz-grad" />

                        {badge && (
                          <span className="pz-tag">
                            {badge}
                          </span>
                        )}

                        <div className="pz-title-overlay">
                          {renderHighlightedTitle(mainTitle)}
                        </div>
                      </div>

                      <div className="cp">
                        <span style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.year || '2026'}
                        </span>
                        <em>★ {item.rating}</em>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : !isSearching ? (
              /* Empty State */
              <div className="none" id="none">
                <div className="big">
                  <svg className="i">
                    <use href="#search" />
                  </svg>
                </div>
                <h3 id="nt">
                  {q ? `No search results for “${q}”` : 'No media items found'}
                </h3>
                <p>Try a different keyword or browse by category.</p>
                <div className="chips" id="sug" style={{ justifyContent: 'center' }}>
                  {CATEGORIES.slice(0, 5).map((cat) => (
                    <button
                      key={cat.slug}
                      onClick={() => handleCategoryClick(cat.slug)}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        )}
      </main>
    </>
  );
};
