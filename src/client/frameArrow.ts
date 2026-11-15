import type { FrameAxes, Shape } from '../shared/types.ts';

export function frameArrowPath(shape: Shape, axes: FrameAxes): string {
  const axis = shape.rows > shape.cols ? axes.row : axes.col;
  const length = Math.hypot(axis.x, axis.y);
  if (!Number.isFinite(length) || length === 0) throw new Error('The frame direction cannot be projected.');
  const x = axis.x / length;
  const y = axis.y / length;
  const round = (value: number): number => Number(value.toFixed(3));
  const tail = `${round(16 - x * 12)} ${round(16 - y * 12)}`;
  const left = `${round(16 - x * 5 - y * 4)} ${round(16 - y * 5 + x * 4)}`;
  const right = `${round(16 - x * 5 + y * 4)} ${round(16 - y * 5 - x * 4)}`;
  return `M${tail} 16 16M${left} 16 16 ${right}`;
}
