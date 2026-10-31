import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { NavigationRail } from '../components/NavigationRail.tsx';
import { SvgDefs } from '../components/SvgDefs.tsx';
import { MovieDetailsHero } from '../components/MovieDetailsHero.tsx';
import { EpisodesSection } from '../components/EpisodesSection.tsx';
import { SimilarMoviesSection } from '../components/SimilarMoviesSection.tsx';
import {
  MediaItem,
  fetchMediaDetails,
  getStoredActiveMedia,
  storeActiveMedia,
} from '../utils/mediaWorkerApi.ts';

export const MovieDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentEpisode, setCurrentEpisode] = useState<[number, number]>([0, 0]);
  const [activeMedia, setActiveMedia] = useState<MediaItem | null>(() => getStoredActiveMedia());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const targetUrl = searchParams.get('url');
  const targetSource = searchParams.get('source') || '1';

  // Fetch details on mount or searchParams change (supports browser refresh)
  useEffect(() => {
    if (!targetUrl) return;

    let isMounted = true;
    setIsLoading(true);

    fetchMediaDetails({ url: targetUrl, source: targetSource })
      .then((data) => {
        if (isMounted && data) {
          setActiveMedia(data);
          storeActiveMedia(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch details for page:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetUrl, targetSource]);

  const handleResumeClick = useCallback(() => {
    const url = activeMedia?.url || targetUrl || '';
    const source = activeMedia?.source || targetSource || '1';
    const epIdx = currentEpisode[1];
    if (url) {
      navigate(`/watch?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}&ep=${epIdx}`);
    } else {
      navigate(`/watch?episode=${epIdx}`);
    }
  }, [navigate, activeMedia, targetUrl, targetSource, currentEpisode]);

  const handleSelectEpisode = useCallback((seasonIdx: number, episodeIdx: number) => {
    setCurrentEpisode([seasonIdx, episodeIdx]);
  }, []);

  const handlePlayEpisode = useCallback(
    (_seasonIdx: number, episodeIdx: number) => {
      const url = activeMedia?.url || targetUrl || '';
      const source = activeMedia?.source || targetSource || '1';
      if (url) {
        navigate(`/watch?url=${encodeURIComponent(url)}&source=${encodeURIComponent(source)}&ep=${episodeIdx}`);
      } else {
        navigate(`/watch?episode=${episodeIdx}`);
      }
    },
    [navigate, activeMedia, targetUrl, targetSource]
  );

  return (
    <>
      <SvgDefs />
      <NavigationRail />
      <main>
        <MovieDetailsHero
          currentEpisode={currentEpisode}
          onResumeClick={handleResumeClick}
          activeMedia={activeMedia}
          isLoading={isLoading}
        />
        <EpisodesSection
          currentEpisode={currentEpisode}
          onSelectEpisode={handleSelectEpisode}
          onPlayEpisode={handlePlayEpisode}
          activeMedia={activeMedia}
        />
        <SimilarMoviesSection
          activeMedia={activeMedia}
          onSeeAllClick={handleResumeClick}
        />
      </main>
    </>
  );
};
