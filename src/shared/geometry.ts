import type { Rectangle } from './capture';

export interface DisplayGeometry {
  bounds: Rectangle;
  scaleFactor: number;
}

export function toPhysicalRect(rect: Rectangle, display: DisplayGeometry): Rectangle {
  return {
    x: Math.round((rect.x - display.bounds.x) * display.scaleFactor),
    y: Math.round((rect.y - display.bounds.y) * display.scaleFactor),
    width: Math.round(rect.width * display.scaleFactor),
    height: Math.round(rect.height * display.scaleFactor),
  };
}

export function toDisplayRelativeRect(rect: Rectangle, display: DisplayGeometry): Rectangle {
  return {
    x: rect.x - display.bounds.x,
    y: rect.y - display.bounds.y,
    width: rect.width,
    height: rect.height,
  };
}

export function clampRectToBounds(rect: Rectangle, bounds: Rectangle): Rectangle {
  const x = Math.max(rect.x, bounds.x);
  const y = Math.max(rect.y, bounds.y);
  const maxX = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const maxY = Math.min(rect.y + rect.height, bounds.y + bounds.height);

  return {
    x,
    y,
    width: Math.max(0, maxX - x),
    height: Math.max(0, maxY - y),
  };
}
