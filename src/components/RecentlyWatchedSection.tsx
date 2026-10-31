import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dbService, WatchedMedia } from '../utils/db.ts';
import { useDraggableRow } from '../hooks/useDraggableRow.ts';
import { storeActiveMedia } from '../utils/mediaWorkerApi.ts';
import { decodeHtmlEntities } from '../utils/textUtils.ts';

export const RecentlyWatchedSection: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<WatchedMedia[]>([]);
  const rowRef = useDraggableRow<HTMLDivElement>();
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const loadRecent = async () => {
      const list = await dbService.getRecentList();
      setItems(list);
    };
    loadRecent();
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (items.length === 0) return null;

  const handleCardClick = (item: WatchedMedia) => {
    // Reconstruct MediaItem for detail page or direct watch
    const mediaItem = {
      id: item.id,
      title: item.title,
      cleanTitle: item.cleanTitle,
      poster: item.poster,
      url: item.url,
      source: item.source,
    };
    storeActiveMedia(mediaItem as any);
    navigate(`/watch?url=${encodeURIComponent(item.url)}&source=${encodeURIComponent(item.source)}&ep=${item.episodeIndex}`);
  };

  return (
    <section className="sec rv" ref={sectionRef}>
      <div className="lb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 'var(--g)', marginBottom: '.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🕒</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            Recently Watched
          </span>
        </div>
      </div>

      <div className="row" ref={rowRef}>
        {items.map((item, idx) => (
          <button
            key={item.id}
            className="sc"
            style={{
              flex: '0 0 clamp(10rem, 14vw, 15rem)',
              display: 'flex',
              flexDirection: 'column',
              ['--i' as string]: idx,
            }}
            onClick={() => handleCardClick(item)}
          >
            <div className="pz" style={{ width: '100%', aspectRatio: '16/9', borderRadius: '0.6rem', overflow: 'hidden' }}>
              <img
                src={item.poster}
                alt={item.title}
                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
              />
              <div className="pz-grad" />
              <div className="pz-title-overlay" style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}>
                {decodeHtmlEntities(item.cleanTitle || item.title)}
              </div>
              
              {/* Progress bar overlay */}
              <div style={{ 
                position: 'absolute', 
                bottom: 0, 
                left: 0, 
                right: 0, 
                height: '3px', 
                background: 'rgba(255,255,255,0.2)' 
              }}>
                <div style={{ 
                  width: `${(item.progress * 100).toFixed(1)}%`, 
                  height: '100%', 
                  background: 'var(--acc)' 
                }} />
              </div>
            </div>
            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#9aa1b4', textAlign: 'left' }}>
              EP {item.episodeIndex + 1} · {Math.round(item.progress * 100)}%
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
