import React, { useState, useEffect } from 'react';
import { 
  fetchCategoryFeed, 
  searchMediaWorker, 
  MediaItem,
  CATEGORIES 
} from '../utils/mediaWorkerApi.ts';

interface MovieSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (media: { title: string; poster: string; url: string; source: string }) => void;
  title?: string;
  subtitle?: string;
}

export const MovieSelectorModal: React.FC<MovieSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Select Movie Poster',
  subtitle = 'Search or select a genre to use as the display image',
}) => {
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('horror');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load items based on active genre or query
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const loadMedia = async () => {
      setLoading(true);
      try {
        if (query.trim()) {
          const res = await searchMediaWorker(query.trim());
          if (!cancelled) {
            setItems(res.results || []);
          }
        } else {
          const res = await fetchCategoryFeed(selectedGenre || 'horror', 1);
          if (!cancelled) {
            setItems(res.results || []);
          }
        }
      } catch (e) {
        console.error('Error fetching movies for selector:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(loadMedia, query.trim() ? 320 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, query, selectedGenre]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end md:justify-center items-center bg-black/75 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
      {/* Background click dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal / Bottom Sheet Box */}
      <div 
        className="relative z-10 w-full md:max-w-xl max-h-[88vh] md:max-h-[82vh] bg-[#10131c] text-white border-t md:border border-white/10 rounded-t-3xl md:rounded-2xl flex flex-col shadow-2xl overflow-hidden pb-4 md:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile handle indicator */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-white/10">
          <div>
            <h3 className="text-base md:text-lg font-bold text-white tracking-wide">{title}</h3>
            <p className="text-xs text-white/50">{subtitle}</p>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative flex items-center bg-white/5 rounded-xl px-3.5 py-2.5">
            <svg className="w-4 h-4 text-white/40 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movie title (e.g. Alien, Smile, Terrifier)..."
              className="w-full bg-transparent text-sm text-white placeholder-white/40 border-0 outline-none shadow-none focus:outline-none focus:ring-0 focus:border-0"
              style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
              autoFocus
            />
            {query && (
              <button 
                type="button"
                onClick={() => setQuery('')}
                className="text-xs text-white/40 hover:text-white ml-1 px-1 border-0 outline-none"
                style={{ border: 'none', outline: 'none' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Genre Pills Row */}
        {!query && (
          <div className="px-5 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-white/5">
            {CATEGORIES.map((cat) => {
              const active = selectedGenre === cat.slug;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => setSelectedGenre(cat.slug)}
                  style={{
                    background: active ? 'linear-gradient(135deg, #7928ca 0%, #9333ea 100%)' : 'rgba(255, 255, 255, 0.06)',
                    color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                    border: active ? '2px solid #d8b4fe' : '1px solid rgba(255, 255, 255, 0.1)',
                    fontWeight: active ? 700 : 500,
                    transform: active ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: active ? '0 4px 12px rgba(121, 40, 202, 0.4)' : 'none',
                  }}
                  className="px-3.5 py-1.5 text-xs rounded-full whitespace-nowrap transition-all cursor-pointer"
                >
                  <span className="mr-1">{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Movies Grid */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[260px] max-h-[50vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-white/50 text-sm">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span>Fetching posters...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-white/40 text-sm text-center">
              <p>No results found.</p>
              <p className="text-xs mt-1">Try another movie title or choose a genre pill above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {items.map((item, idx) => (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    onSelect({
                      title: item.cleanTitle || item.title,
                      poster: item.poster,
                      url: item.url || '',
                      source: item.source || '1',
                    });
                    onClose();
                  }}
                  className="group relative aspect-[2/3] rounded-lg overflow-hidden border border-white/10 hover:border-white/25 transition-all text-left bg-[#1a1d28] focus:outline-none"
                >
                  <img
                    src={item.poster}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                    <p className="text-[11px] font-semibold text-white line-clamp-2 leading-tight">
                      {item.cleanTitle || item.title}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
