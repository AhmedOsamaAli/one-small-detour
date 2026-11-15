import { useLayoutEffect, useRef, useState } from 'react';
import { GuideCourier, Icon } from './components.tsx';
import type { GuideBounds } from '../shared/types.ts';

interface CoachProps {
  target: GuideBounds | null;
  frame: boolean;
  second: boolean;
  step: number;
  total: number;
  instruction: string;
  pointing: boolean;
  onSkip: () => void;
}

interface Geometry { left: number; path: string | null; width: number; height: number; tap: { x: number; y: number; radius: number } | null }

export function TutorialCoach({ target, frame, second, step, total, instruction, pointing, onSkip }: CoachProps) {
  const strip = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry>({ left: 0, path: null, width: 1, height: 1, tap: null });
  useLayoutEffect(() => {
    const row = strip.current;
    const speech = bubble.current;
    if (!row || !speech) return;
    const update = (): void => {
      const rowBox = row.getBoundingClientRect();
      const speechBox = speech.getBoundingClientRect();
      const frameButton = frame ? document.querySelector('.frame-option.tutorial-target') : null;
      const frameBox = frameButton?.getBoundingClientRect();
      const destination = frame ? frameBox ?? null : target;
      const center = destination ? destination.x + destination.width / 2 - rowBox.x : rowBox.width / 2;
      const left = Math.max(0, Math.min(rowBox.width - speechBox.width, center - speechBox.width / 2));
      const fromX = rowBox.x + left + speechBox.width / 2;
      const fromY = rowBox.y + speechBox.height;
      const toX = destination ? destination.x + destination.width / 2 : fromX;
      const toY = destination ? destination.y + destination.height / 2 : fromY;
      const path = destination && pointing
        ? `M${fromX} ${fromY}Q${fromX} ${(fromY + toY) / 2} ${toX} ${toY}` : null;
      const tap = destination && !frame && pointing
        ? { x: toX, y: toY, radius: Math.max(6, Math.min(12, Math.min(destination.width, destination.height) * 0.3)) } : null;
      const next = { left, path, tap, width: window.innerWidth, height: window.innerHeight };
      setGeometry((current) => current.left === next.left && current.path === next.path &&
        current.width === next.width && current.height === next.height &&
        current.tap?.x === next.tap?.x && current.tap?.y === next.tap?.y && current.tap?.radius === next.tap?.radius ? current : next);
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
      viewBox={`0 0 ${geometry.width} ${geometry.height}`} aria-hidden="true"
      style={{ color: frame ? 'var(--green)' : second ? 'var(--selection-two)' : 'var(--selection-one)' }}>
      <defs><marker id="coach-arrow" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" refX="11" refY="7" orient="auto"><path d="M1 1 11 7 1 13 3.5 7Z" fill="currentColor" stroke="var(--paper)" strokeWidth="1.5" strokeLinejoin="round"/></marker></defs>
      {geometry.tap && <g>
        <circle cx={geometry.tap.x} cy={geometry.tap.y} r={geometry.tap.radius} fill="none" stroke="var(--paper)" strokeWidth="6"/>
        <circle data-testid="tutorial-tap-target" cx={geometry.tap.x} cy={geometry.tap.y} r={geometry.tap.radius}
          fill="none" stroke="currentColor" strokeWidth="2"/>
      </g>}
      <path d={geometry.path} fill="none" stroke="var(--paper)" strokeWidth="6" strokeLinecap="round"/>
      <path d={geometry.path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" markerEnd="url(#coach-arrow)"/>
    </svg>}
  </div>;
}
