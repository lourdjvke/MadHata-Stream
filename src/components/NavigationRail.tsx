import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

interface NavigationRailProps {
  onHomeClick?: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({ onHomeClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();

  const isHome = location.pathname === '/';
  const isSearch = location.pathname === '/search';
  const isDownloads = location.pathname === '/downloads';
  const isProfile = location.pathname === '/profile';

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleNavClick = (tab: 'home' | 'search' | 'downloads' | 'profile') => {
    setShowProfileMenu(false);
    if (tab === 'home') {
      if (isHome) {
        if (onHomeClick) {
          onHomeClick();
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        navigate('/');
      }
    } else if (tab === 'search') {
      if (!isSearch) {
        navigate('/search');
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (tab === 'downloads') {
      if (!isDownloads) {
        navigate('/downloads');
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (tab === 'profile') {
      if (!isProfile) {
        navigate('/profile');
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const avatarGradient = profile?.c1 && profile?.c2
    ? `radial-gradient(circle at 35% 30%, ${profile.c1}, ${profile.c2})`
    : 'radial-gradient(circle at 35% 30%, #2f7cf6, #0d3fc4)';

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/whos-watching');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <>
      <nav className="rail" aria-label="Main">
        <div
          className="logo"
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer' }}
          title="MadHata Home"
        >
          M
        </div>

        {/* Home */}
        <button
          className={`nb ${isHome ? 'on' : ''}`}
          aria-label="Home"
          data-home=""
          aria-current={isHome ? 'page' : undefined}
          onClick={() => handleNavClick('home')}
          title="Home"
        >
          <svg className="i">
            <use href="#home" />
          </svg>
        </button>

        {/* Search */}
        <button
          className={`nb ${isSearch ? 'on' : ''}`}
          aria-label="Search"
          aria-current={isSearch ? 'page' : undefined}
          onClick={() => handleNavClick('search')}
          title="Search"
        >
          <svg className="i">
            <use href="#search" />
          </svg>
        </button>

        {/* Downloads (added right before profile) */}
        <button
          className={`nb ${isDownloads ? 'on' : ''}`}
          aria-label="Downloads"
          aria-current={isDownloads ? 'page' : undefined}
          onClick={() => handleNavClick('downloads')}
          title="Downloads"
        >
          <svg className="i">
            <use href="#dl" />
          </svg>
        </button>

        {/* Profile */}
        <button
          className={`nb ${isProfile ? 'on' : ''}`}
          aria-label="Profile"
          aria-current={isProfile ? 'page' : undefined}
          onClick={() => handleNavClick('profile')}
          title="Profile"
        >
          <svg className="i">
            <use href="#user" />
          </svg>
        </button>

        {/* Desktop-only spacer and avatar profile indicator */}
        <div className="sp hidden md:block" />

        <div
          className="av hidden md:block"
          role="button"
          tabIndex={0}
          aria-label="Account"
          title={profile?.name || user?.displayName || 'My Profile'}
          style={{ background: avatarGradient, cursor: 'pointer' }}
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setShowProfileMenu(!showProfileMenu);
            }
          }}
        />
      </nav>

      {/* Account Profile Quick Popover */}
      {showProfileMenu && (
        <div
          style={{
            position: 'fixed',
            left: 'calc(var(--rail) + 0.8rem)',
            bottom: '1.2rem',
            zIndex: 99,
            background: 'rgba(20, 26, 42, 0.96)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '1rem',
            padding: '1.1rem',
            width: '16.5rem',
            boxShadow: '0 1.2rem 3rem rgba(0, 0, 0, 0.75)',
            animation: 'up 0.4s cubic-bezier(.22,1,.36,1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.9rem' }}>
            <div
              style={{
                width: '2.6rem',
                height: '2.6rem',
                borderRadius: '50%',
                background: avatarGradient,
                border: '2px solid rgba(255, 255, 255, 0.2)',
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {profile?.name || user?.displayName || 'MadHata User'}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#9aa1b4',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user?.email || 'Logged in'}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                setShowProfileMenu(false);
                navigate('/profile');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.6rem',
                background: 'rgba(255, 255, 255, 0.08)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#fff',
                textAlign: 'left',
              }}
            >
              <svg className="i" style={{ width: '1rem', height: '1rem' }}>
                <use href="#user" />
              </svg>
              <span>View Profile</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowProfileMenu(false);
                navigate('/whos-watching');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.6rem',
                background: 'rgba(255, 255, 255, 0.04)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#cdd1dc',
                textAlign: 'left',
              }}
            >
              <svg className="i" style={{ width: '1rem', height: '1rem' }}>
                <use href="#gear" />
              </svg>
              <span>Switch Profile</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '0.6rem',
                background: 'rgba(255, 107, 120, 0.12)',
                color: '#ff8a94',
                fontSize: '0.82rem',
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <svg className="i" style={{ width: '1rem', height: '1rem' }}>
                <use href="#out" />
              </svg>
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
