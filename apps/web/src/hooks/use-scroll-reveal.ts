import { useEffect, useRef, useState } from 'react';

/** Backs the Card component's scroll-triggered reveal: fades/lifts a card in
 * once it's actually exposed in the viewport, and re-arms itself (toggles
 * back to hidden) once the card scrolls back out — so re-entering the
 * viewport (scroll away, scroll back) replays the reveal instead of firing
 * once at mount. Falls back to "always visible" if IntersectionObserver
 * isn't available (matches `prefers-reduced-motion` intent — no animation
 * gate rather than content that never appears). */
export function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.15,
      rootMargin: '0px 0px -10% 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}
