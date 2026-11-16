import { patchCells } from '../shared/rules.ts';
import type { Cell, Swap } from '../shared/types.ts';
import { parcelMotion } from './postcard.ts';

export const FLAT_EXCHANGE_MS = 520;

export interface FlatExchangeAnimation {
  setPaused: (paused: boolean) => void;
  finish: () => void;
  cancel: () => void;
}

export function animateFlatExchange(
  map: HTMLDivElement, stage: HTMLDivElement, move: Swap,
  onFinish: () => void, onError: (error: unknown) => void,
  postcard = false,
): FlatExchangeAnimation {
  const animations: Animation[] = [];
  const moving: HTMLElement[] = [];
  let active = true;
  const clear = (): void => {
    for (const animation of animations) animation.cancel();
    for (const element of moving) element.classList.remove('flat-moving');
  };
  const finish = (): void => {
    if (!active) return;
    active = false;
    clear();
    onFinish();
  };
  const fail = (error: unknown): void => {
    if (!active) return;
    active = false;
    clear();
    onError(error);
  };
  const cellElement = (cell: Cell): HTMLButtonElement => {
    const element = map.querySelector<HTMLButtonElement>(`.flat-cell[data-row="${cell.row}"][data-col="${cell.col}"]`);
    if (!element) throw new Error('An exchanged terrain square is missing.');
    return element;
  };
  try {
    const stageBox = stage.getBoundingClientRect();
    const began = document.timeline.currentTime;
    const origins = {
      a: cellElement(move.a).getBoundingClientRect(),
      b: cellElement(move.b).getBoundingClientRect(),
    };
    for (const [destination, side] of [[move.a, 'a'], [move.b, 'b']] as const) {
      const frame = map.querySelector<HTMLElement>(`[data-flat-swap-patch="${side}"]`);
      if (!frame) throw new Error('An exchanging patch frame is missing.');
      const sourceBox = side === 'a' ? origins.b : origins.a;
      const destinationBox = side === 'a' ? origins.a : origins.b;
      const frameBox = frame.getBoundingClientRect();
      const dx = sourceBox.x - destinationBox.x;
      const dy = sourceBox.y - destinationBox.y;
      const distance = Math.hypot(dx, dy);
      if (!distance) throw new Error('Exchanged terrain patches must occupy different places.');
      const lift = Math.min(12, Math.min(frameBox.width, frameBox.height) * 0.18);
      const keyframes: Keyframe[] = [0, 0.2, 0.5, 0.8, 1].map((time) => {
        const progress = postcard ? parcelMotion(time, side === 'a' ? 1 : -1).travel : time;
        const x = dx * (1 - progress);
        const y = dy * (1 - progress);
        const arc = Math.sin(time * Math.PI) * lift;
        const laneX = Math.max(stageBox.x + 10 - frameBox.x - x,
          Math.min(stageBox.right - 2 - frameBox.right - x, -dy / distance * arc));
        const laneY = Math.max(stageBox.y + 10 - frameBox.y - y,
          Math.min(stageBox.bottom - 2 - frameBox.bottom - y, dx / distance * arc));
        return { offset: time, transform: `translate(${x + laneX}px, ${y + laneY}px)` };
      });
      const elements: HTMLElement[] = [...patchCells(destination, move).map(cellElement), frame];
      for (const element of elements) {
        moving.push(element);
        element.classList.add('flat-moving');
        const animation = element.animate(keyframes, {
          duration: FLAT_EXCHANGE_MS, easing: 'cubic-bezier(.35, 0, .2, 1)', fill: 'both',
        });
        if (typeof began === 'number') animation.startTime = began;
        animations.push(animation);
      }
    }
  } catch (error) {
    active = false;
    clear();
    throw error;
  }
  void Promise.all(animations.map((animation) => animation.finished)).then(finish, fail);
  return {
    setPaused(paused) {
      if (!active) return;
      for (const animation of animations) {
        if (paused) animation.pause();
        else animation.play();
      }
    },
    finish,
    cancel() {
      active = false;
      clear();
    },
  };
}
