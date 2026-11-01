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
        <symbol id="shorts" viewBox="0 0 24 24">
          <rect x="6" y="3" width="12" height="18" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <polygon points="10.5 9 15 12 10.5 15" fill="currentColor" stroke="none" />
        </symbol>
        <symbol id="bell" viewBox="0 0 24 24">
          <path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />
        </symbol>
        <symbol id="gear" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
        </symbol>
        <symbol id="plus" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </symbol>
        <symbol id="play" viewBox="0 0 24 24">
          <path d="M8 5.3v13.4a.6.6 0 0 0 .9.5l10.9-6.7a.6.6 0 0 0 0-1L8.9 4.8a.6.6 0 0 0-.9.5z" />
        </symbol>
        <symbol id="pause" viewBox="0 0 24 24">
          <rect x="6" y="4.5" width="4.2" height="15" rx="1.3" />
          <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.3" />
        </symbol>
        <symbol id="list" viewBox="0 0 24 24">
          <path d="M4 6h13M4 12h9M4 18h7M16 14v6l5-3z" />
        </symbol>
        <symbol id="dl" viewBox="0 0 24 24">
          <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
        </symbol>
        <symbol id="bulb" viewBox="0 0 24 24">
          <path d="M9.5 18h5M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
        </symbol>
        <symbol id="al" viewBox="0 0 24 24">
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </symbol>
        <symbol id="ar" viewBox="0 0 24 24">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </symbol>
        <symbol id="star" viewBox="0 0 24 24">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
        </symbol>
        <symbol id="ck" viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </symbol>
        <symbol id="x" viewBox="0 0 24 24">
          <path d="M6 6l12 12M18 6L6 18" />
        </symbol>
        <symbol id="trash" viewBox="0 0 24 24">
          <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" />
        </symbol>
        <symbol id="chev" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </symbol>
        <symbol id="cast" viewBox="0 0 24 24">
          <path d="M3 8V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H13M3 12a9 9 0 0 1 9 9M3 16.5A4.5 4.5 0 0 1 7.5 21M3 21h.01" />
        </symbol>
        <symbol id="rw" viewBox="0 0 24 24">
          <path d="M4.6 12.2a7.6 7.6 0 1 0 2.4-5.6M4 3.8v4.6h4.6" />
          <text x="12.2" y="15.2" textAnchor="middle" fontSize="7.4" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Plus Jakarta Sans,sans-serif">10</text>
        </symbol>
        <symbol id="fw" viewBox="0 0 24 24">
          <path d="M19.4 12.2A7.6 7.6 0 1 1 17 6.6M20 3.8v4.6h-4.6" />
          <text x="11.8" y="15.2" textAnchor="middle" fontSize="7.4" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Plus Jakarta Sans,sans-serif">10</text>
        </symbol>
        <symbol id="eps" viewBox="0 0 24 24">
          <rect x="3" y="8.5" width="14" height="11.5" rx="2" />
          <path d="M7 5h12.5a1.5 1.5 0 0 1 1.5 1.5V16M10 2h9" />
        </symbol>
        <symbol id="prev" viewBox="0 0 24 24">
          <path d="M18 5.8v12.4L9 12z" />
          <path d="M6 5v14" />
        </symbol>
        <symbol id="next" viewBox="0 0 24 24">
          <path d="M6 5.8v12.4L15 12z" />
          <path d="M18 5v14" />
        </symbol>
        <symbol id="dn" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </symbol>
        <symbol id="cr" viewBox="0 0 24 24">
          <path d="M9 6l6 6-6 6" />
        </symbol>
        <symbol id="sz-icon" viewBox="0 0 24 24">
          <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
        </symbol>
        <symbol id="vol-icon" viewBox="0 0 24 24">
          <path d="M11 5L6 9H2v6h4l5 4V5z" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </symbol>
        <symbol id="bright-icon" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </symbol>
        <symbol id="out" viewBox="0 0 24 24">
          <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 8l4 4-4 4M20 12H9" />
        </symbol>
        <symbol id="clock" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </symbol>
        <symbol id="mark" viewBox="0 0 24 24">
          <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />
        </symbol>
      </defs>
    </svg>
  );
};
