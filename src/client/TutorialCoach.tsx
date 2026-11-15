import { useLayoutEffect, useRef, useState } from 'react';
import { GuideCourier, Icon } from './components.tsx';
import type { GuideBounds } from '../shared/types.ts';

interface CoachProps {
  target: GuideBounds | null;
  frame: boolean;
  step: number;
  total: number;
  instruction: string;
  pointing: boolean;
  onSkip: () => void;
}

interface Geometry { left: number; path: string | null; width: number; height: number }

export function TutorialCoach({ target, frame, step, total, instruction, pointing, onSkip }: CoachProps) {
  const strip = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry>({ left: 0, path: null, width: 1, height: 1 });
  useLayoutEffect(() => {
    const row = strip.current;
    const speech = bubble.current;
    if (!row || !speech) return;
    const update = (): void => {
      const rowBox = row.getBoundingClientRect();
      const speechBox = speech.getBoundingClientRect();
      const frameButton = frame ? document.querySelector('.frame-option.tutorial-target') : null;
      const frameBox = frameButton?.getBoundingClientRect();
      const destination = frameBox
        ? { x: frameBox.x, y: frameBox.y, width: frameBox.width, height: frameBox.height }
        : target;
      const center = destination ? destination.x + destination.width / 2 - rowBox.x : rowBox.width / 2;
      const left = Math.max(0, Math.min(rowBox.width - speechBox.width, center - speechBox.width / 2));
      const fromX = rowBox.x + left + speechBox.width / 2;
      const fromY = rowBox.y + speechBox.height;
      const toX = destination ? destination.x + destination.width / 2 : fromX;
      const toY = destination ? Math.max(8, destination.y - 7) : fromY;
      const path = destination && pointing
        ? `M${fromX} ${fromY}Q${fromX} ${(fromY + toY) / 2} ${toX} ${toY}` : null;
      const next = { left, path, width: window.innerWidth, height: window.innerHeight };
      setGeometry((current) => current.left === next.left && current.path === next.path &&
        current.width === next.width && current.height === next.height ? current : next);
    };
    const observer = new ResizeObserver(update);
    observer.observe(row);
    observer.observe(speech);
    window.addEventListener('resize', update);
    document.fonts.addEventListener('loadingdone', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      document.fonts.removeEventListener('loadingdone', update);
    };
  }, [target, frame, step, instruction, pointing]);

  return <div ref={strip} className="lesson-coach" data-testid="tutorial-coach">
    <div ref={bubble} className="courier-speech" style={{ left: geometry.left }} role="status">
      <GuideCourier/>
      <div className="courier-words"><span>{step} / {total} &middot; NO TIMER</span><strong id="lesson-instruction">{instruction}</strong></div>
      <button className="text-button" onClick={onSkip} aria-label="Skip walkthrough and play today">Skip <Icon name="arrow" size={14}/></button>
    </div>
    {geometry.path && <svg className="guide-pointer" width={geometry.width} height={geometry.height}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`} aria-hidden="true">
      <defs><marker id="coach-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="m1 1 5 2.5L1 6" fill="none" stroke="var(--accent-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></marker></defs>
      <path d={geometry.path} fill="none" stroke="var(--paper)" strokeWidth="6" strokeLinecap="round"/>
      <path d={geometry.path} fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" markerEnd="url(#coach-arrow)"/>
    </svg>}
  </div>;
}
