import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavigationRail } from '../components/NavigationRail.tsx';
import {
  opfsService,
  ActiveDownload,
  DoneDownload,
  DoneSeriesDownload,
  DoneMovieDownload,
  StorageStats,
} from '../utils/opfsService.ts';

export const DownloadsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeList, setActiveList] = useState<ActiveDownload[]>([]);
  const [doneList, setDoneList] = useState<DoneDownload[]>([]);
  const [stats, setStats] = useState<StorageStats>({
    downloadsMb: 0,
    otherMb: 0,
    freeMb: 0,
    totalMb: 0,
  });
  const [openSeries, setOpenSeries] = useState<Set<string | number>>(new Set());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [undoFn, setUndoFn] = useState<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribe = opfsService.subscribe((active, done, storageStats) => {
      setActiveList(active);
      setDoneList(done);
      setStats(storageStats);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const formatSize = (mb: number) => {
    if (!mb || mb <= 0) return '0 MB';
    if (mb >= 1024) {
      return (mb / 1024).toFixed(1) + ' GB';
    }
    return (Math.round(mb * 10) / 10) + ' MB';
  };

  const getSeriesTotalSize = (d: DoneSeriesDownload) => {
    return d.eps.reduce((acc, ep) => acc + (ep.mb || 0), 0);
  };

  const calculateEta = (a: ActiveDownload) => {
    const remMb = Math.max(0, (1 - a.p) * a.mb);
    const sec = Math.max(1, Math.round(remMb / (a.spd || 1)));
    return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s left` : `${sec}s left`;
  };

  const getStatusText = (a: ActiveDownload) => {
    if (a.st === 'pz') {
      return `Paused · ${Math.round(a.p * 100)}%`;
    }
    return `${Math.round(a.p * 100)}% · ${a.spd} MB/s · ${calculateEta(a)}`;
  };

  const showToast = (msg: string, undoAction?: () => void) => {
    setToastMsg(msg);
    setUndoFn(() => undoAction || null);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 4500);
  };

  const handlePause = (id: string | number) => {
    opfsService.pauseDownload(id);
  };

  const handleResume = (id: string | number) => {
    opfsService.resumeDownload(id);
  };

  const handleCancel = (id: string | number) => {
    const snapActive = [...activeList];
    const snapDone = [...doneList];
    opfsService.cancelDownload(id);
    showToast('Download cancelled', () => {
      opfsService.restoreSnapshot(snapActive, snapDone);
    });
  };

  const handleDeleteDone = (id: string | number, epIndex?: number) => {
    const snapActive = [...activeList];
    const snapDone = [...doneList];
    const target = doneList.find((x) => String(x.id) === String(id));

    if (target && target.type === 'series' && epIndex !== undefined && target.eps.length > 1) {
      const epName = target.eps[epIndex]?.sub || 'Episode';
      opfsService.deleteDoneDownload(id, epIndex);
      showToast(`${epName} deleted`, () => {
        opfsService.restoreSnapshot(snapActive, snapDone);
      });
    } else {
      const title = target?.t || 'Title';
      opfsService.deleteDoneDownload(id);
      showToast(`${title} deleted`, () => {
        opfsService.restoreSnapshot(snapActive, snapDone);
      });
    }
  };

  const handleDeleteAll = () => {
    const snapActive = [...activeList];
    const snapDone = [...doneList];
    opfsService.deleteAllDoneDownloads();
    showToast('All downloads deleted', () => {
      opfsService.restoreSnapshot(snapActive, snapDone);
    });
  };

  const toggleSeriesAccordion = (id: string | number) => {
    setOpenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePlayMedia = (mediaId: string | number, item: any, epIndex?: number) => {
    const mediaItem = {
      id: String(mediaId),
      title: item.t,
      cleanTitle: item.t,
      poster: item.posterUrl,
      type: item.type,
      year: item.year,
      synopsis: item.synopsis,
    };

    try {
      sessionStorage.setItem('slothui_active_media', JSON.stringify(mediaItem));
    } catch {}

    const searchParams = new URLSearchParams();
    searchParams.set('id', String(mediaId));
    if (epIndex !== undefined) {
      searchParams.set('ep', String(epIndex));
    }
    searchParams.set('offline', '1');

    navigate(`/watch?${searchParams.toString()}`);
  };

  const total = Math.max(1, stats.totalMb);
  const dlPercent = Math.min(100, Math.max(stats.downloadsMb > 0 ? 0.8 : 0, (stats.downloadsMb / total) * 100));
  const otherPercent = Math.min(100 - dlPercent, Math.max(0, (stats.otherMb / total) * 100));

  return (
    <div className="min-h-screen bg-[#0b0e16] text-white font-['Plus_Jakarta_Sans',sans-serif] pb-24">
      <NavigationRail />

      {/* Top Header */}
      <header className="top rv" style={{ '--n': 0 } as React.CSSProperties}>
        <button
          className="ic bk"
          aria-label="Back"
          onClick={() => navigate(-1)}
          style={{ position: 'absolute', left: 'calc(var(--rail) + 1.25rem)', zIndex: 10 }}
        >
          <svg className="i">
            <use href="#al" />
          </svg>
        </button>
        <div className="brand" style={{ position: 'static', transform: 'none', margin: '0 auto' }}>
          <span className="logo" style={{ width: '1.8rem', height: '1.8rem', fontSize: '0.9rem' }}>M</span>
          <span>Mad<b>Hata</b> Downloads</span>
        </div>
      </header>

      <main style={{ maxWidth: '82rem', margin: '0 auto' }}>
        {/* Factual Storage Bar Section */}
        <section className="stg rv" style={{ '--n': 1 } as React.CSSProperties} id="stg" aria-label="Storage">
          <div className="l">
            <span>
              <b id="su">{formatSize(stats.downloadsMb)}</b> used by downloads
            </span>
            <span id="sf">
              {stats.totalMb > 0
                ? `${formatSize(stats.freeMb)} free of ${formatSize(stats.totalMb)}`
                : 'Estimating device storage...'}
            </span>
          </div>
          <div className="stg-sbar">
            <i className="o" id="so" style={{ width: `${otherPercent}%` }}></i>
            <i className="d" id="sd" style={{ width: `${dlPercent}%` }}></i>
          </div>
        </section>

        {/* Content Section */}
        <div className="ct rv" style={{ '--n': 2 } as React.CSSProperties} id="ct">
          {activeList.length === 0 && doneList.length === 0 ? (
            <div className="empty" style={{ marginTop: '5rem' }}>
              <div className="big" style={{ width: '5rem', height: '5rem', border: '2px solid rgba(255,255,255,0.15)' }}>
                <svg className="i" style={{ width: '2.2rem', height: '2.2rem', color: 'rgba(255,255,255,0.4)' }}>
                  <use href="#dl" />
                </svg>
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '1rem' }}>No downloads yet</h3>
              <p style={{ maxWidth: '20rem', margin: '0.6rem auto', opacity: 0.6, fontSize: '0.88rem' }}>
                Titles you download will show up here so you can watch them offline anytime with OPFS.
              </p>
            </div>
          ) : (
            <>
              {/* Active Downloads */}
              {activeList.length > 0 && (
                <>
                  <div className="sh">
                    <span>
                      Downloading<small>{activeList.length}</small>
                    </span>
                  </div>
                  <div className="lst">
                    {activeList.map((a, i) => (
                      <div
                        key={a.id}
                        className={`dc ${a.st === 'pz' ? 'pz' : ''}`}
                        style={{ '--i': i } as React.CSSProperties}
                        data-id={a.id}
                      >
                        <div className="dr">
                          <span
                            className="th"
                            style={{
                              backgroundImage: a.posterUrl ? `url(${a.posterUrl})` : undefined,
                              backgroundColor: `hsl(${(a.k * 47 + 210) % 360} 45% 25%)`,
                            }}
                          >
                            <span className="q">{a.q}</span>
                          </span>
                          <span className="tx">
                            <b>{a.t}</b>
                            <small>
                              {a.l ? `${a.l} · ` : ''}
                              {a.sub} · {formatSize(a.mb)}
                            </small>
                            <span className="bar">
                              <i style={{ '--p': a.p, transform: `scaleX(${a.p})` } as React.CSSProperties}></i>
                            </span>
                            <em data-s>{getStatusText(a)}</em>
                          </span>
                          <span className="ac">
                            {a.st === 'pz' ? (
                              <button
                                className="ib"
                                onClick={() => handleResume(a.id)}
                                aria-label="Resume download"
                              >
                                <svg className="i">
                                  <use href="#play" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                className="ib"
                                onClick={() => handlePause(a.id)}
                                aria-label="Pause download"
                              >
                                <svg className="i">
                                  <use href="#pause" />
                                </svg>
                              </button>
                            )}
                            <button
                              className="ib rd"
                              onClick={() => handleCancel(a.id)}
                              aria-label="Cancel download"
                            >
                              <svg className="i">
                                <use href="#x" />
                              </svg>
                            </button>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Completed Downloads */}
              {doneList.length > 0 && (
                <>
                  <div className="sh">
                    <span>
                      Downloaded<small>{doneList.length}</small>
                    </span>
                    <button className="lnk" onClick={handleDeleteAll}>
                      Delete all
                    </button>
                  </div>
                  <div className="lst">
                    {doneList.map((d, i) => {
                      if (d.type === 'movie') {
                        const m = d as DoneMovieDownload;
                        return (
                          <div
                            key={m.id}
                            className="dc"
                            style={{ '--i': i } as React.CSSProperties}
                            data-id={m.id}
                          >
                            <div className="dr">
                              <span
                                className="th"
                                style={{
                                  backgroundImage: m.posterUrl ? `url(${m.posterUrl})` : undefined,
                                  backgroundColor: `hsl(${(m.k * 47 + 210) % 360} 45% 25%)`,
                                }}
                              >
                                <span className="q">{m.q}</span>
                              </span>
                              <span className="tx">
                                <b>{m.t}</b>
                                <small>
                                  {m.sub} · {formatSize(m.mb)}
                                </small>
                                <em className={m.exp <= 3 ? 'warn' : ''}>
                                  Expires in {m.exp} {m.exp === 1 ? 'day' : 'days'}
                                </em>
                              </span>
                              <span className="ac">
                                <button
                                  className="ib pr"
                                  onClick={() => handlePlayMedia(m.id, m)}
                                  aria-label={`Play ${m.t}`}
                                >
                                  <svg className="i">
                                    <use href="#play" />
                                  </svg>
                                </button>
                                <button
                                  className="ib rd"
                                  onClick={() => handleDeleteDone(m.id)}
                                  aria-label={`Delete ${m.t}`}
                                >
                                  <svg className="i">
                                    <use href="#trash" />
                                  </svg>
                                </button>
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // Series
                      const s = d as DoneSeriesDownload;
                      const isOpen = openSeries.has(s.id);
                      const totalSize = getSeriesTotalSize(s);
                      const minExp = Math.min(...s.eps.map((e) => e.exp));

                      return (
                        <div
                          key={s.id}
                          className="dc"
                          style={{ '--i': i } as React.CSSProperties}
                          data-id={s.id}
                        >
                          <div className="dr">
                            <span
                              className="th"
                              style={{
                                backgroundImage: s.posterUrl ? `url(${s.posterUrl})` : undefined,
                                backgroundColor: `hsl(${(s.k * 47 + 210) % 360} 45% 25%)`,
                              }}
                            >
                              <span className="q">{s.q}</span>
                            </span>
                            <span className="tx">
                              <b>{s.t}</b>
                              <small>
                                {s.eps.length} episode{s.eps.length === 1 ? '' : 's'} · {formatSize(totalSize)}
                              </small>
                              <em className={minExp <= 3 ? 'warn' : ''}>
                                Expires in {minExp} {minExp === 1 ? 'day' : 'days'}
                              </em>
                            </span>
                            <span className="ac">
                              <button
                                className="ib rd"
                                onClick={() => handleDeleteDone(s.id)}
                                aria-label={`Delete ${s.t}`}
                              >
                                <svg className="i">
                                  <use href="#trash" />
                                </svg>
                              </button>
                              <button
                                className="ib ch"
                                aria-expanded={isOpen}
                                onClick={() => toggleSeriesAccordion(s.id)}
                                aria-label="Show episodes"
                              >
                                <svg className="i">
                                  <use href="#chev" />
                                </svg>
                              </button>
                            </span>
                          </div>

                          {/* Accordion Episodes Wrapper */}
                          <div className={`er-w ${isOpen ? 'open' : ''}`}>
                            <div className="er-i">
                              {s.eps.map((ep, j) => (
                                <div key={j} className="er">
                                  <span className="tx">
                                    <b>
                                      {ep.l} · {ep.sub}
                                    </b>
                                    <small>
                                      {formatSize(ep.mb)} · Expires in {ep.exp} days
                                    </small>
                                  </span>
                                  <button
                                    className="ib pr"
                                    onClick={() => handlePlayMedia(s.id, s, j)}
                                    aria-label={`Play ${ep.sub}`}
                                  >
                                    <svg className="i">
                                      <use href="#play" />
                                    </svg>
                                  </button>
                                  <button
                                    className="ib rd"
                                    onClick={() => handleDeleteDone(s.id, j)}
                                    aria-label={`Delete ${ep.sub}`}
                                  >
                                    <svg className="i">
                                      <use href="#trash" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Undo Toast */}
      <div className={`toast ${toastMsg ? 'on' : ''}`} id="toast" role="status">
        <span>{toastMsg}</span>
        {undoFn && (
          <button
            onClick={() => {
              if (undoFn) undoFn();
              setToastMsg(null);
            }}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
};
