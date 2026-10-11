import { useEffect } from 'react';

let locks = 0;

/** Prevents background scrolling while a modal/drawer is open (supports nesting). */
export function useLockBody(active) {
  useEffect(() => {
    if (!active) return undefined;
    locks += 1;
    const prev = document.body.style.overflow;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    return () => {
      locks -= 1;
      if (locks === 0) {
        document.body.style.overflow = prev;
        document.body.style.paddingRight = '';
      }
    };
  }, [active]);
}
