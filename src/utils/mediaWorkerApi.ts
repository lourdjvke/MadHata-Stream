/**
 * Media Resolver Worker API Client
 * Connects to Cloudflare Worker: https://media-resolver-worker.levity-build.workers.dev
 * Aggregates media across Sources 1 (ThenKiri), 2 (TheNetNaija), and 3 (SeriezLoaded)
 */

export const WORKER_URL = 'https://media-resolver-worker.levity-build.workers.dev';

export interface CategoryDef {
  slug: string;
  label: string;
  icon: string;
  tagline?: string;
}

export const CATEGORIES: CategoryDef[] = [
  { slug: 'latest', label: 'Latest', icon: '🔥', tagline: 'Freshly updated releases & trending media' },
  { slug: 'movies', label: 'Movies', icon: '🎬', tagline: 'Full-length feature films & cinema' },
  { slug: 'series', label: 'TV Series', icon: '📺', tagline: 'Binge-worthy shows & serialized seasons' },
  { slug: 'korean', label: 'Korean', icon: '🇰🇷', tagline: 'Top K-Dramas & East Asian entertainment' },
  { slug: 'action', label: 'Action', icon: '💥', tagline: 'High-octane adrenaline & adventure' },
  { slug: 'horror', label: 'Horror', icon: '👻', tagline: 'Supernatural chills & psychological suspense' },
  { slug: 'nollywood', label: 'Nollywood', icon: '🇳🇬', tagline: 'Nigerian cinema & blockbusters' },
];

export interface MediaDownload {
  label: string;
  quality: string;
  format: string;
  size_human?: string;
  url: string;
}

export interface MediaItem {
  id: string;
  title: string;
  cleanTitle: string;
  poster: string;
  source?: string;
  source_name?: string;
  url?: string;
  original_url?: string;
  slug?: string;
  year?: string | number;
  rating?: string | number;
  synopsis?: string;
  downloads?: MediaDownload[];
}

import { decodeHtmlEntities, cleanSynopsis } from './textUtils.ts';
export { decodeHtmlEntities, cleanSynopsis };

/**
 * Produces a cleaned title suitable for card badges/display
 */
export function formatMediaTitle(rawTitle: string): { mainTitle: string; badge?: string } {
  let decoded = decodeHtmlEntities(rawTitle).trim();
  
  // Remove "DOWNLOAD" or "DOWNLOADS" (case insensitive) from the start/middle
  decoded = decoded.replace(/\bDOWNLOAD(S)?\b/gi, '').replace(/\s+/g, ' ').trim();

  // Check for common parenthetical badges like (Episode X Added) or (Complete) or (2026)
  const match = decoded.match(/^(.*?)\s*(\((Episode\s+\d+.*|Complete|Season\s+\d+.*)\))?$/i);
  if (match && match[1]) {
    return {
      mainTitle: match[1].trim(),
      badge: match[3] ? match[3].trim() : undefined,
    };
  }
  return { mainTitle: decoded };
}

/**
 * Sanitizes and normalizes raw item from worker into standard MediaItem
 */
export function normalizeMediaItem(raw: any, fallbackIndex = 0): MediaItem {
  const decodedTitle = decodeHtmlEntities(raw?.title || `Media Item ${fallbackIndex + 1}`);
  const fallbackPoster = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop&q=80';
  
  let poster = raw?.poster || '';
  if (!poster || poster.includes('placeholder.com')) {
    poster = fallbackPoster;
  }

  // Generate ID if missing
  const id = raw?.id || raw?.slug || `media-${fallbackIndex}-${encodeURIComponent(decodedTitle)}`;

  return {
    id,
    title: decodedTitle,
    cleanTitle: formatMediaTitle(decodedTitle).mainTitle,
    poster,
    source: raw?.source || '1',
    url: raw?.url || '',
    original_url: raw?.original_url || '',
    slug: raw?.slug || id,
    year: raw?.year || (decodedTitle.match(/\b(19\d\d|20\d\d)\b/)?.[0] ?? ''),
    rating: raw?.rating || (4.2 + (fallbackIndex % 7) * 0.1).toFixed(1),
    synopsis: cleanSynopsis(raw?.synopsis, decodedTitle),
    downloads: raw?.downloads,
  };
}

/**
 * Fetch a category feed from the worker
 * GET /api/feed/category/${catSlug}?page=${page}
 */
export async function fetchCategoryFeed(
  catSlug: string,
  page = 1,
  signal?: AbortSignal
): Promise<{ results: MediaItem[]; count: number; category: string }> {
  const url = `${WORKER_URL}/api/feed/category/${encodeURIComponent(catSlug)}?page=${page}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to load category "${catSlug}"`);
  }
  const data = await res.json();
  const rawList = Array.isArray(data?.results) ? data.results : [];
  const results = rawList.map((item: any, idx: number) => normalizeMediaItem(item, idx));

  return {
    results,
    count: data?.count || results.length,
    category: data?.category || catSlug,
  };
}

/**
 * Search across sources using worker
 * POST /api/search with body { query: q }
 */
export async function searchMediaWorker(
  query: string,
  signal?: AbortSignal
): Promise<{ results: MediaItem[]; count: number; query: string }> {
  const q = query.trim();
  if (!q) {
    return { results: [], count: 0, query: '' };
  }

  const res = await fetch(`${WORKER_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Search request failed for "${q}"`);
  }

  const data = await res.json();
  const rawList = Array.isArray(data?.results) ? data.results : [];
  const results = rawList.map((item: any, idx: number) => normalizeMediaItem(item, idx));

  return {
    results,
    count: data?.count || results.length,
    query: data?.query || q,
  };
}

/**
 * Fetch detailed stream/downloads info for a specific media item
 * GET /api/URL/${slug}?source=${source}
 */
export async function fetchMediaDetails(item: Partial<MediaItem>): Promise<MediaItem> {
  const source = item.source || '1';
  const targetUrl = item.url || item.original_url || '';

  if (!targetUrl) {
    return normalizeMediaItem(item);
  }

  try {
    const res = await fetch(`${WORKER_URL}/api/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl, source }),
    });

    if (!res.ok) {
      throw new Error(`Details request failed with HTTP ${res.status}`);
    }

    const data = await res.json();
    const decodedTitle = decodeHtmlEntities(data?.title || item.title || 'Media Details');
    
    return {
      ...item,
      id: item.id || item.slug || `media-${encodeURIComponent(decodedTitle)}`,
      title: decodedTitle,
      cleanTitle: formatMediaTitle(decodedTitle).mainTitle,
      poster: data?.poster || item.poster || '',
      synopsis: cleanSynopsis(data?.synopsis || item.synopsis, decodedTitle),
      year: data?.year || item.year || (decodedTitle.match(/\b(19\d\d|20\d\d)\b/)?.[0] ?? ''),
      source: data?.source || source,
      source_name: data?.source_name || item.source_name,
      url: targetUrl,
      original_url: targetUrl,
      downloads: Array.isArray(data?.downloads) ? data.downloads : (item.downloads || []),
    } as MediaItem;
  } catch (err) {
    console.warn('Failed to fetch details via POST /api/details, returning fallback item:', err);
    return normalizeMediaItem({
      ...item,
      title: item.title || 'Media Details',
      url: targetUrl,
      source,
    });
  }
}

/**
 * Active media persistence in session storage
 */
const STORAGE_KEY = 'slothui_active_media';

export function storeActiveMedia(media: MediaItem): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(media));
  } catch {
    // Ignore storage quota/security errors
  }
}

export function getStoredActiveMedia(): MediaItem | null {
  try {
    const val = sessionStorage.getItem(STORAGE_KEY);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}
