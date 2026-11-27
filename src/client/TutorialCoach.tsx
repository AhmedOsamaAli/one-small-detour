import { useLayoutEffect, useRef, useState } from 'react';
import { GuideCourier, Icon } from './components.tsx';
import { placeCoach } from './coachLayout.ts';
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

interface Geometry {
  floating: boolean;
  left: number;
  top: number;
  path: string | null;
  width: number;
  height: number;
  visible: boolean;
  tap: { x: number; y: number; radius: number } | null;
}

const canFloatCoach = (viewport: { width: number; height: number }): boolean =>
  viewport.width >= 700 && viewport.height >= 500;

export function TutorialCoach({ target, frame, second, step, total, instruction, lesson, detail, checking, pointing, onSkip }: CoachProps) {
  const strip = useRef<HTMLDivElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const fallbackKey = useRef<string | null>(null);
  const [geometry, setGeometry] = useState<Geometry>(() => ({
    floating: canFloatCoach(viewportSize()),
    left: 8,
    top: 8,
    path: null,
    width: 1,
    height: 1,
    tap: null,
    visible: false,
  }));
  useLayoutEffect(() => {
    const row = strip.current;
    const speech = bubble.current;
    if (!row || !speech) return;
    const update = (): void => {
      const viewport = viewportSize();
      const stepKey = `${viewport.width}x${viewport.height}:${frame ? 'f' : step}`;
      const shouldFloat = canFloatCoach(viewport) && fallbackKey.current !== stepKey;
      if (!pointing) {
        setGeometry((current) => current.visible || current.floating !== shouldFloat
          ? { ...current, floating: shouldFloat, path: null, visible: false } : current);
        return;
      }
      if (row.classList.contains('floating') !== shouldFloat) {
        setGeometry((current) => current.floating === shouldFloat && !current.visible
          ? current : { ...current, floating: shouldFloat, path: null, visible: false });
        return;
      }
      const speechBox = speech.getBoundingClientRect();
      const frameButton = frame ? document.querySelector('.frame-option.tutorial-target') : null;
      const frameBox = frameButton?.getBoundingClientRect();
      const bounds = (box: DOMRect): GuideBounds => ({ x: box.x, y: box.y, width: box.width, height: box.height });
      const destination = frame && frameBox ? { cell: bounds(frameBox), patches: [bounds(frameBox)], viewport } : target;
      if (!destination || destination.viewport.width !== viewport.width || destination.viewport.height !== viewport.height) {
        setGeometry((current) => current.visible || current.floating !== shouldFloat
          ? { ...current, floating: shouldFloat, path: null, visible: false } : current);
        return;
      }
      let placed = bounds(speechBox);
      let floating = false;
      if (shouldFloat) {
        const controls = [...document.querySelectorAll('.site-header,.story-panel,.play-toolbar,.board-footer')]
          .map((element) => bounds(element.getBoundingClientRect()))
          .filter((box) => box.width > 2 && box.height > 2);
        const shell = document.querySelector('.app-shell');
        if (shell) {
          const style = getComputedStyle(shell);
          const top = parseFloat(style.paddingTop), bottom = parseFloat(style.paddingBottom);
          const left = parseFloat(style.paddingLeft), right = parseFloat(style.paddingRight);
          if (top) controls.push({ x: 0, y: 0, width: viewport.width, height: top });
          if (bottom) controls.push({ x: 0, y: viewport.height - bottom, width: viewport.width, height: bottom });
          if (left) controls.push({ x: 0, y: 0, width: left, height: viewport.height });
          if (right) controls.push({ x: viewport.width - right, y: 0, width: right, height: viewport.height });
        }
        try {
          placed = placeCoach(destination, speechBox, viewport, controls);
          floating = true;
        } catch {
          fallbackKey.current = stepKey;
          floating = false;
        }
      }
      if (row.classList.contains('floating') !== floating) {
        setGeometry((current) => current.floating === floating && !current.visible
          ? current : { ...current, floating, path: null, visible: false });
        return;
      }
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
      const next: Geometry = { floating, left: placed.x, top: placed.y, path, tap, ...viewport, visible: pointing };
      setGeometry((current) => current.floating === next.floating && current.left === next.left && current.top === next.top &&
        current.path === next.path && current.visible === next.visible &&
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
  }, [target, frame, step, instruction, detail, pointing, geometry.floating]);

  return <div ref={strip} className={`lesson-coach${geometry.floating ? ' floating' : ''} coach-${frame ? 'frame' : second ? 'second' : 'first'}`}
    data-testid="tutorial-coach" data-floating={geometry.floating ? 'true' : 'false'}>
    <div ref={bubble} className="courier-speech"
      style={{ ...(geometry.floating ? { left: geometry.left, top: geometry.top } : {}), visibility: pointing && geometry.visible ? 'visible' : 'hidden' }}
      role="status">
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
