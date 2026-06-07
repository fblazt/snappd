export type AnnotationTool = 'arrow' | 'rectangle' | 'text' | 'pixelate' | 'pen';

export function scaledCanvasSize(
  image: { width: number; height: number },
  maxSize: { width: number; height: number },
): { width: number; height: number; scale: number } {
  const scale = Math.min(1, maxSize.width / image.width, maxSize.height / image.height);

  return {
    width: Math.round(image.width * scale),
    height: Math.round(image.height * scale),
    scale,
  };
}

export function toImagePoint(
  point: { x: number; y: number },
  scale: number,
): { x: number; y: number } {
  return {
    x: Math.round(point.x / scale),
    y: Math.round(point.y / scale),
  };
}
