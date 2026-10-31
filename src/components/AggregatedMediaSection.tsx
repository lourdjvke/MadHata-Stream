import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CATEGORIES,
  CategoryDef,
  MediaItem,
  fetchCategoryFeed,
  storeActiveMedia,
  formatMediaTitle,
} from '../utils/mediaWorkerApi.ts';
import { useDraggableRow } from '../hooks/useDraggableRow.ts';

interface AggregatedMediaSectionProps {
  onSeeAllClick?: () => void;
}

const CategoryCarouselRow: React.FC<{
  cat: CategoryDef;
  onCardClick: (item: MediaItem) => void;
  onQuickWatch: (e: React.MouseEvent, item: MediaItem) => void;
}> = ({ cat, onCardClick, onQuickWatch }) => {
  const navigate = useNavigate();
  const rowRef = useDraggableRow<HTMLDivElement>();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchCategoryFeed(cat.slug, 1, signal);
      setItems(data.results || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err?.message || 'Failed to load feed');
    } finally {
      setIsLoading(false);
    }
  }, [cat.slug]);

  useEffect(() => {
    const ac = new AbortController();
    loadFeed(ac.signal);
    return () => ac.abort();
  }, [loadFeed]);

  return (
    <section className="sec rv" style={{ paddingBottom: '1.2rem' }}>
      {/* Category Header */}
      <div className="lb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 'var(--g)', marginBottom: '.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{cat.icon}</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            {cat.label}
          </span>
        </div>

        <button
          className="see"
          onClick={() => navigate(`/search?category=${encodeURIComponent(cat.slug)}`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem', fontSize: '.8rem', color: '#9aa1b4', fontWeight: 600 }}
        >
          <span>See All</span>
          <svg className="i" style={{ width: '.95rem', height: '.95rem' }}>
            <use href="#ar" />
          </svg>
        </button>
      </div>

      {/* Row of Items */}
      {isLoading ? (
        <div className="row" ref={rowRef}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: '0 0 clamp(9.5rem, 13vw, 14rem)',
                aspectRatio: '2/3',
                borderRadius: '.85rem',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
                animation: 'pulse 1.5s infinite alternate',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            />
          ))}
        </div>
      ) : error ? (
        <div style={{ paddingRight: 'var(--g)', margin: '.5rem 0' }}>
          <span style={{ fontSize: '.82rem', color: '#f87171' }}>Unable to load {cat.label}. </span>
          <button
            onClick={() => loadFeed()}
            style={{ fontSize: '.82rem', color: '#8f86ff', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      ) : items.length > 0 ? (
        <div className="row" ref={rowRef}>
          {items.map((item, idx) => {
            const { mainTitle, badge } = formatMediaTitle(item.title);
            return (
              <button
                key={`${item.id}-${idx}`}
                className="sc"
                style={{
                  flex: '0 0 clamp(9.5rem, 13vw, 14rem)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
                onClick={() => onCardClick(item)}
                title={item.title}
              >
                <div className="pz" style={{ width: '100%', aspectRatio: '2/3' }}>
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

                  {/* Badge if present (e.g. Episode X Added) */}
                  {badge && (
                    <span className="pz-tag">
                      {badge}
                    </span>
                  )}

                  <div className="pz-title-overlay">
                    {mainTitle}
                  </div>
                </div>

                <div className="cp" style={{ marginTop: '.6rem' }}>
                  <span style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.year || '2026'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
                    <em>★ {item.rating}</em>
                    <span
                      onClick={(e) => onQuickWatch(e, item)}
                      title="Watch now"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '1.25rem',
                        height: '1.25rem',
                        borderRadius: '50%',
                        background: 'rgba(91, 78, 232, 0.4)',
                        color: '#fff',
                      }}
                    >
                      <svg className="i" style={{ width: '.75rem', height: '.75rem' }}>
                        <use href="#play" />
                      </svg>
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

export const AggregatedMediaSection: React.FC<AggregatedMediaSectionProps> = () => {
  const navigate = useNavigate();

  const handleCardClick = useCallback((item: MediaItem) => {
    storeActiveMedia(item);
    const mediaUrl = item.url || item.original_url || '';
    const source = item.source || '1';
    if (mediaUrl) {
      navigate(`/details?url=${encodeURIComponent(mediaUrl)}&source=${encodeURIComponent(source)}`);
    } else {
      navigate(`/movie/${encodeURIComponent(item.slug || item.id)}`);
    }
  }, [navigate]);

  const handleQuickWatch = useCallback((e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    storeActiveMedia(item);
    const mediaUrl = item.url || item.original_url || '';
    const source = item.source || '1';
    if (mediaUrl) {
      navigate(`/watch?url=${encodeURIComponent(mediaUrl)}&source=${encodeURIComponent(source)}&ep=0`);
    } else {
      navigate(`/watch?title=${encodeURIComponent(item.title)}`);
    }
  }, [navigate]);

  return (
    <div id="mediaCarousels" style={{ marginTop: '1rem' }}>
      {CATEGORIES.map((cat) => (
        <CategoryCarouselRow
          key={cat.slug}
          cat={cat}
          onCardClick={handleCardClick}
          onQuickWatch={handleQuickWatch}
        />
      ))}
    </div>
  );
};
