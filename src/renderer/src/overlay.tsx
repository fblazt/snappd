import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Rectangle } from '../../shared/capture';
import './overlay.css';

interface Point {
  x: number;
  y: number;
}

export function Overlay() {
  const displayId = useMemo(
    () => Number(new URLSearchParams(window.location.search).get('displayId')),
    [],
  );
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void window.snappd.cancelRegionSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const selectionRect = startPoint && currentPoint ? getRect(startPoint, currentPoint) : null;

  return (
    <button
      type="button"
      className="selection-overlay"
      aria-label="Region selection overlay"
      onMouseDown={(event) => {
        const point = { x: event.clientX, y: event.clientY };
        setStartPoint(point);
        setCurrentPoint(point);
      }}
      onMouseMove={(event) => {
        if (startPoint) {
          setCurrentPoint({ x: event.clientX, y: event.clientY });
        }
      }}
      onMouseUp={() => {
        if (!selectionRect || selectionRect.width < 4 || selectionRect.height < 4) {
          setStartPoint(null);
          setCurrentPoint(null);
          return;
        }

        void window.snappd.completeRegionSelection({ displayId, rect: selectionRect });
      }}
    >
      <div className="overlay-hint">Drag to capture · Esc to cancel</div>
      {selectionRect ? <div className="selection-box" style={toStyle(selectionRect)} /> : null}
    </button>
  );
}

function getRect(start: Point, end: Point): Rectangle {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);

  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function toStyle(rect: Rectangle) {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

const root = document.getElementById('overlay-root');

if (!root) {
  throw new Error('Overlay root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <Overlay />
  </StrictMode>,
);
