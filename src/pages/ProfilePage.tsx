import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { NavigationRail } from '../components/NavigationRail.tsx';
import { 
  WatchlistItem, 
  HistoryItem, 
  UserStats, 
  listenToWatchlist, 
  listenToHistory, 
  listenToUserStats,
  removeFromWatchlist, 
  removeFromHistory, 
  clearWatchHistory, 
  addToWatchlist, 
  saveWatchProgress,
  recordDailyVisit 
} from '../utils/userDataService.ts';
import { storeActiveMedia } from '../utils/mediaWorkerApi.ts';
import { decodeHtmlEntities } from '../utils/textUtils.ts';
import '../styles/profilePage.css';

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();

  const [tab, setTab] = useState<'h' | 'w'>('h');
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    totalWatchMinutes: 142 * 60,
    totalTitlesWatched: 0,
    totalWatchlistCount: 0,
    totalDownloads: 0,
    lastUpdated: Date.now(),
  });

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);
  const undoRef = useRef<(() => void) | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggedOutView, setIsLoggedOutView] = useState(false);

  // Record daily visit on profile load
  useEffect(() => {
    if (user?.uid) {
      recordDailyVisit(user.uid);
    }
  }, [user?.uid]);

  // Listen to RTDB Watchlist
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenToWatchlist(user.uid, (items) => {
      setWatchlistItems(items);
    });
    return () => unsub();
  }, [user?.uid]);

  // Listen to RTDB Watch History
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenToHistory(user.uid, (items) => {
      setHistoryItems(items);
    });
    return () => unsub();
  }, [user?.uid]);

  // Listen to RTDB User Stats
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenToUserStats(user.uid, (stats) => {
      setUserStats(stats);
    });
    return () => unsub();
  }, [user?.uid]);

  // Toast trigger
  const triggerToast = (msg: string, undoFn?: () => void) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    undoRef.current = undoFn || null;
    setToastMsg(msg);
    setShowToast(true);

    toastTimeoutRef.current = setTimeout(() => {
      setShowToast(false);
      undoRef.current = null;
    }, 4500);
  };

  const handleUndo = () => {
    if (undoRef.current) {
      undoRef.current();
      undoRef.current = null;
    }
    setShowToast(false);
  };

  // Remove from history
  const handleRemoveHistory = (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation();
    if (!user?.uid) return;
    removeFromHistory(user.uid, item.id);
    triggerToast('Removed from history', () => {
      saveWatchProgress(user.uid, item);
    });
  };

  // Clear history
  const handleClearHistory = () => {
    if (!user?.uid || !historyItems.length) return;
    const backup = [...historyItems];
    clearWatchHistory(user.uid);
    triggerToast('History cleared', () => {
      backup.forEach((it) => saveWatchProgress(user.uid, it));
    });
  };

  // Remove from watchlist
  const handleRemoveWatchlist = (e: React.MouseEvent, item: WatchlistItem) => {
    e.stopPropagation();
    if (!user?.uid) return;
    removeFromWatchlist(user.uid, item.id);
    triggerToast('Removed from watchlist', () => {
      addToWatchlist(user.uid, item);
    });
  };

  // Navigate to media details
  const handleOpenMedia = (media: { id: string; title: string; poster?: string; url: string; source?: string }) => {
    storeActiveMedia({
      id: media.id,
      title: media.title,
      cleanTitle: media.title,
      poster: media.poster || '',
      url: media.url,
      source: media.source || '1',
    });
    navigate(`/details?url=${encodeURIComponent(media.url)}&source=${encodeURIComponent(media.source || '1')}`);
  };

  // Navigate to player
  const handlePlayMedia = (e: React.MouseEvent, media: HistoryItem) => {
    e.stopPropagation();
    handleOpenMedia(media);
  };

  // Total watch hours calculation from real RTDB stats and history
  const totalWatchDisplay = useMemo(() => {
    const fromStats = userStats.totalWatchMinutes || 0;
    const fromHistory = Math.round(
      historyItems.reduce((acc, h) => acc + Math.round((h.duration || 0) * (h.progress || 0)), 0)
    );
    const totalMinutes = Math.max(fromStats, fromHistory);
    if (totalMinutes === 0) return '0h';
    if (totalMinutes < 60) return `${totalMinutes}m`;
    const hours = Math.round(totalMinutes / 60);
    return `${hours}h`;
  }, [userStats.totalWatchMinutes, historyItems]);

  const totalDownloadsCount = userStats.totalDownloads || 0;

  // Grouped history
  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistoryItem[]> = {};
    historyItems.forEach((h) => {
      const g = h.group || 'Today';
      if (!groups[g]) groups[g] = [];
      groups[g].push(h);
    });
    return groups;
  }, [historyItems]);

  const avatarGradient = profile?.c1 && profile?.c2
    ? `radial-gradient(circle at 35% 30%, ${profile.c1}, ${profile.c2} 58%, #08216b)`
    : 'radial-gradient(circle at 35% 30%, #2f7cf6, #0d3fc4 58%, #08216b)';

  const handleLogout = async () => {
    setShowLogoutDialog(false);
    try {
      await logout();
      setIsLoggedOutView(true);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="profile-page-root">
      <NavigationRail onHomeClick={() => navigate('/')} />

      {/* Top Header Bar */}
      <header className="top rv" style={{ ['--n' as string]: 0 }}>
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
        <div className="brand">
          <span className="logo">M</span>
          <span>Mad<b>Hata</b></span>
        </div>
      </header>

      <main>
        {!isLoggedOutView ? (
          <div id="app" style={{ width: '100%' }}>
            {/* Profile Info Header */}
            <section className="ph rv" style={{ ['--n' as string]: 1 }}>
              <div
                className="avt"
                role="img"
                aria-label="Profile picture"
                style={{ background: avatarGradient }}
              />
              <div className="pn">
                <h1>{profile?.name || user?.displayName || 'MadHata'}</h1>
                <p>Member since 2026</p>
              </div>

              <div className="stats">
                <div>
                  <b>{totalWatchDisplay}</b>
                  <span>Watched</span>
                </div>
                <div>
                  <b id="sh">{totalDownloadsCount}</b>
                  <span>Downloaded</span>
                </div>
                <div>
                  <b id="sw">{watchlistItems.length}</b>
                  <span>Watchlist</span>
                </div>
              </div>

              <button className="lo" id="lo" type="button" onClick={() => setShowLogoutDialog(true)}>
                <svg className="i">
                  <use href="#out" />
                </svg>
                Log out
              </button>
            </section>

            {/* Tabs Row */}
            <div className="tabs rv" style={{ ['--n' as string]: 2 }}>
              <div className="seg" role="tablist">
                <button
                  role="tab"
                  className={tab === 'h' ? 'on' : ''}
                  aria-selected={tab === 'h'}
                  onClick={() => setTab('h')}
                >
                  Watch history <small id="ch">{historyItems.length}</small>
                </button>
                <button
                  role="tab"
                  className={tab === 'w' ? 'on' : ''}
                  aria-selected={tab === 'w'}
                  onClick={() => setTab('w')}
                >
                  Watchlist <small id="cw">{watchlistItems.length}</small>
                </button>
              </div>
              {tab === 'h' && historyItems.length > 0 && (
                <button className="lnk" id="clr" onClick={handleClearHistory}>
                  Clear history
                </button>
              )}
            </div>

            {/* Content Area */}
            <div className="ct rv" style={{ ['--n' as string]: 3 }} id="ct">
              {tab === 'h' ? (
                /* Watch History Tab */
                historyItems.length === 0 ? (
                  <div className="empty">
                    <div className="big">
                      <svg className="i">
                        <use href="#clock" />
                      </svg>
                    </div>
                    <h3>Nothing watched yet</h3>
                    <p>Start a title and it will show up here so you can pick up where you left off.</p>
                  </div>
                ) : (
                  Object.entries(groupedHistory).map(([grp, items]) => (
                    <div key={grp}>
                      <h3 className="grp">{grp}</h3>
                      <div className="hg">
                        {items.map((h, idx) => {
                          const leftMinutes = Math.round((h.duration || 50) * (1 - (h.progress || 0)));
                          const isFullyWatched = (h.progress || 0) >= 0.95;
                          const thumbUrl = h.poster;

                          return (
                            <div className="hc n" key={h.id || idx} style={{ ['--i' as string]: idx % 12 }}>
                              <button className="hb" onClick={() => handleOpenMedia(h)}>
                                <span
                                  className="th"
                                  style={
                                    thumbUrl
                                      ? { backgroundImage: `url(${thumbUrl})`, backgroundSize: 'cover' }
                                      : { background: 'linear-gradient(135deg, #1d2742, #0d1424)' }
                                  }
                                >
                                  <span className="pl" onClick={(e) => handlePlayMedia(e, h)}>
                                    <svg className="i">
                                      <use href="#play" />
                                    </svg>
                                  </span>
                                  {h.progress > 0 && (
                                    <span className="pb" style={{ ['--p' as string]: h.progress }}>
                                      <i />
                                    </span>
                                  )}
                                </span>
                                <span className="tx">
                                  <b>{decodeHtmlEntities(h.title)}</b>
                                  <small>{h.label || 'Movie'} · {h.duration || 50}m</small>
                                  <em>
                                    {isFullyWatched ? 'Watched' : `${leftMinutes}m left`} · {h.group || 'Recently'}
                                  </em>
                                </span>
                              </button>
                              <button
                                className="rm"
                                aria-label={`Remove ${h.title} from history`}
                                onClick={(e) => handleRemoveHistory(e, h)}
                              >
                                <svg className="i">
                                  <use href="#x" />
                                </svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )
              ) : (
                /* Watchlist Tab */
                watchlistItems.length === 0 ? (
                  <div className="empty">
                    <div className="big">
                      <svg className="i">
                        <use href="#mark" />
                      </svg>
                    </div>
                    <h3>Your watchlist is empty</h3>
                    <p>Save titles you want to see later and they will wait for you here.</p>
                  </div>
                ) : (
                  <div className="wl">
                    {watchlistItems.map((w, idx) => (
                      <div className="sc n" key={w.id || idx} style={{ ['--i' as string]: idx % 14 }}>
                        <button className="pzb" onClick={() => handleOpenMedia(w)}>
                          <span
                            className="pz"
                            style={
                              w.poster
                                ? { backgroundImage: `url(${w.poster})`, backgroundSize: 'cover' }
                                : { background: 'linear-gradient(180deg, #c08c36, #6b4a1c 52%, #1b1510)' }
                            }
                          >
                            <span>{decodeHtmlEntities(w.title)}</span>
                          </span>
                          <span className="cp">
                            <span>{w.year || '2026'} · {w.type || 'Movie'}</span>
                            <em>★ {w.rating || '4.8'}</em>
                          </span>
                        </button>
                        <button
                          className="rm"
                          aria-label={`Remove ${w.title} from watchlist`}
                          onClick={(e) => handleRemoveWatchlist(e, w)}
                        >
                          <svg className="i">
                            <use href="#x" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        ) : (
          /* Logged out state */
          <section className="so" id="so">
            <div className="ob">
              <svg className="i">
                <use href="#out" />
              </svg>
            </div>
            <h2>You’re logged out</h2>
            <p>See you next time. Your history and watchlist will be here when you sign back in.</p>
            <button className="go" id="in" onClick={() => navigate('/whos-watching')}>
              Sign in
            </button>
          </section>
        )}
      </main>

      {/* Undo Toast Notification */}
      <div className={`toast ${showToast ? 'on' : ''}`} id="toast" role="status">
        <span id="tm">{toastMsg}</span>
        <button id="undo" onClick={handleUndo}>
          Undo
        </button>
      </div>

      {/* Logout Confirmation Dialog Modal */}
      {showLogoutDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(5, 7, 12, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowLogoutDialog(false)}
        >
          <div
            style={{
              width: 'min(92vw, 26rem)',
              padding: '1.8rem',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '1.4rem',
              background: '#121a2b',
              color: '#fff',
              boxShadow: '0 2rem 5rem -1rem rgba(0, 0, 0, 0.9)',
              animation: 'pop 0.45s cubic-bezier(.22, 1, .36, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Log out of MadHata?</h3>
            <p style={{ marginTop: '0.6rem', fontSize: '0.88rem', lineHeight: 1.6, color: '#aab0c0' }}>
              You’ll need to sign in again to keep watching and to see your list.
            </p>
            <div className="da">
              <button className="gh" type="button" onClick={() => setShowLogoutDialog(false)}>
                Cancel
              </button>
              <button className="dg" type="button" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
