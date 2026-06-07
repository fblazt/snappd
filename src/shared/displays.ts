import type { Rectangle } from './capture';

export interface DisplayLike {
  id: number;
  bounds: Rectangle;
}

export function displayContainingPoint<TDisplay extends DisplayLike>(
  displays: TDisplay[],
  point: { x: number; y: number },
): TDisplay | null {
  return (
    displays.find(
      (display) =>
        point.x >= display.bounds.x &&
        point.x < display.bounds.x + display.bounds.width &&
        point.y >= display.bounds.y &&
        point.y < display.bounds.y + display.bounds.height,
    ) ?? null
  );
}
