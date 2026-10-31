import { VID, T, T2 } from '../data/content.ts';

type ThumbnailCallback = (thumbnails: { cards: string[]; episodes: string[] }) => void;

let cachedCardThumbs: string[] = [];
let cachedEpisodeThumbs: string[] = [];
let isGenerating = false;
const listeners: ThumbnailCallback[] = [];

export function subscribeThumbnails(cb: ThumbnailCallback) {
  if (cachedCardThumbs.length > 0 || cachedEpisodeThumbs.length > 0) {
    cb({ cards: cachedCardThumbs, episodes: cachedEpisodeThumbs });
  }
  listeners.push(cb);
  startThumbnailGeneration();
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function notify() {
  listeners.forEach((cb) => cb({ cards: cachedCardThumbs, episodes: cachedEpisodeThumbs }));
}

function startThumbnailGeneration() {
  if (isGenerating || (cachedCardThumbs.length >= T.length && cachedEpisodeThumbs.length >= T2.length)) {
    return;
  }
  if (typeof window === 'undefined') return;

  isGenerating = true;
  const v = document.createElement('video');
  v.crossOrigin = 'anonymous';
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';

  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  if (!x) return;

  const cardJobs: Array<[number, number, number, number]> = T.map((t, i) => [t, 320, 512, i]);
  const episodeJobs: Array<[number, number, number, number]> = T2.map((t, i) => [t, 480, 270, i]);

  const seek = (time: number) =>
    new Promise<void>((resolve) => {
      const onSeeked = () => {
        v.removeEventListener('seeked', onSeeked);
        resolve();
      };
      v.addEventListener('seeked', onSeeked);
      v.currentTime = time;
    });

  v.addEventListener(
    'loadedmetadata',
    async () => {
      try {
        for (const [t, w, h, idx] of cardJobs) {
          await seek(t);
          c.width = w;
          c.height = h;
          const k = Math.max(w / (v.videoWidth || 1), h / (v.videoHeight || 1));
          const sw = w / k;
          const sh = h / k;
          x.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, w, h);
          cachedCardThumbs[idx] = c.toDataURL('image/jpeg', 0.82);
          notify();
        }

        for (const [t, w, h, idx] of episodeJobs) {
          await seek(t);
          c.width = w;
          c.height = h;
          const k = Math.max(w / (v.videoWidth || 1), h / (v.videoHeight || 1));
          const sw = w / k;
          const sh = h / k;
          x.drawImage(v, (v.videoWidth - sw) / 2, (v.videoHeight - sh) / 2, sw, sh, 0, 0, w, h);
          cachedEpisodeThumbs[idx] = c.toDataURL('image/jpeg', 0.82);
          notify();
        }
      } catch (err) {
        console.warn('Thumbnail generation skipped or blocked by CORS:', err);
      } finally {
        isGenerating = false;
      }
    },
    { once: true }
  );

  v.src = VID;
}
