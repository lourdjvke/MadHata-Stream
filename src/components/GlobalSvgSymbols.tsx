import React from 'react';

export const GlobalSvgSymbols: React.FC = () => {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        <symbol id="home" viewBox="0 0 24 24">
          <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
        </symbol>
        <symbol id="search" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </symbol>
        <symbol id="chart" viewBox="0 0 24 24">
          <path d="M5 20V10M12 20V4M19 20v-7" />
        </symbol>
        <symbol id="user" viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
        </symbol>
        <symbol id="cal" viewBox="0 0 24 24">
          <rect x="4" y="5" width="16" height="16" rx="2.5" />
          <path d="M4 10h16M8 3v4M16 3v4" />
        </symbol>
        <symbol id="bolt" viewBox="0 0 24 24">
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </symbol>
        <symbol id="bell" viewBox="0 0 24 24">
          <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
        </symbol>
        <symbol id="gear" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
        </symbol>
        <symbol id="al" viewBox="0 0 24 24">
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </symbol>
        <symbol id="x" viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" />
        </symbol>
        <symbol id="play" viewBox="0 0 24 24">
          <path d="M8.5 5.5v13L19 12z" />
        </symbol>
        <symbol id="pause" viewBox="0 0 24 24">
          <path d="M8 5v14M16 5v14" />
        </symbol>
        <symbol id="trash" viewBox="0 0 24 24">
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
        </symbol>
        <symbol id="chev" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </symbol>
        <symbol id="dl" viewBox="0 0 24 24">
          <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
        </symbol>
        <symbol id="plus" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </symbol>
        <symbol id="ck" viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5" />
        </symbol>
        <symbol id="list" viewBox="0 0 24 24">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </symbol>
        <symbol id="out" viewBox="0 0 24 24">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </symbol>
      </defs>
    </svg>
  );
};
