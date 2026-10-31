import { useRef, useEffect } from 'react';

export function useDraggableRow<T extends HTMLElement = HTMLDivElement>() {
  const rowRef = useRef<T>(null);

  useEffect(() => {
    const r = rowRef.current;
    if (!r) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let moved = 0;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      isDown = true;
      startX = e.clientX;
      scrollLeft = r.scrollLeft;
      moved = 0;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      const d = e.clientX - startX;
      if (Math.abs(d) > 5) {
        moved = 1;
        r.classList.add('drag');
      }
      if (moved) {
        r.scrollLeft = scrollLeft - d;
      }
    };

    const handlePointerUp = () => {
      if (!isDown) return;
      isDown = false;
      r.classList.remove('drag');
      r.dataset.mv = String(moved);
    };

    const handleClick = (e: MouseEvent) => {
      if (r.dataset.mv === '1') {
        e.preventDefault();
        e.stopPropagation();
        r.dataset.mv = '0';
      }
    };

    r.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    r.addEventListener('click', handleClick, true);

    return () => {
      r.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      r.removeEventListener('click', handleClick, true);
    };
  }, []);

  return rowRef;
}
