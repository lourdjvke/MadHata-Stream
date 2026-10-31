import React, { useState, useCallback } from 'react';
import { NavigationRail } from '../components/NavigationRail.tsx';
import { HeroSection } from '../components/HeroSection.tsx';
import { AggregatedMediaSection } from '../components/AggregatedMediaSection.tsx';
import { RecentlyWatchedSection } from '../components/RecentlyWatchedSection.tsx';
import { TasteCarousel } from '../components/TasteCarousel.tsx';

export const HomePage: React.FC = () => {
  const [isTasteInView, setIsTasteInView] = useState(false);

  const handleSeeAll = useCallback(() => {
    const el = document.getElementById('mediaGrid') || document.getElementById('taste');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleHomeClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <>
      <NavigationRail onHomeClick={handleHomeClick} />
      <main>
        <HeroSection onSeeAllClick={handleSeeAll} isTasteInView={isTasteInView} />
        <RecentlyWatchedSection />
        <AggregatedMediaSection onSeeAllClick={handleSeeAll} />
        <TasteCarousel onTasteInViewChange={setIsTasteInView} />
      </main>
    </>
  );
};
