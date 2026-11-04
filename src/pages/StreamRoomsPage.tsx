import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { NavigationRail } from '../components/NavigationRail.tsx';
import { CreateRoomModal } from '../components/CreateRoomModal.tsx';
import { CreatePollModal } from '../components/CreatePollModal.tsx';
import {
  StreamRoom,
  UserRoomRecord,
  listenToUserRooms,
  listenToStreamRoom,
  joinStreamRoom,
  leaveStreamRoom,
  removeRoomMember,
  sendRoomMessage,
  voteInPoll,
  finalizeWinningMedia,
  notifyRoomMembers,
} from '../utils/streamRoomService.ts';

export const StreamRoomsPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId: routeRoomId } = useParams<{ roomId?: string }>();
  const [searchParams] = useSearchParams();
  const { user, profile, loginAsGuest } = useAuth();
  const [loggingInGuest, setLoggingInGuest] = useState(false);

  const [userRooms, setUserRooms] = useState<UserRoomRecord[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(routeRoomId || null);
  const [activeRoom, setActiveRoom] = useState<StreamRoom | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [membersDrawerOpen, setMembersDrawerOpen] = useState(false);
  const [showReactionsHistory, setShowReactionsHistory] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Chat message input
  const [inputText, setInputText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Countdown timer trigger
  const [nowTime, setNowTime] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync route room id if changed
  useEffect(() => {
    if (routeRoomId && routeRoomId !== activeRoomId) {
      setActiveRoomId(routeRoomId);
    }
  }, [routeRoomId]);

  // Handle guest login
  const handleGuestLogin = async () => {
    if (loggingInGuest) return;
    setLoggingInGuest(true);
    try {
      const guestUser = await loginAsGuest();
      if (activeRoomId) {
        await joinStreamRoom(activeRoomId, guestUser, {
          name: `Guest-${guestUser.uid.slice(0, 4).toUpperCase()}`,
          avatarIndex: 0,
          c1: '#8a6bff',
          c2: '#3b2fd0',
        });
      }
    } catch (err) {
      console.error('Failed guest login:', err);
    } finally {
      setLoggingInGuest(false);
    }
  };

  // 1. Listen to user's personal rooms list
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenToUserRooms(user.uid, (rooms) => {
      setUserRooms(rooms);
      setLoadingRooms(false);

      // Auto select first room if on desktop and none selected
      if (!activeRoomId && rooms.length > 0 && window.innerWidth >= 768) {
        setActiveRoomId(rooms[0].roomId);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // 2. Listen to active room (runs for guests too to display room preview & polls)
  useEffect(() => {
    if (!activeRoomId) {
      setActiveRoom(null);
      return;
    }

    const unsub = listenToStreamRoom(activeRoomId, async (room) => {
      if (!room) {
        setActiveRoom(null);
        return;
      }
      setActiveRoom(room);

      // If user is authenticated and isn't recorded as member yet, auto-join
      if (user?.uid && (!room.members || !room.members[user.uid])) {
        await joinStreamRoom(activeRoomId, user, profile);
      }
    });

    return () => unsub();
  }, [activeRoomId, user, profile]);

  // Auto scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [activeRoom?.messages]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeRoomId || !user) return;
    const text = inputText.trim();
    setInputText('');
    setSendingMsg(true);
    try {
      await sendRoomMessage(activeRoomId, user, profile, text, activeRoom?.name);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSendingMsg(false);
    }
  };

  // Copy share link
  const handleCopyLink = () => {
    if (!activeRoomId) return;
    const shareUrl = `${window.location.origin}/stream-room/${activeRoomId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }).catch(() => {});
  };

  // Jump to player for active stream
  const handleJoinPlayer = () => {
    if (!activeRoom || !activeRoom.currentMedia) return;
    const { url, id, title, source } = activeRoom.currentMedia;
    navigate(`/watch?room=${activeRoom.id}&url=${encodeURIComponent(url)}&id=${encodeURIComponent(id)}&title=${encodeURIComponent(title)}&source=${encodeURIComponent(source || '1')}`);
  };

  // Format countdown string
  const getCountdownString = (targetTimestamp: number) => {
    const diff = Math.max(0, Math.floor((targetTimestamp - nowTime) / 1000));
    if (diff <= 0) return 'Ready to start!';
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const isHost = activeRoom?.creatorUid === user?.uid;
  const membersList = activeRoom?.members ? Object.values(activeRoom.members) : [];
  const onlineCount = membersList.filter((m) => m.online !== false).length;
  const messagesList = activeRoom?.messages ? Object.values(activeRoom.messages).sort((a, b) => a.timestamp - b.timestamp) : [];
  const pollsList = activeRoom?.polls ? Object.values(activeRoom.polls).sort((a, b) => b.createdAt - a.createdAt) : [];
  const activePoll = pollsList.find((p) => p.active) || pollsList[0];
  const reactionsList = activeRoom?.reactions ? Object.values(activeRoom.reactions).sort((a, b) => b.timestamp - a.timestamp) : [];

  return (
    <div className="flex h-screen w-screen bg-[#0d0f17] text-white font-sans overflow-hidden select-none">
      {/* MadHata Global Navigation Rail (Hidden on mobile inside stream rooms) */}
      <NavigationRail onHomeClick={() => navigate('/')} hideOnMobile />

      {/* Main Stream Rooms Layout */}
      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden ml-0 md:ml-[var(--rail,64px)]">
        
        {/* Left Column: Rooms List (Shown on desktop always; on mobile when no active room selected) */}
        <aside 
          className={`w-full md:w-80 lg:w-96 h-full flex flex-col bg-[#11131f] border-r border-white/5 flex-shrink-0 transition-all ${
            activeRoomId && 'hidden md:flex'
          }`}
        >
          {/* Top Bar with Header and Create "+" button */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/5 bg-[#141624]">
            <div className="flex items-center gap-2.5">
              <button 
                type="button"
                onClick={() => navigate('/profile')} 
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                aria-label="Back to Profile"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-base font-bold text-white tracking-wide">Stream Rooms</h2>
            </div>

            {/* Create Room "+" Button */}
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              aria-label="Create Stream Room"
              className="w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center font-bold text-lg shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              +
            </button>
          </div>

          {/* Rooms List Content */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingRooms ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-white/40 text-xs">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span>Loading your rooms...</span>
              </div>
            ) : userRooms.length === 0 ? (
              /* Empty state if user is not part of any stream rooms */
              <div className="flex flex-col items-center justify-center h-[70vh] p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-3xl mb-4">
                  🍿
                </div>
                <h3 className="text-base font-bold text-white mb-1">No Stream Rooms Yet</h3>
                <p className="text-xs text-white/50 max-w-xs mb-5 leading-relaxed">
                  Stream rooms let you sync movies with friends, vote on what to watch with live polls, and react together in real-time.
                </p>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-95"
                >
                  + Create Your First Room
                </button>
              </div>
            ) : (
              userRooms.map((room) => {
                const isSelected = room.roomId === activeRoomId;
                return (
                  <button
                    key={room.roomId}
                    type="button"
                    onClick={() => {
                      setActiveRoomId(room.roomId);
                      navigate(`/stream-room/${room.roomId}`);
                    }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? 'bg-purple-600/20 text-white border border-purple-500/30'
                        : 'hover:bg-white/5 text-white/80 border border-transparent'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-black/40 border border-white/10">
                      <img src={room.poster} alt={room.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight">{room.name}</p>
                      <p className="text-[11px] text-white/40 mt-0.5">Click to open chat & stream</p>
                    </div>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-purple-500 mr-1 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Area: Discord-Style Chat & Stream Panel */}
        {activeRoomId ? (
          <main className="flex-1 flex flex-col h-full bg-[#0d0f17] overflow-hidden">
            {/* Top Bar: Back button, circle room image, member count (number only), copy link icon */}
            <header className="h-16 px-4 flex items-center justify-between border-b border-white/5 bg-[#121422] flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Back button on mobile to return to rooms list */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveRoomId(null);
                    navigate('/stream-rooms');
                  }}
                  className="md:hidden w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/70 hover:text-white"
                  aria-label="Back to rooms"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Circle of room image beside it */}
                <div className="w-9 h-9 rounded-full overflow-hidden border border-white/15 bg-black/40 flex-shrink-0">
                  <img
                    src={activeRoom?.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop&q=80'}
                    alt={activeRoom?.name || 'Room'}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Room Title */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm md:text-base font-bold text-white truncate leading-tight">
                      {activeRoom?.name || 'Watchroom'}
                    </h1>
                    {isHost && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Host
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-white/40 truncate">
                    {activeRoom?.status === 'playing' ? '🔴 Live Streaming' : activeRoom?.status === 'voting' ? '🗳️ Movie Poll Active' : 'Waiting for stream'}
                  </p>
                </div>
              </div>

              {/* End of top bar: Member count (number only) and copy icon */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Reaction history toggle */}
                <button
                  type="button"
                  onClick={() => setShowReactionsHistory(!showReactionsHistory)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    showReactionsHistory
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white/70'
                  }`}
                  title="View Reaction History"
                >
                  <span>🔥</span>
                  <span className="hidden sm:inline">Reactions</span>
                </button>

                {/* Member Count (just number) clickable to open members drawer */}
                <button
                  type="button"
                  onClick={() => setMembersDrawerOpen(!membersDrawerOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 transition-colors"
                  title="View Members"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold">{membersList.length}</span>
                </button>

                {/* Copy share link icon */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  aria-label="Copy share link"
                  title="Copy room link"
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors relative"
                >
                  {copyFeedback ? (
                    <span className="text-xs text-emerald-400 font-bold">✓</span>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </header>

            {/* Active Stream Banner (If playing or scheduled) */}
            {activeRoom?.currentMedia && (
              <div className="bg-purple-950/40 border-b border-purple-500/20 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-14 rounded overflow-hidden bg-black/60 flex-shrink-0 border border-white/10">
                    <img src={activeRoom.currentMedia.poster} alt={activeRoom.currentMedia.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                        {activeRoom.status === 'playing' ? 'Watching Now' : 'Scheduled Stream'}
                      </span>
                      {activeRoom.scheduledStartTime && activeRoom.status !== 'playing' && (
                        <span className="text-[10px] font-semibold text-emerald-400">
                          ⏱ {getCountdownString(activeRoom.scheduledStartTime)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs md:text-sm font-semibold text-white truncate">{activeRoom.currentMedia.title}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleJoinPlayer}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-1 flex-shrink-0"
                >
                  <span>▶</span> Join Stream
                </button>
              </div>
            )}

            {/* Main Chat & Reaction Body */}
            <div className="flex-1 flex overflow-hidden relative">
              
              {/* Chat Messages Area (Discord-like, flat, no shadows, no bubbles) */}
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <div 
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 no-scrollbar"
                >
                  {/* Countdown / Welcome hero card if in voting or scheduled state */}
                  {activeRoom?.scheduledStartTime && activeRoom.status === 'scheduled' && (
                    <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-center flex flex-col items-center mb-4">
                      <span className="text-2xl mb-1">⏳</span>
                      <h4 className="text-sm font-bold text-white">Stream Starts In:</h4>
                      <p className="text-xl font-mono font-bold text-purple-400 mt-1">
                        {getCountdownString(activeRoom.scheduledStartTime)}
                      </p>
                      <p className="text-xs text-white/50 mt-1">All members present will automatically sync at start</p>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => {
                            if (activeRoom.currentMedia) {
                              finalizeWinningMedia(
                                activeRoom.id,
                                'direct',
                                {
                                  id: activeRoom.currentMedia.id,
                                  title: activeRoom.currentMedia.title,
                                  poster: activeRoom.currentMedia.poster,
                                  url: activeRoom.currentMedia.url,
                                  source: activeRoom.currentMedia.source || '1',
                                  votes: {},
                                },
                                true,
                                activeRoom.name
                              );
                            }
                          }}
                          className="mt-3 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        >
                          Start Stream Now
                        </button>
                      )}
                    </div>
                  )}

                  {/* Active Polls Rendered Inline in Chat */}
                  {pollsList.map((poll) => {
                    const totalVotes = poll.options.reduce(
                      (acc, opt) => acc + (opt.votes ? Object.keys(opt.votes).length : 0),
                      0
                    );

                    return (
                      <div 
                        key={poll.id}
                        className="p-4 rounded-xl bg-[#141724] border border-white/10 my-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                              Movie Poll · by {poll.creatorName}
                            </span>
                            <h3 className="text-sm font-bold text-white mt-0.5">{poll.question}</h3>
                          </div>
                          {poll.active ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/40 font-semibold">
                              Ended
                            </span>
                          )}
                        </div>

                        {/* Candidates Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {poll.options.map((opt) => {
                            const optVotesCount = opt.votes ? Object.keys(opt.votes).length : 0;
                            const pct = totalVotes > 0 ? Math.round((optVotesCount / totalVotes) * 100) : 0;
                            const hasVoted = Boolean(user && opt.votes && opt.votes[user.uid]);
                            const isWinner = poll.winningOptionId === opt.id;

                            return (
                              <div
                                key={opt.id}
                                className={`relative p-2.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                                  isWinner
                                    ? 'bg-purple-900/30 border-purple-500'
                                    : hasVoted
                                    ? 'bg-white/10 border-white/30'
                                    : 'bg-white/5 border-white/5 hover:border-white/20'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 mb-2">
                                  <div className="w-10 h-14 rounded overflow-hidden bg-black/40 flex-shrink-0">
                                    <img src={opt.poster} alt={opt.title} className="w-full h-full object-cover" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-white truncate">{opt.title}</p>
                                    <p className="text-[11px] text-white/50">{optVotesCount} {optVotesCount === 1 ? 'vote' : 'votes'} ({pct}%)</p>
                                  </div>
                                </div>

                                {/* Progress bar */}
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                                  <div
                                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>

                                <div className="flex items-center justify-between gap-1">
                                  {poll.active && (
                                    <button
                                      type="button"
                                      onClick={() => user && activeRoom && voteInPoll(activeRoom.id, poll.id, opt.id, user.uid)}
                                      className={`flex-1 py-1 rounded text-[11px] font-semibold transition-all ${
                                        hasVoted
                                          ? 'bg-purple-600 text-white'
                                          : 'bg-white/10 hover:bg-white/20 text-white/80'
                                      }`}
                                    >
                                      {hasVoted ? '✓ Voted' : 'Vote'}
                                    </button>
                                  )}

                                  {isHost && poll.active && (
                                    <button
                                      type="button"
                                      onClick={() => activeRoom && finalizeWinningMedia(activeRoom.id, poll.id, opt, true, activeRoom.name)}
                                      className="px-2 py-1 rounded text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                                      title="Pick as winner and start streaming"
                                    >
                                      Pick & Watch
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Messages Feed (Protected from unauthenticated viewers) */}
                  {!user ? (
                    <div className="py-16 text-center text-white/50 text-xs px-4">
                      <span className="text-3xl mb-2.5 block">🔒</span>
                      <p className="font-semibold text-white/90 text-sm mb-1">
                        Sign in to view chat messages
                      </p>
                      <p className="max-w-xs mx-auto text-white/50 leading-relaxed">
                        Chat details are private to room members. Sign in or continue as guest below to view chat and participate.
                      </p>
                    </div>
                  ) : messagesList.length === 0 ? (
                    <div className="py-12 text-center text-white/40 text-xs">
                      No messages yet. Say hello or launch a movie poll!
                    </div>
                  ) : (
                    messagesList.map((msg) => {
                      if (msg.type === 'system') {
                        return (
                          <div key={msg.id} className="flex items-center justify-center my-5 py-1">
                            <span className="text-[11px] font-medium text-purple-300/90 bg-purple-950/50 px-4 py-1.5 rounded-full border border-purple-500/20 shadow-sm text-center tracking-wide">
                              {msg.text}
                            </span>
                          </div>
                        );
                      }

                      const avatarGradient = msg.c1 && msg.c2
                        ? `radial-gradient(circle at 35% 30%, ${msg.c1}, ${msg.c2} 58%, #08216b)`
                        : 'radial-gradient(circle at 35% 30%, #2f7cf6, #0d3fc4 58%, #08216b)';

                      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <div key={msg.id} className="flex items-start gap-3 my-3 px-1.5 py-1 hover:bg-white/[0.02] rounded-lg transition-colors">
                          {/* Circular User Avatar */}
                          <div
                            className="w-8 h-8 rounded-full flex-shrink-0 text-white font-bold text-xs flex items-center justify-center select-none shadow-sm"
                            style={{ background: avatarGradient }}
                          >
                            {(msg.senderName || 'U').charAt(0).toUpperCase()}
                          </div>

                          {/* Message Body */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-xs font-semibold text-white/90">
                                {msg.senderName}
                              </span>
                              <span className="text-[10px] text-white/40">
                                {timeStr}
                              </span>
                            </div>
                            {/* Discord flat text, no bubbles */}
                            <p className="text-xs md:text-sm text-white/85 leading-relaxed break-words whitespace-pre-wrap">
                              {msg.text}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bottom Bar: Poll icon button, Chat input, airplane outline send icon */}
                <div className="p-3 md:p-3.5 border-t border-white/5 bg-[#121422] flex-shrink-0">
                  <form onSubmit={handleSendMessage} className="flex items-center gap-2.5">
                    {/* Poll Icon Button */}
                    <button
                      type="button"
                      onClick={() => setPollModalOpen(true)}
                      disabled={!user}
                      aria-label="Create Poll"
                      title="Create Movie Poll"
                      className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center text-lg transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      🗳️
                    </button>

                    {/* Chat Input */}
                    <div className="flex-1 relative flex items-center bg-white/5 rounded-xl px-3.5 py-2.5">
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        disabled={!user}
                        placeholder={!user ? "Sign in or continue as guest to message..." : `Message #${activeRoom?.name || 'room'}...`}
                        className="w-full bg-transparent text-xs md:text-sm text-white placeholder-white/40 border-0 outline-none shadow-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
                        style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                      />
                    </div>

                    {/* Airplane Outline Send Icon */}
                    <button
                      type="submit"
                      disabled={sendingMsg || !inputText.trim()}
                      aria-label="Send Message"
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                        inputText.trim() && !sendingMsg
                          ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer active:scale-95'
                          : 'bg-white/5 text-white/30 cursor-not-allowed'
                      }`}
                    >
                      <svg
                        className="w-5 h-5 -rotate-45 ml-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                        />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>

              {/* Backdrop for Overlay Drawers */}
              {(showReactionsHistory || membersDrawerOpen) && (
                <div
                  className="fixed md:absolute inset-0 bg-black/60 z-40 animate-in fade-in duration-200 backdrop-blur-[2px]"
                  onClick={() => {
                    setShowReactionsHistory(false);
                    setMembersDrawerOpen(false);
                  }}
                />
              )}

              {/* Reaction History Smooth Slide-out Overlay Drawer */}
              {showReactionsHistory && (
                <div className="fixed md:absolute right-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] bg-[#11131f] border-l border-white/10 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Reaction History
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowReactionsHistory(false)}
                      className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white text-xs transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                    {reactionsList.length === 0 ? (
                      <p className="text-xs text-white/40 text-center py-10">
                        No scene reactions recorded yet. Use reaction emojis while streaming!
                      </p>
                    ) : (
                      reactionsList.map((rx) => (
                        <div key={rx.id} className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white/90">{rx.userName}</span>
                            <span className="text-[10px] font-mono text-purple-400 font-semibold">{rx.sceneTime}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-base">{rx.emoji}</span>
                            <span className="text-[11px] text-white/60 truncate">{rx.mediaTitle}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Members Smooth Slide-out Overlay Drawer */}
              {membersDrawerOpen && (
                <div className="fixed md:absolute right-0 top-0 bottom-0 z-50 w-80 max-w-[85vw] bg-[#11131f] border-l border-white/10 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Room Members ({membersList.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setMembersDrawerOpen(false)}
                      className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white text-xs transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {membersList.map((member) => (
                      <div
                        key={member.uid}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-purple-600/30 text-white font-bold text-xs flex items-center justify-center">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#11131f] ${
                                member.online !== false ? 'bg-emerald-400' : 'bg-white/30'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{member.name}</p>
                            {member.isHost && (
                              <p className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">Host</p>
                            )}
                          </div>
                        </div>

                        {/* Kick / Remove Member button for host */}
                        {isHost && member.uid !== user?.uid && (
                          <button
                            type="button"
                            onClick={() => activeRoom && removeRoomMember(activeRoom.id, member.uid)}
                            className="text-[10px] text-red-400 hover:text-red-300 px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 font-medium"
                            title="Remove member"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Leave Room Button */}
                  <div className="p-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={async () => {
                        if (user && activeRoom) {
                          await leaveStreamRoom(activeRoom.id, user.uid);
                          setActiveRoomId(null);
                          navigate('/stream-rooms');
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-bold transition-colors text-center"
                    >
                      Leave Room
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        ) : (
          /* Desktop right area empty state when no room is selected */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 text-center text-white/50">
            <span className="text-4xl mb-3">🎬</span>
            <h3 className="text-base font-bold text-white mb-1">Select or Create a Stream Room</h3>
            <p className="text-xs max-w-sm">
              Pick a stream room from the left to join the chat and sync playback with friends.
            </p>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        user={user}
        profile={profile}
        onCreated={(newRoomId) => {
          setActiveRoomId(newRoomId);
          navigate(`/stream-room/${newRoomId}`);
        }}
      />

      {/* Create Movie Poll Modal */}
      {activeRoom && (
        <CreatePollModal
          isOpen={pollModalOpen}
          onClose={() => setPollModalOpen(false)}
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          user={user}
          profile={profile}
        />
      )}

      {/* Unauthenticated Stream Room Invite Overlay */}
      {!user && activeRoomId && (
        <div className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
          {/* Box: Floating Bottom Sheet on Mobile (curved edges, floating without touching edges), Pop-up Modal on Desktop */}
          <div className="w-[calc(100%-2rem)] md:w-full md:max-w-md my-4 md:my-0 mx-auto bg-[#121522] border border-white/10 rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col text-center text-white relative">
            
            {/* Room Header Info */}
            <div className="flex items-center gap-3 mb-4 p-2.5 rounded-xl bg-white/5 border border-white/5 text-left">
              <div className="w-10 h-14 rounded-lg overflow-hidden bg-black/40 border border-white/10 flex-shrink-0">
                <img
                  src={activeRoom?.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop&q=80'}
                  alt={activeRoom?.name || 'Watchroom'}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs md:text-sm font-bold text-white truncate">{activeRoom?.name || 'Watchroom'}</h3>
                <p className="text-[11px] text-purple-400 font-semibold mt-0.5">Stream Room Invite</p>
              </div>
            </div>

            {/* Movie Poll Preview (Shows candidate movie titles and vote counts) */}
            {activePoll && (
              <div className="mb-4 text-left bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                    🗳️ Movie Poll
                  </span>
                  <span className="text-[10px] font-medium text-white/50">
                    {activePoll.active ? 'Active Voting' : 'Poll Results'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-white mb-2 line-clamp-1">{activePoll.question}</p>
                
                {/* Candidate Movie Options and Amount of Votes */}
                <div className="space-y-1.5">
                  {activePoll.options.map((opt, idx) => {
                    const votesCount = opt.votes ? Object.keys(opt.votes).length : 0;
                    return (
                      <div 
                        key={opt.id} 
                        className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-black/40 border border-white/5"
                      >
                        <span className="font-medium text-white/90 truncate mr-2">
                          {opt.title || `Movie ${idx + 1}`}
                        </span>
                        <span className="text-[11px] font-mono text-purple-300 font-bold flex-shrink-0">
                          {votesCount} {votesCount === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Title & Subtitle */}
            <h2 className="text-base md:text-lg font-bold text-white mb-1">
              Sign in to join
            </h2>
            <p className="text-xs text-white/60 mb-5 leading-relaxed">
              Join <span className="text-white font-semibold">{activeRoom?.name || 'this stream room'}</span> to vote on movie polls, chat live, and watch together.
            </p>

            {/* Primary Action Button: Pill-shaped */}
            <button
              type="button"
              onClick={() => navigate(`/whos-watching?redirect=${encodeURIComponent(`/stream-room/${activeRoomId}`)}`)}
              className="w-full py-2.5 md:py-3 px-6 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs md:text-sm shadow-lg transition-all active:scale-95 cursor-pointer mb-3"
            >
              Sign in to join
            </button>

            {/* Bottom Link: Plain, non-designed underlined text */}
            <div>
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={loggingInGuest}
                className="text-xs text-white/60 hover:text-white underline cursor-pointer border-0 outline-none bg-transparent transition-colors"
              >
                {loggingInGuest ? 'Joining as guest...' : 'Continue as guest'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
