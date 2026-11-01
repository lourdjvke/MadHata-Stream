/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { WhosWatchingPage } from './pages/WhosWatchingPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { MovieDetailsPage } from './pages/MovieDetailsPage.tsx';
import { PlayerPage } from './pages/PlayerPage.tsx';
import { ScrollManager } from './components/ScrollManager.tsx';
import { GlobalSvgSymbols } from './components/GlobalSvgSymbols.tsx';
import { GlobalDownloadToast } from './components/GlobalDownloadToast.tsx';
import { PWAInstallStrip } from './components/PWAInstallStrip.tsx';

import { DownloadsPage } from './pages/DownloadsPage.tsx';
import { ShortsPage } from './pages/ShortsPage.tsx';
import { BackgroundAnalyticsTracker } from './components/BackgroundAnalyticsTracker.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BackgroundAnalyticsTracker />
        <PWAInstallStrip />
        <GlobalSvgSymbols />
        <GlobalDownloadToast />
        <ScrollManager />
        <Routes>
          {/* Public Auth / Profile Selection Page */}
          <Route path="/whos-watching" element={<WhosWatchingPage />} />
          <Route path="/login" element={<WhosWatchingPage />} />
          <Route path="/auth" element={<WhosWatchingPage />} />

          {/* Protected Routes: Require User Sign In / Profile */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shorts"
            element={
              <ProtectedRoute>
                <ShortsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/downloads"
            element={
              <ProtectedRoute>
                <DownloadsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/movie/:id"
            element={
              <ProtectedRoute>
                <MovieDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/movie"
            element={
              <ProtectedRoute>
                <MovieDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/details"
            element={
              <ProtectedRoute>
                <MovieDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/watch"
            element={
              <ProtectedRoute>
                <PlayerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/watch/:id"
            element={
              <ProtectedRoute>
                <PlayerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/player"
            element={
              <ProtectedRoute>
                <PlayerPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
