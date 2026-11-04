import React, { useState } from 'react';
import { MovieSelectorModal } from './MovieSelectorModal.tsx';
import { createMoviePoll } from '../utils/streamRoomService.ts';

interface CreatePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
  user: any;
  profile: any;
}

interface CandidateMovie {
  title: string;
  poster: string;
  url: string;
  source: string;
}

export const CreatePollModal: React.FC<CreatePollModalProps> = ({
  isOpen,
  onClose,
  roomId,
  roomName,
  user,
  profile,
}) => {
  const [question, setQuestion] = useState('What should we watch next?');
  const [candidates, setCandidates] = useState<CandidateMovie[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [timeMode, setTimeMode] = useState<'immediate' | '15m' | '30m' | '1h' | '2h'>('immediate');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleAddCandidate = (movie: CandidateMovie) => {
    if (candidates.length >= 3) return;
    // Don't duplicate
    if (candidates.some((c) => c.title === movie.title)) return;
    setCandidates([...candidates, movie]);
  };

  const handleRemoveCandidate = (index: number) => {
    setCandidates(candidates.filter((_, idx) => idx !== index));
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (candidates.length < 2) return;
    setSubmitting(true);
    try {
      let scheduledStartTime: number | null = null;
      const now = Date.now();
      if (timeMode === '15m') scheduledStartTime = now + 15 * 60 * 1000;
      else if (timeMode === '30m') scheduledStartTime = now + 30 * 60 * 1000;
      else if (timeMode === '1h') scheduledStartTime = now + 60 * 60 * 1000;
      else if (timeMode === '2h') scheduledStartTime = now + 120 * 60 * 1000;

      await createMoviePoll(
        roomId,
        user,
        profile,
        question.trim() || 'What are we watching?',
        candidates,
        scheduledStartTime,
        roomName
      );
      onClose();
    } catch (err) {
      console.error('Failed to create movie poll:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[125] flex flex-col justify-end md:justify-center items-center bg-black/75 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className="relative z-10 w-full md:max-w-lg bg-[#12151f] text-white border-t md:border border-white/10 rounded-t-3xl md:rounded-2xl p-5 md:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto pb-6 md:pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🗳️</span>
            <div>
              <h3 className="font-bold text-base text-white">Create Movie Poll</h3>
              <p className="text-xs text-white/50">Pick up to 3 candidate shows for room voting</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCreatePoll} className="mt-4 flex flex-col gap-5">
          {/* Question */}
          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
              Poll Question
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Which movie for movie night?"
              className="w-full bg-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-white/40 border-0 outline-none shadow-none focus:outline-none focus:ring-0"
              style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
              required
            />
          </div>

          {/* Candidates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                Candidate Shows ({candidates.length}/3)
              </label>
              {candidates.length < 3 && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 border-0 outline-none"
                  style={{ border: 'none', outline: 'none' }}
                >
                  <span>+</span> Search & Add Movie
                </button>
              )}
            </div>

            {candidates.length === 0 ? (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="w-full py-7 bg-white/5 rounded-xl flex flex-col items-center justify-center text-white/50 hover:text-white/80 transition-colors border-0 outline-none"
                style={{ border: 'none', outline: 'none' }}
              >
                <span className="text-2xl mb-1.5">🎬</span>
                <span className="text-xs font-medium">Click to select at least 2 movies to compare</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {candidates.map((c, idx) => (
                  <div key={idx} className="relative aspect-[2/3] rounded-lg overflow-hidden border border-white/10 bg-black/40 group">
                    <img src={c.poster} alt={c.title} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveCandidate(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/80 text-white/90 hover:text-red-400 flex items-center justify-center text-xs"
                    >
                      ✕
                    </button>
                    <div className="absolute inset-x-0 bottom-0 p-1 bg-black/80">
                      <p className="text-[10px] text-white font-medium line-clamp-1">{c.title}</p>
                    </div>
                  </div>
                ))}

                {candidates.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="aspect-[2/3] rounded-lg border border-dashed border-white/20 flex flex-col items-center justify-center text-white/40 hover:text-purple-400 hover:border-purple-500 transition-colors"
                  >
                    <span className="text-xl">+</span>
                    <span className="text-[10px] mt-1">Add Show</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Start Time Schedule */}
          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
              Stream Schedule
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[
                { id: 'immediate', label: 'Now' },
                { id: '15m', label: '15m' },
                { id: '30m', label: '30m' },
                { id: '1h', label: '1 hr' },
                { id: '2h', label: '2 hrs' },
              ].map((opt) => {
                const active = timeMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTimeMode(opt.id as any)}
                    style={{
                      background: active ? '#7928ca' : 'rgba(255, 255, 255, 0.06)',
                      color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                      border: active ? '2px solid #d8b4fe' : '1px solid rgba(255, 255, 255, 0.1)',
                      fontWeight: active ? 700 : 500,
                      transform: active ? 'scale(1.04)' : 'scale(1)',
                      boxShadow: active ? '0 4px 12px rgba(121, 40, 202, 0.4)' : 'none',
                    }}
                    className="py-2 px-1 text-xs rounded-xl transition-all text-center cursor-pointer"
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || candidates.length < 2}
              style={{
                background: (candidates.length >= 2 && !submitting) 
                  ? 'linear-gradient(135deg, #7928ca 0%, #9333ea 100%)' 
                  : 'rgba(255, 255, 255, 0.08)',
                color: (candidates.length >= 2 && !submitting) ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
                border: (candidates.length >= 2 && !submitting) ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.05)',
                cursor: (candidates.length >= 2 && !submitting) ? 'pointer' : 'not-allowed',
                padding: '0.85rem 1rem',
                borderRadius: '0.85rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: (candidates.length >= 2 && !submitting) ? '0 8px 24px -4px rgba(121, 40, 202, 0.5)' : 'none',
              }}
            >
              {submitting ? 'Creating Poll...' : candidates.length < 2 ? 'Select at least 2 shows above' : '🚀 Launch Poll to Room'}
            </button>
          </div>
        </form>
      </div>

      {/* Embedded Movie Picker */}
      <MovieSelectorModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose Poll Candidate Show"
        subtitle="Search or choose a genre to add to this poll"
        onSelect={handleAddCandidate}
      />
    </div>
  );
};
