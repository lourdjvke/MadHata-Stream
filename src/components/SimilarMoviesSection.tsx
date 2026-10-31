import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDraggableRow } from '../hooks/useDraggableRow.ts';
import { MediaItem, fetchCategoryFeed, storeActiveMedia } from '../utils/mediaWorkerApi.ts';
import { decodeHtmlEntities } from '../utils/textUtils.ts';
import { SIMILAR_POSTERS } from '../data/movieDetailsData.ts';

interface SimilarMoviesSectionProps {
  onSeeAllClick?: () => void;
  onPosterClick?: (item: MediaItem | string) => void;
  activeMedia?: MediaItem | null;
  categorySlug?: string;
}

export const SimilarMoviesSection: React.FC<SimilarMoviesSectionProps> = ({
  onSeeAllClick,
  onPosterClick,
  activeMedia,
  categorySlug = 'movies',
}) => {
  const navigate = useNavigate();
  const rowRef = useDraggableRow<HTMLDivElement>();
  const sectionRef = useRef<HTMLElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const catToFetch = categorySlug || 'movies';
    fetchCategoryFeed(catToFetch)
      .then((data) => {
        if (!isMounted) return;
        const list = (data.results || []).filter(
          (m) => m.url !== activeMedia?.url && m.title !== activeMedia?.title
        );
        // Limit to 10 items
        setItems(list.slice(0, 10));
      })
      .catch((err) => {
        console.warn('Failed to load similar movies:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [categorySlug, activeMedia?.url, activeMedia?.title]);

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

  const handleMediaClick = (item: MediaItem) => {
    storeActiveMedia(item);
    if (onPosterClick) {
      onPosterClick(item);
    } else {
      const url = item.url || item.original_url || '';
      const source = item.source || '1';
      navigate(`/details?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}`);
    }
  };

  return (
    <section className="sec" id="similar" ref={sectionRef}>
      <div className="mh">
        <span>More Like This</span>
        <button className="see" onClick={onSeeAllClick}>
          <svg className="i">
            <use href="#bulb" />
          </svg>
          See All
        </button>
      </div>
      <div className="row" id="row" ref={rowRef}>
        {!isLoading && items.length > 0
          ? items.map((item, i) => (
              <button
                key={item.id || i}
                className="p"
                style={{
                  backgroundImage: item.poster ? `url(${item.poster})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                onClick={() => handleMediaClick(item)}
              >
                <span>{decodeHtmlEntities(item.cleanTitle || item.title)}</span>
              </button>
            ))
          : SIMILAR_POSTERS.map(([title, bg], i) => (
              <button
                key={i}
                className="p"
                style={{ background: bg }}
                onClick={() => onPosterClick?.(title)}
              >
                <span
                  dangerouslySetInnerHTML={{
                    __html: title.replace('|', '<br>'),
                  }}
                />
              </button>
            ))}
      </div>
    </section>
  );
};
