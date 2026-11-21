import { COURIER_SCALE } from './worldTheme.ts';

export function flatCourierGeometry(cellWidth: number, cellHeight: number): {
  width: number; height: number; offsetX: number; offsetY: number;
} {
  const width = cellWidth * 0.37 * COURIER_SCALE;
  const height = cellHeight * 0.62 * COURIER_SCALE;
  return {
    width, height,
    offsetX: cellWidth * 0.3 - width / 2,
    offsetY: (cellHeight - height) / 2,
  };
}

export function courierWorldScale(labelScale: number): number {
  return COURIER_SCALE * Math.min(2.2, Math.max(1, labelScale * 1.65));
}
