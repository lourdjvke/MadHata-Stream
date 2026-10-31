import React, { useRef, useEffect } from 'react';
import { CATS, grad } from '../data/content.ts';
import { useDraggableRow } from '../hooks/useDraggableRow.ts';
import { CategoryItem } from '../types/index.ts';

const CategoryRow: React.FC<{ cat: CategoryItem; onSeeAllClick: () => void }> = ({
  cat,
  onSeeAllClick,
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const rowRef = useDraggableRow<HTMLDivElement>();

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <section className="cat" ref={sectionRef}>
      <div className="mh">
        <span>{cat.name}</span>
        <button className="see" onClick={onSeeAllClick}>
          <svg className="i">
            <use href="#bulb" />
          </svg>
          See All
        </button>
      </div>
      <div className="row" ref={rowRef}>
        {cat.titles.map((title, i) => (
          <button
            key={i}
            className="p"
            style={{ background: grad(cat.h, cat.s, cat.l, i) }}
          >
            <span
              dangerouslySetInnerHTML={{
                __html: title.replace('|', '<br>'),
              }}
            />
          </button>
        ))}
      </div>
    </section>
  );
};

export const CategoriesSection: React.FC<{ onSeeAllClick: () => void }> = ({
  onSeeAllClick,
}) => {
  return (
    <div id="cats">
      {CATS.map((cat) => (
        <CategoryRow key={cat.name} cat={cat} onSeeAllClick={onSeeAllClick} />
      ))}
    </div>
  );
};
