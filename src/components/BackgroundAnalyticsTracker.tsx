import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { trackAppOpen, trackPageTime } from '../utils/analyticsTracker.ts';

export const BackgroundAnalyticsTracker: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();

  const currentRouteRef = useRef<string>(location.pathname);
  const routeStartTimeRef = useRef<number>(Date.now());
  const uidRef = useRef<string | undefined>(user?.uid);

  uidRef.current = user?.uid;

  // 1. Log app open on initial mount
  useEffect(() => {
    trackAppOpen(user?.uid);
  }, [user?.uid]);

  // 2. Track Route Changes & Time Spent per Route
  useEffect(() => {
    const prevRoute = currentRouteRef.current;
    const now = Date.now();
    const timeSpentSec = (now - routeStartTimeRef.current) / 1000;

    // Log time spent on previous route if > 1s
    if (timeSpentSec >= 1) {
      trackPageTime(prevRoute, timeSpentSec, uidRef.current);
    }

    // Reset for new route
    currentRouteRef.current = location.pathname;
    routeStartTimeRef.current = Date.now();
  }, [location.pathname]);

  // 3. Periodic Flush & Tab Unload Listener
  useEffect(() => {
    // Flush analytics every 20s to ensure real-time accuracy even on abrupt browser exit
    const intervalId = setInterval(() => {
      const now = Date.now();
      const timeSpentSec = (now - routeStartTimeRef.current) / 1000;
      if (timeSpentSec >= 5) {
        trackPageTime(currentRouteRef.current, timeSpentSec, uidRef.current);
        routeStartTimeRef.current = Date.now();
      }
    }, 20000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const now = Date.now();
        const timeSpentSec = (now - routeStartTimeRef.current) / 1000;
        if (timeSpentSec >= 1) {
          trackPageTime(currentRouteRef.current, timeSpentSec, uidRef.current);
          routeStartTimeRef.current = Date.now();
        }
      } else if (document.visibilityState === 'visible') {
        routeStartTimeRef.current = Date.now();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
    };
  }, []);

  return null;
};
