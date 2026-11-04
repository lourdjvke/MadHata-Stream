import React, { useState } from 'react';
import { MovieSelectorModal } from './MovieSelectorModal.tsx';
import { createStreamRoom } from '../utils/streamRoomService.ts';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  profile: any;
  onCreated: (roomId: string) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  user,
  profile,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [poster, setPoster] = useState('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop&q=80');
  const [posterTitle, setPosterTitle] = useState('Default Cinema');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const roomId = await createStreamRoom(user, profile, name.trim(), poster);
      onCreated(roomId);
      onClose();
    } catch (err) {
      console.error('Failed to create stream room:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col justify-end md:justify-center items-center bg-black/75 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div 
        className="relative z-10 w-full md:max-w-md bg-[#12151f] text-white border-t md:border border-white/10 rounded-t-3xl md:rounded-2xl p-5 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍿</span>
            <div>
              <h3 className="font-bold text-base text-white">Create Stream Room</h3>
              <p className="text-xs text-white/50">Watch and sync shows live with friends</p>
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

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {/* Room Name */}
          <div>
            <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
              Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Midnight Horror Club, Anime Night..."
              className="w-full bg-white/5 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 border-0 outline-none shadow-none focus:outline-none focus:ring-0"
              style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
              required
              autoFocus
            />
          </div>

          {/* Room Poster / Display Image */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                Room Display Image
              </label>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium border-0 outline-none"
                style={{ border: 'none', outline: 'none' }}
              >
                Change Poster
              </button>
            </div>

            <div 
              onClick={() => setPickerOpen(true)}
              className="group cursor-pointer flex items-center gap-3 p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all border-0 outline-none"
              style={{ border: 'none', outline: 'none' }}
            >
              <div className="w-14 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-black/40 border border-white/10">
                <img src={poster} alt="Room poster" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{posterTitle}</p>
                <p className="text-[11px] text-purple-400 mt-0.5">Click to search movies or genres (Horror, Action, etc.)</p>
              </div>
              <span className="text-xs text-white/40 group-hover:text-white mr-1">›</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
                name.trim() && !creating
                  ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              {creating ? 'Creating Room...' : 'Create Stream Room'}
            </button>
          </div>
        </form>
      </div>

      {/* Embedded Movie Picker (Desktop popup, mobile bottom sheet) */}
      <MovieSelectorModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Select Room Display Poster"
        subtitle="Search or pick a genre (e.g. Horror) to use as the room cover"
        onSelect={(item) => {
          setPoster(item.poster);
          setPosterTitle(item.title);
        }}
      />
    </div>
  );
};
