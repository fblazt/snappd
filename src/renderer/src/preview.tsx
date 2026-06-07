import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AnnotationTool } from '../../shared/annotations';
import { scaledCanvasSize, toImagePoint } from '../../shared/annotations';
import type { CaptureResult } from '../../shared/capture';
import './preview.css';

interface Point {
  x: number;
  y: number;
}

const colors = ['#ff3b30', '#ff9500', '#34c759', '#007aff', '#af52de', '#ffffff', '#000000'];

function Preview() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const startPointRef = useRef<Point | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('arrow');
  const [color, setColor] = useState(colors[0]);
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [textEditor, setTextEditor] = useState<{
    imagePoint: Point;
    displayPoint: Point;
    value: string;
  } | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    void window.snappd.getPreviewCapture().then((response) => {
      setCapture(response.capture);
    });
  }, []);

  useEffect(() => {
    if (!capture || !canvasRef.current) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;

      if (!canvas) {
        return;
      }

      const size = scaledCanvasSize(
        { width: image.naturalWidth, height: image.naturalHeight },
        previewCanvasMaxSize(),
      );

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
      canvas.getContext('2d')?.drawImage(image, 0, 0);
    };
    image.src = capture.image.dataUrl;
  }, [capture]);

  useLayoutEffect(() => {
    if (!textEditor) {
      return;
    }

    textInputRef.current?.focus();
    textInputRef.current?.select();
  }, [textEditor]);

  const exportPayload = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    };
  };

  return (
    <main className="preview-window">
      {capture ? (
        <>
          <header className="annotation-toolbar">
            <div className="tool-list" role="toolbar" aria-label="Annotation tools">
              {(['arrow', 'rectangle', 'text', 'pixelate', 'pen'] as const).map((nextTool) => (
                <button
                  type="button"
                  className={tool === nextTool ? 'icon-button active' : 'icon-button'}
                  key={nextTool}
                  onClick={() => setTool(nextTool)}
                  title={toolTooltip(nextTool)}
                  aria-label={toolTooltip(nextTool)}
                >
                  <ToolIcon tool={nextTool} />
                </button>
              ))}
            </div>

            <div className="toolbar-divider" />

            <fieldset className="color-list" aria-label="Annotation color">
              {colors.map((nextColor) => (
                <button
                  type="button"
                  className={color === nextColor ? 'active swatch' : 'swatch'}
                  key={nextColor}
                  style={{ background: nextColor }}
                  onClick={() => setColor(nextColor)}
                  title={`Use ${nextColor}`}
                  aria-label={`Use ${nextColor}`}
                />
              ))}
            </fieldset>

            <label className="stroke-control" title="Change stroke width">
              <span>Stroke</span>
              <input
                type="range"
                min="2"
                max="24"
                value={strokeWidth}
                onChange={(event) => setStrokeWidth(Number(event.currentTarget.value))}
              />
            </label>
          </header>

          <section className="image-panel">
            <div className="canvas-wrap">
              <canvas
                ref={canvasRef}
                onPointerDown={(event) => {
                  const canvas = canvasRef.current;
                  const context = canvas?.getContext('2d');

                  if (!canvas || !context) {
                    return;
                  }

                  const point = eventPoint(event, canvas);
                  const scale = canvas.clientWidth / canvas.width;
                  const imagePoint = toImagePoint(point, scale);

                  if (tool === 'text') {
                    event.preventDefault();
                    setTextEditor({
                      imagePoint,
                      displayPoint: point,
                      value: 'Text',
                    });
                    return;
                  }

                  startPointRef.current = imagePoint;
                  snapshotRef.current = context.getImageData(0, 0, canvas.width, canvas.height);
                }}
                onPointerMove={(event) => {
                  if (!startPointRef.current || tool === 'text') {
                    return;
                  }

                  const canvas = canvasRef.current;
                  const context = canvas?.getContext('2d');
                  const snapshot = snapshotRef.current;

                  if (!canvas || !context || !snapshot) {
                    return;
                  }

                  const point = eventPoint(event, canvas);
                  const scale = canvas.clientWidth / canvas.width;
                  const imagePoint = toImagePoint(point, scale);

                  if (tool === 'pen') {
                    drawPen(context, startPointRef.current, imagePoint, color, strokeWidth);
                    startPointRef.current = imagePoint;
                    return;
                  }

                  context.putImageData(snapshot, 0, 0);
                  drawShape(context, tool, startPointRef.current, imagePoint, color, strokeWidth);
                }}
                onPointerUp={(event) => {
                  const canvas = canvasRef.current;
                  const context = canvas?.getContext('2d');
                  const startPoint = startPointRef.current;

                  if (!canvas || !context || !startPoint || tool === 'text' || tool === 'pen') {
                    startPointRef.current = null;
                    snapshotRef.current = null;
                    return;
                  }

                  const point = eventPoint(event, canvas);
                  const scale = canvas.clientWidth / canvas.width;
                  const imagePoint = toImagePoint(point, scale);

                  snapshotRef.current && context.putImageData(snapshotRef.current, 0, 0);
                  drawShape(context, tool, startPoint, imagePoint, color, strokeWidth);
                  startPointRef.current = null;
                  snapshotRef.current = null;
                }}
              />
              {textEditor ? (
                <input
                  ref={textInputRef}
                  className="inline-text-editor"
                  type="text"
                  value={textEditor.value}
                  style={{ left: textEditor.displayPoint.x, top: textEditor.displayPoint.y }}
                  placeholder="Type text"
                  onPointerDown={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    setTextEditor({ ...textEditor, value: event.currentTarget.value });
                  }}
                  onBlur={() => {
                    commitText(textEditor, color, strokeWidth, canvasRef.current);
                    setTextEditor(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitText(textEditor, color, strokeWidth, canvasRef.current);
                      setTextEditor(null);
                    }

                    if (event.key === 'Escape') {
                      setTextEditor(null);
                    }
                  }}
                />
              ) : null}
            </div>
          </section>

          <footer className="toolbar">
            <div>
              <strong>
                {capture.width} × {capture.height}
              </strong>
              {status ? <span>{status}</span> : null}
            </div>
            <div className="actions">
              <button
                type="button"
                onClick={() => {
                  const payload = exportPayload();
                  if (payload) {
                    void window.snappd
                      .copyAnnotatedCapture(payload)
                      .then(() => setStatus('Copied'));
                  }
                }}
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  const payload = exportPayload();
                  if (payload) {
                    void window.snappd.saveAnnotatedCapture(payload).then((response) => {
                      setStatus(
                        response.status === 'saved'
                          ? `Saved to ${response.filePath}`
                          : response.message,
                      );
                    });
                  }
                }}
              >
                Save
              </button>
              <button type="button" onClick={() => void window.snappd.closePreview()}>
                Discard
              </button>
            </div>
          </footer>
        </>
      ) : (
        <p className="empty-state">No capture available.</p>
      )}
    </main>
  );
}

