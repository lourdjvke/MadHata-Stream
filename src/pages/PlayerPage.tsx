import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  fetchMediaDetails,
  getStoredActiveMedia,
  MediaItem,
} from '../utils/mediaWorkerApi.ts';
import { setWatchedEp, decodeHtmlEntities, extractSeasonInfo } from '../utils/textUtils.ts';
import { dbService } from '../utils/db.ts';
import { auth } from '../firebase.ts';
import { saveWatchProgress } from '../utils/userDataService.ts';
import { opfsService } from '../utils/opfsService.ts';

export const PlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const DEFAULT_SRC = 'https://raw.githubusercontent.com/mediaelement/mediaelement-files/master/big_buck_bunny.mp4';
    let EPS = [
      'The Iron Throne Rises',
      'Blood and Embers',
      'The Winter Pact',
      'A Crown of Ash',
      'Fire Over Harrow',
      'The Broken Oath',
      'Wings in the Dark',
      'The Long Night',
    ];
    let VIDEO_URLS: string[] = [DEFAULT_SRC];
    let DOWNLOAD_URLS: string[] = [];
    let mediaTitle = 'HOUSES & DRAGONS';
    let seasonLabel = 'Season 1';
    let blobUrls: string[] = [];

    const prog = [1, 1, 1, 0.62, 0, 0, 0, 0];
    const THUMB_AT = [4, 12, 19, 26, 33, 40, 47, 54];

    const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T | null;

    const pl = $<HTMLDivElement>('#pl')!;
    const v = $<HTMLVideoElement>('#v')!;
    const surf = $<HTMLDivElement>('#surf')!;
    const trk = $<HTMLDivElement>('#trk')!;
    const epr = $<HTMLDivElement>('#epr')!;
    const tip = $<HTMLSpanElement>('#tip')!;

    if (!pl || !v || !surf || !trk || !epr) return;

    // Parse URL params for media details & current episode
    const targetUrl = searchParams.get('url');
    const targetSource = searchParams.get('source') || '1';
    const epParam = searchParams.get('ep') || searchParams.get('episode');
    const targetId = searchParams.get('id') || searchParams.get('mediaId');

    let ei = epParam !== null && !isNaN(+epParam) ? Math.max(0, +epParam) : 0;

    let dur = 60;
    let played = 0;
    let ign = 0;
    let sdr = 0;
    let sc: { was: boolean; base?: number } | null = null;
    let pendT = 0;
    let lastSeek = 0;
    let ht: ReturnType<typeof setTimeout> | 0 = 0;
    let panel = 0;
    let cdT: ReturnType<typeof setInterval> | 0 = 0;
    let lastSec = -1;
    let isCancelled = false;
    let animReqId = 0;
    let curBright = 1.0;
    let fitIdx = 0;
    let volHudT: ReturnType<typeof setTimeout> | 0 = 0;
    let brightHudT: ReturnType<typeof setTimeout> | 0 = 0;
    let szHudT: ReturnType<typeof setTimeout> | 0 = 0;

    const FIT_MODES = [
      { id: 'original', label: 'Original', fit: 'contain', width: '100%', height: '100%' },
      { id: 'fit', label: 'Fit Width', fit: 'cover', width: '100%', height: 'auto' },
      { id: 'zoom', label: 'Zoom', fit: 'cover', width: '100%', height: '100%' },
      { id: 'stretch', label: 'Stretch', fit: 'fill', width: '100%', height: '100%' },
    ];

    function showSzHud(label: string) {
      const szHud = $('#sz-hud');
      const szTxt = $('#sz-txt');
      if (szHud && szTxt) {
        szTxt.textContent = `Size: ${label}`;
        szHud.classList.add('on');
        if (szHudT) clearTimeout(szHudT);
        szHudT = setTimeout(() => {
          szHud.classList.remove('on');
        }, 1200);
      }
    }

    function applyFitMode(idx: number, showHud = true) {
      fitIdx = idx % FIT_MODES.length;
      const m = FIT_MODES[fitIdx];
      v.style.objectFit = m.fit as any;
      v.style.width = m.width;
      v.style.height = m.height;
      const szl = $('#szl');
      if (szl) szl.textContent = m.label;
      if (showHud) showSzHud(m.label);
    }

    function updateVolHud(vol: number) {
      const hud = $('#vol-hud');
      const fill = $('#vol-fill');
      const val = $('#vol-val');
      if (!hud || !fill || !val) return;
      const pct = Math.round(vol * 100);
      fill.style.height = pct + '%';
      val.textContent = vol === 0 ? 'Mute' : pct + '%';
      hud.classList.add('on');
    }

    function hideVolHudLater() {
      if (volHudT) clearTimeout(volHudT);
      volHudT = setTimeout(() => {
        const hud = $('#vol-hud');
        if (hud) hud.classList.remove('on');
      }, 1000);
    }

    function updateBrightHud(bright: number) {
      const hud = $('#bright-hud');
      const fill = $('#bright-fill');
      const val = $('#bright-val');
      if (!hud || !fill || !val) return;
      const norm = clamp((bright - 0.2) / 1.3, 0, 1);
      const pct = Math.round(norm * 100);
      fill.style.height = pct + '%';
      val.textContent = Math.round(bright * 100) + '%';
      hud.classList.add('on');
    }

    function hideBrightHudLater() {
      if (brightHudT) clearTimeout(brightHudT);
      brightHudT = setTimeout(() => {
        const hud = $('#bright-hud');
        if (hud) hud.classList.remove('on');
      }, 1000);
    }

    const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
    const fmt = (s: number) => {
      s = Math.max(0, Math.round(s));
      const h = (s / 3600) | 0;
      const m = ((s % 3600) / 60) | 0;
      const x = s % 60;
      return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
    };

    /* Mobile & Tablet Landscape Enforcement */
    const isTouchOrMobile = () => {
      return (
        matchMedia('(pointer: coarse)').matches ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      );
    };

    const isPortrait = () => {
      if (window.innerWidth && window.innerHeight) {
        return window.innerHeight > window.innerWidth;
      }
      return matchMedia('(orientation: portrait)').matches;
    };

    const checkOrientation = () => {
      const touch = isTouchOrMobile();
      const portrait = isPortrait();
      const needRot = touch && portrait;
      pl.classList.toggle('rot', needRot);
    };

    const lockLandscape = async () => {
      try {
        const screenAny = screen as Screen & { orientation?: { lock?: (orientation: string) => Promise<void> } };
        if (screenAny.orientation?.lock) {
          await screenAny.orientation.lock('landscape');
        }
      } catch (_) {}
    };

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    const portraitMql = matchMedia('(orientation: portrait)');
    portraitMql.addEventListener('change', checkOrientation);
    checkOrientation();

    const onFullscreenChange = () => {
      const docAny = document as Document & { webkitFullscreenElement?: Element };
      if (document.fullscreenElement || docAny.webkitFullscreenElement) {
        lockLandscape();
      }
      checkOrientation();
      setTimeout(checkOrientation, 80);
      setTimeout(checkOrientation, 300);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    const rot = () => pl.classList.contains('rot');
    const P = (e: PointerEvent) => (rot() ? { x: e.clientY, y: window.innerWidth - e.clientX } : { x: e.clientX, y: e.clientY });
    const lx = (el: HTMLElement | null) => {
      let x = 0;
      let curr = el;
      while (curr && curr !== pl) {
        x += curr.offsetLeft;
        curr = curr.offsetParent as HTMLElement | null;
      }
      return x;
    };

    async function fullscreen() {
      const plAny = pl as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      const docAny = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
      const f = plAny.requestFullscreen || plAny.webkitRequestFullscreen;

      if (docAny.fullscreenElement || docAny.webkitFullscreenElement) {
        const exit = docAny.exitFullscreen || docAny.webkitExitFullscreen;
        if (exit) exit.call(document).catch(() => {});
        return;
      }
      try {
        if (f) {
          const res = f.call(plAny);
          if (res && typeof (res as Promise<void>).then === 'function') {
            await res;
            await lockLandscape();
          }
        }
      } catch (_) {}
      checkOrientation();
    }

    /* UI Visibility */
    function showUI() {
      pl.classList.remove('hide');
      if (ht) clearTimeout(ht);
      ht = setTimeout(maybeHide, 3200);
    }

    function maybeHide() {
      if (!v.paused && !panel && !sdr && !sc) pl.classList.add('hide');
    }

    function setPanel(on: number) {
      panel = on;
      pl.classList.toggle('open', !!on);
      if (on) {
        const c = epr.children[ei] as HTMLElement | undefined;
        if (c) {
          setTimeout(() => epr.scrollTo({ left: c.offsetLeft - (epr.clientWidth - c.offsetWidth) / 2, behavior: 'smooth' }), 120);
        }
      }
    }

    /* Playback */
    function start() {
      const r = v.play();
      if (r) r.catch(() => {});
      if (!played) {
        played = 1;
        if (isTouchOrMobile()) {
          fullscreen().then(() => {
            lockLandscape();
            checkOrientation();
          });
        }
      }
    }

    const toggle = () => (v.paused || v.ended ? start() : v.pause());

    const onPlay = () => {
      pl.dataset.p = '1';
      cdStop();
      setPanel(0);
      showUI();
    };

    const onPause = () => {
      pl.dataset.p = '0';
      if (ign) {
        ign = 0;
        return;
      }
      if (!played || v.ended) return;
      setPanel(1);
      showUI();
    };

    const onWaiting = () => pl.classList.add('buf');

    const clearBuf = () => pl.classList.remove('buf');

    const onLoadedMetadata = () => {
      dur = v.duration || 60;
      const currentProg = prog[ei] || 0;
      v.currentTime = (currentProg >= 1 ? 0 : currentProg) * dur;
      
      // Save duration to IndexedDB
      const videoId = VIDEO_URLS[ei] || targetUrl || '';
      if (videoId) {
        dbService.saveDuration(videoId, dur);
      }
    };

    const onTimeUpdate = () => {
      if (dur && !v.ended) {
        const p = clamp(v.currentTime / dur, 0, 0.999);
        prog[ei] = p;
        const child = epr.children[ei] as HTMLElement | undefined;
        child?.style.setProperty('--p', String(p));

        // Periodically save to recent watched (every 5 seconds)
        if (Math.floor(v.currentTime) % 5 === 0 && Math.floor(v.currentTime) !== lastSec) {
          saveToRecent();
        }
      }
    };

    const onEnded = () => {
      prog[ei] = 1;
      mark();
      pl.dataset.p = '0';
      setPanel(1);
      showUI();
      if (ei < EPS.length - 1) {
        let n = 5;
        const l = $('#nxl');
        if (l) l.textContent = `Next episode · ${n}`;
        cdT = setInterval(() => {
          n--;
          if (n <= 0) {
            cdStop();
            go(ei + 1);
          } else if (l) {
            l.textContent = `Next episode · ${n}`;
          }
        }, 1000);
      }
    };

    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', clearBuf);
    v.addEventListener('canplay', clearBuf);
    v.addEventListener('seeked', clearBuf);
    v.addEventListener('loadedmetadata', onLoadedMetadata);
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('ended', onEnded);

    function cdStop() {
      if (cdT) {
        clearInterval(cdT);
        cdT = 0;
      }
      const l = $('#nxl');
      if (l) l.textContent = 'Next episode';
    }

    function seekBy(sec: number) {
      v.currentTime = clamp(v.currentTime + sec, 0, dur);
      cdStop();
      showUI();
    }

    /* Episodes Rendering & State Update */
    function renderEpisodesDrawer() {
      epr.innerHTML = EPS.map(
        (t, i) =>
          `<button class="ec" data-i="${i}" style="--h:${(i * 37 + 230) % 360}">
            <span class="th"><span class="tag"></span><span class="pb"><i></i></span></span>
            <span class="en"><b>E${i + 1}</b>${t}</span>
          </button>`
      ).join('');

      const ephText = $('#eph-text');
      if (ephText) {
        ephText.textContent = `${mediaTitle} · ${seasonLabel}`;
      }
    }

    function mark() {
      [...epr.children].forEach((c, i) => {
        const el = c as HTMLElement;
        el.classList.toggle('on', i === ei);
        const tag = el.querySelector('.tag');
        if (tag) tag.textContent = i === ei ? 'Now playing' : i === ei + 1 ? 'Up next' : '';
        el.style.setProperty('--p', String(prog[i] || 0));
      });
      const ttl = $('#ttl');
      if (ttl) ttl.textContent = EPS[ei] ? `${mediaTitle} · E${ei + 1} “${EPS[ei]}”` : mediaTitle;
      const pv = $<HTMLButtonElement>('#pv');
      if (pv) pv.disabled = ei === 0;
      const nx = $<HTMLButtonElement>('#nx');
      if (nx) nx.disabled = ei >= EPS.length - 1;
    }

    async function saveToRecent() {
      const activeMedia = getStoredActiveMedia();
      if (!activeMedia) return;
      
      const mediaId = activeMedia.id || activeMedia.slug || '';
      if (!mediaId) return;

      const progressVal = prog[ei] || (dur > 0 ? v.currentTime / dur : 0) || 0;

      await dbService.saveRecent({
        id: mediaId,
        title: activeMedia.title,
        cleanTitle: activeMedia.cleanTitle,
        poster: activeMedia.poster,
        url: activeMedia.url || targetUrl || '',
        source: activeMedia.source || targetSource || '1',
        episodeIndex: ei,
        progress: progressVal,
        duration: dur,
        timestamp: Date.now()
      });

      // Save to Firebase Realtime Database for active user
      if (auth.currentUser && typeof navigator !== 'undefined' && navigator.onLine) {
        try {
          saveWatchProgress(auth.currentUser.uid, {
            id: mediaId,
            title: activeMedia.cleanTitle || activeMedia.title,
            poster: activeMedia.poster,
            url: activeMedia.url || targetUrl || '',
            source: activeMedia.source || targetSource || '1',
            label: EPS[ei] ? `E${ei + 1} “${EPS[ei]}”` : 'Movie',
            duration: Math.round(dur / 60) || 50,
            progress: progressVal,
          }).catch(() => {});
        } catch {}
      }
    }

    // Periodic watch hours/progress sync every 2 minutes (120000ms)
    const periodicSync = setInterval(() => {
      if (!v.paused) {
        saveToRecent();
      }
    }, 120000);

    function updateRouterState(epIndex: number) {
      if (targetUrl) {
        const newSearch = `?url=${encodeURIComponent(targetUrl)}&source=${encodeURIComponent(targetSource)}&ep=${epIndex}`;
        window.history.replaceState(null, '', newSearch);
      }
      const activeMedia = getStoredActiveMedia();
      const mediaId = activeMedia?.id || activeMedia?.slug || '';
      if (mediaId) {
        setWatchedEp(mediaId, epIndex);
      }
      saveToRecent();
    }

    async function resolveSource(i: number) {
      await opfsService.whenReady();
      const doneList = opfsService.getDoneDownloads();
      const matched = doneList.find((d) => String(d.id) === String(mediaId));
      if (matched) {
        const opfsUrl = await opfsService.getPlaybackUrl(mediaId, matched.type, i);
        if (opfsUrl) {
          console.log('Playing from OPFS:', opfsUrl);
          blobUrls.push(opfsUrl);
          return opfsUrl;
        }
      }

      const activeMedia = getStoredActiveMedia();
      const type = activeMedia?.downloads?.length ? 'series' : 'movie';
      const fallbackOpfs = await opfsService.getPlaybackUrl(mediaId, type, i);
      if (fallbackOpfs) {
        console.log('Playing from OPFS fallback:', fallbackOpfs);
        blobUrls.push(fallbackOpfs);
        return fallbackOpfs;
      }

      return VIDEO_URLS[i] || VIDEO_URLS[0] || DEFAULT_SRC;
    }

    async function go(i: number) {
      if (i < 0 || i >= EPS.length) return;
      cdStop();
      ei = i;
      updateRouterState(i);
      mark();

      // Change video source if dynamic video stream is available
      const nextSrc = await resolveSource(i);
      if (v.src !== nextSrc) {
        v.src = nextSrc;
      }

      if ((prog[i] || 0) >= 1) prog[i] = 0;
      v.currentTime = (prog[i] || 0) * dur;
      if (played) start();
      showUI();
    }

    const onEprClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const c = target.closest('.ec') as HTMLElement | null;
      if (c && c.dataset.i !== undefined) {
        const i = +c.dataset.i;
        i === ei ? (v.paused && start()) : go(i);
      }
    };
    epr.addEventListener('click', onEprClick);

    const pvBtn = $('#pv');
    if (pvBtn) pvBtn.onclick = () => go(ei - 1);
    const nxBtn = $('#nx');
    if (nxBtn) nxBtn.onclick = () => go(ei + 1);
    const ebBtn = $('#eb');
    if (ebBtn) ebBtn.onclick = () => {
      setPanel(1);
      showUI();
    };

    /* Fix #dn chevron click to close drawer smoothly */
    const dnBtn = $('#dn');
    if (dnBtn) {
      dnBtn.onclick = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setPanel(0);
      };
    }

    const szBtn = $('#sz');
    if (szBtn) szBtn.onclick = () => {
      applyFitMode(fitIdx + 1, true);
    };
    const ppBtn = $('#pp');
    if (ppBtn) ppBtn.onclick = toggle;

    const spin = (b: HTMLElement, d: number) => {
      const svg = b.querySelector('svg');
      if (svg && typeof svg.animate === 'function') {
        svg.animate([{ transform: 'rotate(0)' }, { transform: `rotate(${-d * 360}deg)` }], {
          duration: 520,
          easing: 'cubic-bezier(.22,1,.36,1)',
        });
      }
    };

    const bkBtn = $('#bk');
    if (bkBtn) bkBtn.onclick = (e) => {
      seekBy(-10);
      spin(e.currentTarget as HTMLElement, 1);
    };
    const fwBtn = $('#fw');
    if (fwBtn) fwBtn.onclick = (e) => {
      seekBy(10);
      spin(e.currentTarget as HTMLElement, -1);
    };

    const backBtn = $('#back');
    if (backBtn) backBtn.onclick = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
    };

    /* Progress bar tracking */
    function setProg(f: number) {
      pl.style.setProperty('--pct', (f * 100).toFixed(2) + '%');
      const s = Math.round(dur - f * dur);
      if (s !== lastSec) {
        lastSec = s;
        const rem = $('#rem');
        if (rem) rem.textContent = fmt(s);
      }
    }

    function tick() {
      if (!isCancelled) {
        if (!sdr && !sc) setProg(clamp(v.currentTime / dur, 0, 1));
        const b = v.buffered;
        if (b && b.length) pl.style.setProperty('--buf', ((b.end(b.length - 1) / dur) * 100).toFixed(1) + '%');
        animReqId = requestAnimationFrame(tick);
      }
    }
    animReqId = requestAnimationFrame(tick);

    function seekAt(e: PointerEvent) {
      const f = clamp((P(e).x - lx(trk)) / trk.offsetWidth, 0, 1);
      pendT = f * dur;
      setProg(f);
      if (tip) tip.textContent = fmt(pendT);
      const n = performance.now();
      if (n - lastSeek > 140) {
        lastSeek = n;
        v.currentTime = pendT;
      }
    }

    const onTrkPointerDown = (e: PointerEvent) => {
      sdr = 1;
      trk.setPointerCapture(e.pointerId);
      trk.classList.add('dr');
      if (tip) tip.classList.add('on');
      sc = { was: !v.paused };
      if (sc.was) {
        ign = 1;
        v.pause();
      }
      cdStop();
      seekAt(e);
    };

    const onTrkPointerMove = (e: PointerEvent) => {
      if (sdr) seekAt(e);
    };

    const tend = () => {
      if (!sdr) return;
      sdr = 0;
      trk.classList.remove('dr');
      if (tip) tip.classList.remove('on');
      v.currentTime = pendT;
      const w = sc ? sc.was : false;
      sc = null;
      if (w) v.play().catch(() => {});
      showUI();
    };

    trk.addEventListener('pointerdown', onTrkPointerDown);
    trk.addEventListener('pointermove', onTrkPointerMove);
    trk.addEventListener('pointerup', tend);
    trk.addEventListener('pointercancel', tend);

    const onTrkKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        seekBy(-10);
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') {
        seekBy(10);
        e.preventDefault();
      }
    };
    trk.addEventListener('keydown', onTrkKeyDown);

    /* Gestures on Video Surface */
    const rl = $('#rl');
    const rr = $('#rr');
    const spd = $('#spd');
    const sbub = $('#sbub');

    interface Gesture {
      id: number;
      x: number;
      y: number;
      mode: string;
      moved: number;
      touch: boolean;
      lp?: ReturnType<typeof setTimeout>;
      baseVol?: number;
      baseBright?: number;
    }

    let g: Gesture | null = null;
    let last: { t: number; x: number } | null = null;
    let tapT: ReturnType<typeof setTimeout> | 0 = 0;
    let chainEnd = 0;
    let chainSide = 0;
    let acc = 0;

    function ripple(side: number, sec: number) {
      const el = side > 0 ? rr : rl;
      if (!el) return;
      const rtText = el.querySelector('.rt');
      if (rtText) rtText.textContent = sec + ' seconds';
      el.getAnimations().forEach((a) => a.cancel());
      el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }], { duration: 850 });
      el.querySelectorAll('.i').forEach((c, i) =>
        c.animate([{ opacity: 0.2 }, { opacity: 1, offset: 0.5 }, { opacity: 0.2 }], { duration: 600, delay: (side > 0 ? i : 2 - i) * 110 })
      );
    }

    function dbl(side: number) {
      const n = performance.now();
      acc = n < chainEnd && side === chainSide ? acc + 10 : 10;
      chainSide = side;
      chainEnd = n + 800;
      seekBy(side * 10);
      ripple(side, acc);
    }

    /* Free Space Tap Handler: Fixes closing drawer & toggling controls */
    function tap(x: number, touch: boolean) {
      const n = performance.now();
      const w = rot() ? window.innerHeight : pl.offsetWidth;
      const side = x < w / 3 ? -1 : x > (w * 2) / 3 ? 1 : 0;

      if (touch && side && n < chainEnd && side === chainSide) {
        dbl(side);
        return;
      }
      if (last && n - last.t < 280 && Math.abs(x - last.x) < w * 0.15) {
        if (tapT) clearTimeout(tapT);
        last = null;
        if (!touch) fullscreen();
        else if (side) dbl(side);
        else toggle();
        return;
      }
      last = { t: n, x };
      tapT = setTimeout(
        () => {
          last = null;
          if (panel) {
            setPanel(0);
          } else if (!pl.classList.contains('hide')) {
            if (ht) clearTimeout(ht);
            pl.classList.add('hide');
          } else {
            showUI();
          }
        },
        touch ? 280 : 230
      );
    }

    function fast(on: boolean) {
      if (on && v.paused) return false;
      v.playbackRate = on ? 2 : 1;
      if (spd) spd.classList.toggle('on', on);
      if (on) pl.classList.add('hide');
      else showUI();
      return true;
    }

    function startScrub() {
      sc = { was: !v.paused, base: v.currentTime };
      if (sc.was) {
        ign = 1;
        v.pause();
      }
      cdStop();
      if (sbub) sbub.classList.add('on');
      pl.classList.remove('hide');
    }

    function scrubTo(dx: number) {
      if (!sc || sc.base === undefined) return;
      const t = clamp(sc.base + (dx / pl.offsetWidth) * Math.min(dur, 120), 0, dur);
      const d = t - sc.base;
      pendT = t;
      setProg(t / dur);
      const sbt = $('#sbt');
      if (sbt) sbt.textContent = fmt(t);
      const sbd = $('#sbd');
      if (sbd) sbd.textContent = (d >= 0 ? '+' : '−') + Math.abs(Math.round(d)) + 's';
      const n = performance.now();
      if (n - lastSeek > 140) {
        lastSeek = n;
        v.currentTime = t;
      }
    }

    function endScrub() {
      if (sbub) sbub.classList.remove('on');
      v.currentTime = pendT;
      const w = sc ? sc.was : false;
      sc = null;
      if (w) v.play().catch(() => {});
      showUI();
    }

    const onSurfPointerDown = (e: PointerEvent) => {
      if (e.button > 0) return;
      surf.setPointerCapture(e.pointerId);
      const p = P(e);
      const touch = e.pointerType !== 'mouse';
      g = { id: e.pointerId, x: p.x, y: p.y, mode: '', moved: 0, touch, baseVol: v.volume, baseBright: curBright };
      if (touch) {
        g.lp = setTimeout(() => {
          if (g && !g.mode && !g.moved) {
            g.mode = fast(true) ? 'fast' : 'none';
          }
        }, 430);
      }
    };

    const onSurfPointerMove = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      const p = P(e);
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      const w = rot() ? window.innerHeight : pl.offsetWidth;
      const h = rot() ? window.innerWidth : pl.offsetHeight;

      if (!g.mode && Math.hypot(dx, dy) > 12) {
        g.moved = 1;
        if (g.lp) clearTimeout(g.lp);
      }
      if (!g.mode && g.moved) {
        if (Math.abs(dx) > Math.abs(dy) * 1.2) {
          g.mode = 'scrub';
          startScrub();
        } else if (Math.abs(dy) > Math.abs(dx) * 1.2) {
          if (g.x >= w / 2) {
            g.mode = 'volume';
          } else {
            g.mode = 'brightness';
          }
        }
      }
      if (g.mode === 'scrub') {
        scrubTo(dx);
      } else if (g.mode === 'volume') {
        const delta = -dy / (h * 0.5);
        const targetVol = clamp((g.baseVol ?? v.volume) + delta, 0, 1);
        v.volume = targetVol;
        v.muted = targetVol === 0;
        updateVolHud(targetVol);
      } else if (g.mode === 'brightness') {
        const delta = -dy / (h * 0.5);
        const targetBright = clamp((g.baseBright ?? curBright) + delta, 0.2, 1.5);
        curBright = targetBright;
        v.style.filter = `brightness(${targetBright})`;
        updateBrightHud(targetBright);
      }
    };

    const gEnd = (e: PointerEvent) => {
      if (!g || e.pointerId !== g.id) return;
      if (g.lp) clearTimeout(g.lp);
      const m = g;
      g = null;
      if (m.mode === 'fast') fast(false);
      else if (m.mode === 'scrub') endScrub();
      else if (m.mode === 'volume') hideVolHudLater();
      else if (m.mode === 'brightness') hideBrightHudLater();
      else if (!m.mode && !m.moved && e.type === 'pointerup') tap(m.x, m.touch);
    };

    surf.addEventListener('pointerdown', onSurfPointerDown);
    surf.addEventListener('pointermove', onSurfPointerMove);
    surf.addEventListener('pointerup', gEnd);
    surf.addEventListener('pointercancel', gEnd);

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    pl.addEventListener('contextmenu', onContextMenu);

    const onPlPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') showUI();
    };
    pl.addEventListener('pointermove', onPlPointerMove);

    const uiEl = $('#ui');
    const onUiFocusIn = () => showUI();
    if (uiEl) uiEl.addEventListener('focusin', onUiFocusIn);

    /* Keyboard / Remote */
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const onBtn = target && target.closest && target.closest('button,.trk');
      if ((e.key === ' ' || e.key === 'k') && !onBtn) {
        e.preventDefault();
        toggle();
        showUI();
      } else if (e.key === 'Enter' && !onBtn) {
        toggle();
        showUI();
      } else if ((e.key === 'ArrowRight' || e.key === 'l') && !onBtn) {
        seekBy(10);
        ripple(1, 10);
      } else if ((e.key === 'ArrowLeft' || e.key === 'j') && !onBtn) {
        seekBy(-10);
        ripple(-1, 10);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        showUI();
      } else if (e.key === 'f') {
        fullscreen();
      } else if (e.key === 'Escape' && panel) {
        setPanel(0);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    /* Dynamic Media Loading & Reload Resilience */
    const storedMedia = getStoredActiveMedia();
    const activeTargetUrl = targetUrl || storedMedia?.url || storedMedia?.original_url;
    const mediaId = targetId || storedMedia?.id || storedMedia?.slug || (activeTargetUrl ? activeTargetUrl : 'HOUSES & DRAGONS');

    async function initializeMetadata() {
      // Ensure service is initialized (crucial for offline)
      await opfsService.whenReady();

      // 1. Try to get metadata from OPFS first (Offline path)
      const offlineMeta = await opfsService.getOfflineMetadata(mediaId);
      const doneItem = opfsService.getDoneDownloads().find((d) => String(d.id) === String(mediaId));

      if (offlineMeta || doneItem) {
        mediaTitle = offlineMeta?.title || doneItem?.t || mediaTitle;
        const mediaType = doneItem?.type || offlineMeta?.type || 'movie';
        seasonLabel = offlineMeta?.episode ? offlineMeta.episode.split(':')[0] : 'Season 1';

        if (mediaType === 'series') {
          if (doneItem && doneItem.type === 'series' && doneItem.eps?.length) {
            EPS = doneItem.eps.map((e) => e.sub);
            VIDEO_URLS = doneItem.eps.map(() => '');
          } else if (offlineMeta?.episodes?.length) {
            EPS = offlineMeta.episodes.map((e: any) => e.sub);
            VIDEO_URLS = offlineMeta.episodes.map(() => '');
          } else {
            EPS = [offlineMeta?.subtitle || 'Episode 1'];
            VIDEO_URLS = [''];
          }
        } else {
          EPS = [offlineMeta?.subtitle || doneItem?.t || 'Movie'];
          VIDEO_URLS = [''];
        }

        ei = clamp(ei, 0, Math.max(0, EPS.length - 1));
        renderEpisodesDrawer();
        mark();

        const src = await resolveSource(ei);
        if (src) {
          v.src = src;
          v.load();
        }
        return;
      }

      // 2. Online path
      if (activeTargetUrl) {
        if (storedMedia && storedMedia.cleanTitle) {
          mediaTitle = storedMedia.cleanTitle;
        }
        try {
          const details = await fetchMediaDetails({ url: activeTargetUrl, source: targetSource });
          if (isCancelled || !details) return;
          mediaTitle = decodeHtmlEntities(details.cleanTitle || details.title || mediaTitle);
          const sInfo = extractSeasonInfo(details.title || '', details.url);
          seasonLabel = sInfo.seasonLabel;

          if (Array.isArray(details.downloads) && details.downloads.length > 0) {
            EPS = details.downloads.map((d, i) => decodeHtmlEntities(d.label || `Episode ${i + 1}`));
            VIDEO_URLS = details.downloads.map((d) => d.url);
            DOWNLOAD_URLS = details.downloads.map((d) => d.url);
            ei = clamp(ei, 0, EPS.length - 1);
          } else if (details.url) {
            VIDEO_URLS = [details.url];
          }

          renderEpisodesDrawer();
          mark();

          const activeVideoUrl = await resolveSource(ei);
          if (v.src !== activeVideoUrl) {
            v.src = activeVideoUrl;
          }
        } catch (e) {
          console.error('Failed to load online metadata', e);
          renderEpisodesDrawer();
          mark();
        }
      } else {
        renderEpisodesDrawer();
        mark();
        v.src = DEFAULT_SRC;
      }
    }

    initializeMetadata();

    renderEpisodesDrawer();
    mark();
    showUI();

    /* Clean up all event listeners on unmount */
    return () => {
      isCancelled = true;
      if (animReqId) cancelAnimationFrame(animReqId);
      if (ht) clearTimeout(ht);
      if (cdT) clearInterval(cdT);
      if (tapT) clearTimeout(tapT);
      if (volHudT) clearTimeout(volHudT);
      if (brightHudT) clearTimeout(brightHudT);
      if (szHudT) clearTimeout(szHudT);

      v.pause();
      v.src = '';
      
      // Revoke any blob URLs to free memory
      blobUrls.forEach(url => URL.revokeObjectURL(url));

      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', clearBuf);
      v.removeEventListener('canplay', clearBuf);
      v.removeEventListener('seeked', clearBuf);
      v.removeEventListener('loadedmetadata', onLoadedMetadata);
      v.removeEventListener('timeupdate', onTimeUpdate);
      v.removeEventListener('ended', onEnded);

      epr.removeEventListener('click', onEprClick);
      trk.removeEventListener('pointerdown', onTrkPointerDown);
      trk.removeEventListener('pointermove', onTrkPointerMove);
      trk.removeEventListener('pointerup', tend);
      trk.removeEventListener('pointercancel', tend);
      trk.removeEventListener('keydown', onTrkKeyDown);

      surf.removeEventListener('pointerdown', onSurfPointerDown);
      surf.removeEventListener('pointermove', onSurfPointerMove);
      surf.removeEventListener('pointerup', gEnd);
      surf.removeEventListener('pointercancel', gEnd);

      pl.removeEventListener('contextmenu', onContextMenu);
      pl.removeEventListener('pointermove', onPlPointerMove);
      if (uiEl) uiEl.removeEventListener('focusin', onUiFocusIn);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      portraitMql.removeEventListener('change', checkOrientation);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      clearInterval(periodicSync);
    };
  }, [navigate, searchParams]);


  return (
    <>
      <div className="pl" id="pl" data-p="0">
        <video id="v" playsInline preload="auto" />
        <div className="surf" id="surf" />

        {/* Brightness HUD (Left) */}
        <div className="v-hud l" id="bright-hud">
          <svg className="i">
            <use href="#bright-icon" />
          </svg>
          <div className="v-hud-bar">
            <div className="v-hud-fill" id="bright-fill" style={{ height: '61%' }} />
          </div>
          <span className="v-hud-val" id="bright-val">100%</span>
        </div>

        {/* Volume HUD (Right) */}
        <div className="v-hud r" id="vol-hud">
          <svg className="i">
            <use href="#vol-icon" />
          </svg>
          <div className="v-hud-bar">
            <div className="v-hud-fill" id="vol-fill" style={{ height: '100%' }} />
          </div>
          <span className="v-hud-val" id="vol-val">100%</span>
        </div>

        {/* Video Sizing Toast HUD */}
        <div className="sz-hud" id="sz-hud">
          <svg className="i">
            <use href="#sz-icon" />
          </svg>
          <span id="sz-txt">Size: Original</span>
        </div>

        <div className="rip l" id="rl">
          <div>
            <svg className="i">
              <use href="#cr" />
            </svg>
            <svg className="i">
              <use href="#cr" />
            </svg>
            <svg className="i">
              <use href="#cr" />
            </svg>
          </div>
          <span className="rt">10 seconds</span>
        </div>
        <div className="rip r" id="rr">
          <div>
            <svg className="i">
              <use href="#cr" />
            </svg>
            <svg className="i">
              <use href="#cr" />
            </svg>
            <svg className="i">
              <use href="#cr" />
            </svg>
          </div>
          <span className="rt">10 seconds</span>
        </div>
        <div className="spd" id="spd">
          <svg className="i">
            <use href="#cr" />
          </svg>
          2×
        </div>
        <div className="sbub" id="sbub">
          <b id="sbt">0:00</b>
          <small id="sbd" />
        </div>
        <div className="spin" />

        <div className="ui" id="ui">
          <header className="top">
            <button className="ib" id="back" aria-label="Back">
              <svg className="i">
                <use href="#al" />
              </svg>
            </button>
            <h1 id="ttl"> </h1>
            <button className="ib" aria-label="Cast">
              <svg className="i">
                <use href="#cast" />
              </svg>
            </button>
          </header>
          <div className="mid">
            <button className="ib rw" id="bk" aria-label="Back 10 seconds">
              <svg className="i">
                <use href="#rw" />
              </svg>
            </button>
            <button className="ib big" id="pp" aria-label="Play or pause">
              <svg className="i xl">
                <use href="#play" />
              </svg>
              <svg className="i xp">
                <use href="#pause" />
              </svg>
            </button>
            <button className="ib fw" id="fw" aria-label="Forward 10 seconds">
              <svg className="i">
                <use href="#fw" />
              </svg>
            </button>
          </div>
          <div className="bot">
            <div className="pr">
              <div className="trk" id="trk" role="slider" aria-label="Seek" tabIndex={0}>
                <div className="tl">
                  <i className="bf" />
                  <i className="fill" />
                </div>
                <span className="dot" />
                <span className="tip" id="tip" />
              </div>
              <span className="rem" id="rem">
                0:00
              </span>
            </div>
            <div className="btw">
              <div className="bti">
                <div className="bt">
                  <button className="tb" id="eb">
                    <svg className="i">
                      <use href="#eps" />
                    </svg>
                    Episodes
                  </button>
                  <button className="tb" id="pv">
                    <svg className="i">
                      <use href="#prev" />
                    </svg>
                    Previous episode
                  </button>
                  <button className="tb" id="nx">
                    <svg className="i">
                      <use href="#next" />
                    </svg>
                    <span id="nxl">Next episode</span>
                  </button>
                  <button className="tb" id="sz">
                    <svg className="i">
                      <use href="#sz-icon" />
                    </svg>
                    <span id="szl">Original</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="epp" id="epp">
              <div className="epi">
                <div className="eph">
                  <span id="eph-text">Houses &amp; Dragons · Season 1</span>
                  <button className="ib" id="dn" aria-label="Hide episodes">
                    <svg className="i">
                      <use href="#dn" />
                    </svg>
                  </button>
                </div>
                <div className="epr" id="epr" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
