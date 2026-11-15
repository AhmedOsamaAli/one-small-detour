import type { GuideBounds, GuideTarget } from '../shared/types.ts';

interface Size { width: number; height: number }

function overlap(a: GuideBounds, b: GuideBounds): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function sameGuideTarget(a: GuideTarget | null, b: GuideTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.patches.length !== b.patches.length ||
      a.viewport.width !== b.viewport.width || a.viewport.height !== b.viewport.height) return false;
  const same = (first: GuideBounds, second: GuideBounds): boolean =>
    Math.abs(first.x - second.x) < 0.1 && Math.abs(first.y - second.y) < 0.1 &&
    Math.abs(first.width - second.width) < 0.1 && Math.abs(first.height - second.height) < 0.1;
  return same(a.cell, b.cell) && a.patches.every((patch, index) => {
    const other = b.patches[index];
    return other !== undefined && same(patch, other);
  });
}

export function placeCoach(target: GuideTarget, bubble: Size, viewport: Size, controls: readonly GuideBounds[]): GuideBounds {
  if (![bubble.width, bubble.height, viewport.width, viewport.height].every((value) => Number.isFinite(value) && value > 0) ||
      bubble.width > viewport.width - 16 || bubble.height > viewport.height - 16) {
    throw new Error('The tutorial hint is larger than its available viewport.');
  }
  const pad = 8;
  const gap = 12;
  const patch = target.patches[0] ?? target.cell;
  const center = { x: target.cell.x + target.cell.width / 2, y: target.cell.y + target.cell.height / 2 };
  const avoid = [...target.patches, ...controls].map((bounds) => ({
    x: bounds.x - 4, y: bounds.y - 4, width: bounds.width + 8, height: bounds.height + 8,
  }));
  const xs = [center.x - bubble.width / 2, patch.x - bubble.width - gap, patch.x + patch.width + gap, pad, viewport.width - bubble.width - pad];
  const ys = [patch.y - bubble.height - gap, patch.y + patch.height + gap, center.y - bubble.height / 2, pad, viewport.height - bubble.height - pad];
  for (const bounds of avoid) {
    xs.push(bounds.x - bubble.width - 1, bounds.x + bounds.width + 1);
    ys.push(bounds.y - bubble.height - 1, bounds.y + bounds.height + 1);
  }
  let best: GuideBounds | null = null;
  let score = Infinity;
  for (const x of xs) for (const y of ys) {
    const candidate = {
      x: Math.round(Math.max(pad, Math.min(viewport.width - bubble.width - pad, x))),
      y: Math.round(Math.max(pad, Math.min(viewport.height - bubble.height - pad, y))),
      width: bubble.width, height: bubble.height,
    };
    if (avoid.some((bounds) => overlap(candidate, bounds))) continue;
    const nearX = Math.max(candidate.x, Math.min(candidate.x + candidate.width, center.x));
    const nearY = Math.max(candidate.y, Math.min(candidate.y + candidate.height, center.y));
    const distance = Math.hypot(center.x - nearX, center.y - nearY);
    if (distance < score) { best = candidate; score = distance; }
  }
  if (!best) throw new Error('The tutorial hint cannot fit without covering its target or controls.');
  return best;
}