function commitText(
  editor: { imagePoint: Point; value: string },
  color: string,
  strokeWidth: number,
  canvas: HTMLCanvasElement | null,
): void {
  const text = editor.value.trim();
  const context = canvas?.getContext('2d');

  if (!text || !context) {
    return;
  }

  drawText(context, editor.imagePoint, text, color, strokeWidth);
}

function previewCanvasMaxSize(): { width: number; height: number } {
  return {
    width: Math.max(320, window.innerWidth - 96),
    height: Math.max(220, window.innerHeight - 210),
  };
}

function eventPoint(
  event: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement,
): Point {
  const bounds = canvas.getBoundingClientRect();

  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
}

function drawShape(
  context: CanvasRenderingContext2D,
  tool: Exclude<AnnotationTool, 'text' | 'pen'>,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
): void {
  if (tool === 'arrow') {
    drawArrow(context, start, end, color, strokeWidth);
    return;
  }

  if (tool === 'rectangle') {
    context.strokeStyle = color;
    context.lineWidth = strokeWidth;
    context.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    return;
  }

  pixelate(context, start, end);
}

function drawArrow(
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
): void {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = Math.max(18, strokeWidth * 4);

  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = strokeWidth;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 6),
    end.y - headLength * Math.sin(angle - Math.PI / 6),
  );
  context.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 6),
    end.y - headLength * Math.sin(angle + Math.PI / 6),
  );
  context.closePath();
  context.fill();
}

function drawPen(
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
): void {
  context.strokeStyle = color;
  context.lineWidth = strokeWidth;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function drawText(
  context: CanvasRenderingContext2D,
  point: Point,
  text: string,
  color: string,
  strokeWidth: number,
): void {
  context.fillStyle = color;
  context.font = `${Math.max(18, strokeWidth * 5)}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.fillText(text, point.x, point.y);
}

function pixelate(context: CanvasRenderingContext2D, start: Point, end: Point): void {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  if (width < 4 || height < 4) {
    return;
  }

  const block = 14;
  const imageData = context.getImageData(x, y, width, height);

  for (let blockY = 0; blockY < height; blockY += block) {
    for (let blockX = 0; blockX < width; blockX += block) {
      const index = (Math.floor(blockY) * imageData.width + Math.floor(blockX)) * 4;
      context.fillStyle = `rgb(${imageData.data[index]}, ${imageData.data[index + 1]}, ${imageData.data[index + 2]})`;
      context.fillRect(x + blockX, y + blockY, block, block);
    }
  }
}

function toolTooltip(tool: AnnotationTool): string {
  const labels = {
    arrow: 'Arrow: draw a callout arrow',
    rectangle: 'Rectangle: outline an area',
    text: 'Text: place a text label',
    pixelate: 'Pixelate: obscure a selected area',
    pen: 'Pen: draw freehand lines',
  } satisfies Record<AnnotationTool, string>;

  return labels[tool];
}

function ToolIcon({ tool }: { tool: AnnotationTool }) {
  if (tool === 'arrow') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19 18 6" />
        <path d="M10 6h8v8" />
      </svg>
    );
  }

  if (tool === 'rectangle') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="6" width="14" height="12" rx="1.5" />
      </svg>
    );
  }

  if (tool === 'text') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14" />
        <path d="M12 6v12" />
        <path d="M9 18h6" />
      </svg>
    );
  }

  if (tool === 'pixelate') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 17c4-8 6 4 10-4 2-4 3-6 6-7" />
      <path d="m18 5 2 1-1 2" />
    </svg>
  );
}

const root = document.getElementById('preview-root');

if (!root) {
  throw new Error('Preview root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
