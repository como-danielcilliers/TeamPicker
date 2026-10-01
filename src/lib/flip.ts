import { useEffect, useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';

type Box = { x: number; y: number; w: number; h: number };

function measure(el: Element): Box {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
}

function measureAll(root: HTMLElement): Map<string, Box> {
  const map = new Map<string, Box>();
  root.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((el) => {
    map.set(el.dataset.flipId!, measure(el));
  });
  return map;
}

/**
 * Animates every `[data-flip-id]` element inside `rootRef` from its previous
 * position to its new one whenever `layoutKey` changes. Elements with no
 * previous position fly in from a matching `[data-flip-source]` element
 * (e.g. the member's avatar in the sidebar). A change in `drawKey` marks a
 * fresh draw and staggers the tokens with a slight arc.
 */
export function useFlip(
  rootRef: RefObject<HTMLElement | null>,
  layoutKey: unknown,
  drawKey: number,
) {
  const positions = useRef<Map<string, Box>>(new Map());
  const lastDrawKey = useRef(drawKey);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const stagger = drawKey !== lastDrawKey.current;
    lastDrawKey.current = drawKey;
    if (!root) {
      positions.current = new Map();
      return;
    }

    const next = measureAll(root);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      let order = 0;
      root.querySelectorAll<HTMLElement>('[data-flip-id]').forEach((el) => {
        const id = el.dataset.flipId!;
        const to = next.get(id)!;
        let from = positions.current.get(id);
        let fromSource = false;
        if (!from) {
          const source = document.querySelector(`[data-flip-source="${CSS.escape(id)}"]`);
          if (!source) return;
          from = measure(source);
          fromSource = true;
        }
        const dx = from.x - to.x;
        const dy = from.y - to.y;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

        const delay = stagger ? order++ * 40 : 0;
        const lift = stagger ? -14 - Math.random() * 18 : 0;
        const tilt = stagger ? Math.random() * 8 - 4 : 0;
        const startScale = fromSource ? 0.6 : 1;
        el.animate(
          [
            {
              transform: `translate(${dx}px, ${dy}px) scale(${startScale})`,
              opacity: fromSource ? 0.2 : 1,
            },
            {
              transform: `translate(${dx * 0.45}px, ${dy * 0.45 + lift}px) scale(1.03) rotate(${tilt}deg)`,
              opacity: 1,
              offset: 0.55,
            },
            { transform: 'none', opacity: 1 },
          ],
          {
            duration: stagger ? 600 : 360,
            delay,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            fill: 'backwards',
          },
        );
      });
    }
    positions.current = next;
  }, [rootRef, layoutKey, drawKey]);

  // Keep stored positions honest after the layout reflows (resize, sidebar wrap).
  useEffect(() => {
    function refresh() {
      if (rootRef.current) positions.current = measureAll(rootRef.current);
    }
    window.addEventListener('resize', refresh);
    return () => window.removeEventListener('resize', refresh);
  }, [rootRef]);
}
