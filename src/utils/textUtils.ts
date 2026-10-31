/**
 * Text processing & media helper utilities
 */

/**
 * Decodes HTML entities commonly found in media feeds (e.g. &#039; -> ', &amp; -> &, &quot; -> ")
 */
export function decodeHtmlEntities(raw: string): string {
  if (!raw) return '';
  let str = raw;
  // Apply twice in case of double-encoded entities like &amp;#039;
  for (let i = 0; i < 2; i++) {
    str = str
      .replace(/&#0?39;|&#8217;|&#8216;|&apos;/gi, "'")
      .replace(/&#0?38;|&amp;/gi, '&')
      .replace(/&#8220;|&#8221;|&quot;/gi, '"')
      .replace(/&#8211;|&ndash;/gi, '–')
      .replace(/&#8212;|&mdash;/gi, '—')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&hellip;|&#8230;/gi, '…');
  }
  return str.trim();
}

/**
 * Cleans scraped promotional phrases and returns a clean synopsis string
 */
export function cleanSynopsis(rawSynopsis?: string, fallbackTitle?: string): string {
  if (!rawSynopsis) {
    const cleanT = fallbackTitle ? decodeHtmlEntities(fallbackTitle) : 'this title';
    return `Stream or download ${cleanT} in high-definition quality with all available episodic streams and links.`;
  }

  let text = decodeHtmlEntities(rawSynopsis);

  // Strip common scraped promotional boilerplate phrases from sources like nkiri, netnaija, etc.
  text = text
    .replace(/Download\s+.*?for free at\s+nkiri\.com\.\s*/gi, '')
    .replace(/Download all the greatest blockbuster Movies at nkiri\.com\.\s*/gi, '')
    .replace(/Download\s+.*?\|?\s*(TV Series|Movie)\s+for free at\s+\S+\.\s*/gi, '')
    .replace(/Download\s+.*?\s*for free at\s+\S+\.\s*/gi, '')
    .replace(/(https?:\/\/\S+|nkiri\.com|thenkiri|netnaija|seriezloaded)/gi, '')
    .replace(/Download\s+.*?\s*\(Complete\)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If after cleaning, the synopsis is empty or too short, return a polished fallback
  if (!text || text.length < 15 || /^Download\b/i.test(text)) {
    const cleanT = fallbackTitle ? decodeHtmlEntities(fallbackTitle) : 'this title';
    return `Stream or download ${cleanT} in high-definition quality with all available episodic streams and links.`;
  }

  return text;
}

/**
 * Parses season information from media titles or URLs (e.g. S04, Season 4, S4)
 */
export function extractSeasonInfo(title: string, url?: string): { seasonNumber: number | null; seasonLabel: string } {
  const decoded = decodeHtmlEntities(title);
  const combined = `${decoded} ${url || ''}`;

  // Matches S04, S4, Season 4, Season 04
  const match = combined.match(/\bS(\d{1,2})\b/i) || combined.match(/\bSeason\s*(\d{1,2})\b/i);

  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0) {
      return {
        seasonNumber: num,
        seasonLabel: `Season ${num}`,
      };
    }
  }

  return {
    seasonNumber: null,
    seasonLabel: 'Season 1',
  };
}

/**
 * LocalStorage watched episode tracker helpers
 */
const WATCHED_KEY_PREFIX = 'slothui_watched_ep_';

export function getWatchedEp(mediaId: string): number {
  if (!mediaId || typeof window === 'undefined') return -1;
  try {
    const key = `${WATCHED_KEY_PREFIX}${encodeURIComponent(mediaId)}`;
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const val = parseInt(stored, 10);
      return isNaN(val) ? -1 : val;
    }
  } catch {
    // Fallback if localStorage restricted
  }
  return -1;
}

export function setWatchedEp(mediaId: string, episodeIndex: number): void {
  if (!mediaId || typeof window === 'undefined') return;
  try {
    const key = `${WATCHED_KEY_PREFIX}${encodeURIComponent(mediaId)}`;
    localStorage.setItem(key, episodeIndex.toString());
  } catch {
    // Fallback if localStorage restricted
  }
}
