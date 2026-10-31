import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Manages independent scroll history for each route.
 * Prevents routes from sharing the window scroll position when switching views.
 */
export const ScrollManager: React.FC = () => {
  const location = useLocation();
  const scrollPositions = useRef<Record<string, number>>({});
  const currentPathRef = useRef(location.pathname);

  // Set manual scroll restoration to take control over browser's default behavior
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Track and save scroll position of current path as user scrolls
  useEffect(() => {
    const onScroll = () => {
      scrollPositions.current[currentPathRef.current] = window.scrollY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Handle route transitions
  useEffect(() => {
    const prevPath = currentPathRef.current;
    const newPath = location.pathname;

    // Save previous route scroll position before switching
    scrollPositions.current[prevPath] = window.scrollY;
    currentPathRef.current = newPath;

    // Clean up any lingering body classes from section observers (like .t from Taste)
    document.body.classList.remove('t');

    // Restore saved scroll position for new path, or start at top (0, 0)
    const targetY = scrollPositions.current[newPath] ?? 0;

    // Use requestAnimationFrame to ensure DOM for the new page is mounted
    requestAnimationFrame(() => {
      window.scrollTo(0, targetY);
    });
  }, [location.pathname]);

  return null;
};
