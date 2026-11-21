import { useLayoutEffect, useRef, useState } from 'react';
import { GuideCourier, Icon } from './components.tsx';
import type { GuideBounds, GuideTarget } from '../shared/types.ts';
import { viewportSize } from './viewport.ts';

interface CoachProps {
  target: GuideTarget | null;
  frame: boolean;
  second: boolean;
  step: number;
  total: number;
  instruction: string;
  lesson: string;
  detail: string;
  checking: boolean;
  pointing: boolean;
  onSkip: () => void;
}

interface Geometry { path: string | null; width: number; height: number; visible: boolean; tap: { x: number; y: number; radius: number } | null }

export function TutorialCoach({ target, frame, second, step, total, instruction, lesson, detail, checking, pointing, onSkip }: CoachProps) {
  const strip = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<Geometry>({ path: null, width: 1, height: 1, tap: null, visible: false });
  useLayoutEffect(() => {
    const row = strip.current;
    const speech = bubble.current;
    if (!row || !speech) return;
    const update = (): void => {
      if (!pointing) { setGeometry((current) => current.visible ? { ...current, path: null, visible: false } : current); return; }
      const speechBox = speech.getBoundingClientRect();
      const frameButton = frame ? document.querySelector('.frame-option.tutorial-target') : null;
      const frameBox = frameButton?.getBoundingClientRect();
      const bounds = (box: DOMRect): GuideBounds => ({ x: box.x, y: box.y, width: box.width, height: box.height });
      const viewport = viewportSize();
      const destination = frame && frameBox ? { cell: bounds(frameBox), patches: [bounds(frameBox)], viewport } : target;
      if (!destination || destination.viewport.width !== viewport.width || destination.viewport.height !== viewport.height) {
        setGeometry((current) => current.visible ? { ...current, path: null, visible: false } : current);
        return;
      }
      const placed = bounds(speechBox);
      const toX = destination.cell.x + destination.cell.width / 2;
      const toY = destination.cell.y + destination.cell.height / 2;
      const edges = [
        { x: placed.x, y: Math.max(placed.y + 8, Math.min(placed.y + placed.height - 8, toY)) },
        { x: placed.x + placed.width, y: Math.max(placed.y + 8, Math.min(placed.y + placed.height - 8, toY)) },
        { x: Math.max(placed.x + 8, Math.min(placed.x + placed.width - 8, toX)), y: placed.y },
        { x: Math.max(placed.x + 8, Math.min(placed.x + placed.width - 8, toX)), y: placed.y + placed.height },
      ];
      edges.sort((a, b) => Math.hypot(a.x - toX, a.y - toY) - Math.hypot(b.x - toX, b.y - toY));
      const from = edges[0];
      if (!from) throw new Error('The tutorial pointer has no attachment edge.');
      const round = (value: number): number => Number(value.toFixed(1));
      const path = pointing ? `M${round(from.x)} ${round(from.y)}L${round(toX)} ${round(toY)}` : null;
      const tap = !frame && pointing
        ? { x: toX, y: toY, radius: Math.max(6, Math.min(12, Math.min(destination.cell.width, destination.cell.height) * 0.3)) } : null;
      const next = { path, tap, ...viewport, visible: pointing };
      setGeometry((current) => current.path === next.path && current.visible === next.visible &&
        current.width === next.width && current.height === next.height &&
        current.tap?.x === next.tap?.x && current.tap?.y === next.tap?.y && current.tap?.radius === next.tap?.radius ? current : next);
    };
    let animationFrame = 0;
    const schedule = (): void => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(row);
    observer.observe(speech);
    window.addEventListener('resize', schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', schedule);
      document.fonts.removeEventListener('loadingdone', schedule);
    };
  }, [target, frame, step, instruction, detail, pointing]);

  return <div ref={strip} className={`lesson-coach coach-${frame ? 'frame' : second ? 'second' : 'first'}`} data-testid="tutorial-coach">
    <div ref={bubble} className="courier-speech" style={{ visibility: pointing && geometry.visible ? 'visible' : 'hidden' }} role="status">
      <GuideCourier/>
      <div className="courier-words"><span>{checking ? 'TRY IT' : `${step} / ${total}`} &middot; {lesson}</span><strong id="lesson-instruction">{instruction}</strong>
        <small className="coach-rule-detail">{detail}</small>
      </div>
      <button className="text-button" onClick={onSkip} aria-label="Leave demo and return home">Home <Icon name="arrow" size={14}/></button>
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
