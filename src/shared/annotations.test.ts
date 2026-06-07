import { describe, expect, it } from 'vitest';
import { scaledCanvasSize, toImagePoint } from './annotations';

describe('scaledCanvasSize', () => {
  it('keeps smaller images at original size', () => {
    expect(scaledCanvasSize({ width: 800, height: 400 }, { width: 1200, height: 900 })).toEqual({
      width: 800,
      height: 400,
      scale: 1,
    });
  });

  it('scales large images to fit within the editor viewport', () => {
    expect(scaledCanvasSize({ width: 3000, height: 1500 }, { width: 1000, height: 800 })).toEqual({
      width: 1000,
      height: 500,
      scale: 1 / 3,
    });
  });
});

describe('toImagePoint', () => {
  it('converts displayed canvas points back to source image pixels', () => {
    expect(toImagePoint({ x: 50, y: 25 }, 0.5)).toEqual({ x: 100, y: 50 });
  });
});
