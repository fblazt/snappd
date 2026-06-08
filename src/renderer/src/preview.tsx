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

type BoxHandle = 'nw' | 'ne' | 'sw' | 'se';
type ResizeHandle = 'start' | 'end' | BoxHandle;

type ShapeAnnotation = {
  id: string;
  tool: 'arrow' | 'rectangle' | 'pixelate';
  start: Point;
  end: Point;
  color: string;
  strokeWidth: number;
};

type TextAnnotation = {
  id: string;
  tool: 'text';
  point: Point;
  text: string;
  color: string;
  fontSize: number;
  strokeWidth: number;
};

type PenAnnotation = {
  id: string;
  tool: 'pen';
  points: Point[];
  color: string;
  strokeWidth: number;
};

type Annotation = ShapeAnnotation | TextAnnotation | PenAnnotation;

type Interaction =
  | { kind: 'draw'; annotation: Annotation }
  | {
      kind: 'move';
      id: string;
      startPoint: Point;
      original: Annotation;
    }
  | {
      kind: 'resize';
      id: string;
      handle: ResizeHandle;
      startPoint: Point;
      original: Annotation;
    };

const colors = ['#ff3b30', '#ff9500', '#34c759', '#007aff', '#af52de', '#ffffff', '#000000'];
const handleSize = 8;

function Preview() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [tool, setTool] = useState<AnnotationTool>('arrow');
  const [color, setColor] = useState(colors[0]);
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [draftAnnotation, setDraftAnnotation] = useState<Annotation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [textEditor, setTextEditor] = useState<{
    id: string | null;
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

      imageRef.current = image;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.style.width = `${size.width}px`;
      canvas.style.height = `${size.height}px`;
      renderCanvas(canvas, image, annotations, draftAnnotation, selectedId);
    };
    image.src = capture.image.dataUrl;
  }, [capture]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;

    if (!canvas || !image) {
      return;
    }

    renderCanvas(canvas, image, annotations, draftAnnotation, selectedId);
  }, [annotations, draftAnnotation, selectedId]);

  useLayoutEffect(() => {
    if (!textEditor) {
      return;
    }

    textInputRef.current?.focus();
    textInputRef.current?.select();
  }, [textEditor?.displayPoint.x, textEditor?.displayPoint.y]);

  const updateAnnotation = (id: string, updater: (annotation: Annotation) => Annotation) => {
    setAnnotations((current) =>
      current.map((annotation) => (annotation.id === id ? updater(annotation) : annotation)),
    );
  };

  const selectAnnotation = (annotation: Annotation | null) => {
    setSelectedId(annotation?.id ?? null);

    if (!annotation) {
      return;
    }

    setColor(annotation.color);
    setStrokeWidth(annotation.strokeWidth);
  };

  const exportPayload = () => {
    const canvas = canvasRef.current;
    const image = imageRef.current;

    if (!canvas || !image) {
      return null;
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    renderCanvas(exportCanvas, image, annotations, null, null);

    return {
      dataUrl: exportCanvas.toDataURL('image/png'),
      width: exportCanvas.width,
      height: exportCanvas.height,
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
                  onClick={() => {
                    setColor(nextColor);
                    if (selectedId) {
                      updateAnnotation(selectedId, (annotation) => ({ ...annotation, color: nextColor }));
                    }
                  }}
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
                onChange={(event) => {
                  const nextStrokeWidth = Number(event.currentTarget.value);
                  setStrokeWidth(nextStrokeWidth);
                  if (selectedId) {
                    updateAnnotation(selectedId, (annotation) => ({
                      ...annotation,
                      strokeWidth: nextStrokeWidth,
                      ...(annotation.tool === 'text'
                        ? { fontSize: Math.max(18, nextStrokeWidth * 5) }
                        : null),
                    }));
                  }
                }}
              />
            </label>
          </header>

          <section className="image-panel">
            <div className="canvas-wrap">
              <canvas
                ref={canvasRef}
                onDoubleClick={() => {
                  const selected = annotations.find((annotation) => annotation.id === selectedId);
                  const canvas = canvasRef.current;

                  if (!selected || selected.tool !== 'text' || !canvas) {
                    return;
                  }

                  const scale = canvas.clientWidth / canvas.width;
                  setTextEditor({
                    id: selected.id,
                    imagePoint: selected.point,
                    displayPoint: toDisplayPoint(selected.point, scale),
                    value: selected.text,
                  });
                }}
                onPointerDown={(event) => {
                  const canvas = canvasRef.current;
                  const context = canvas?.getContext('2d');

                  if (!canvas || !context) {
                    return;
                  }

                  const point = eventPoint(event, canvas);
                  const scale = canvas.clientWidth / canvas.width;
                  const imagePoint = toImagePoint(point, scale);
                  const handleHit = selectedId
                    ? hitTestHandle(context, annotations, selectedId, imagePoint, scale)
                    : null;

                  if (handleHit) {
                    event.preventDefault();
                    interactionRef.current = {
                      kind: 'resize',
                      id: selectedId as string,
                      handle: handleHit,
                      startPoint: imagePoint,
                      original: cloneAnnotation(
                        annotations.find((annotation) => annotation.id === selectedId) as Annotation,
                      ),
                    };
                    canvas.setPointerCapture(event.pointerId);
                    return;
                  }

                  const hit = hitTestAnnotation(context, annotations, imagePoint, scale);

                  if (hit) {
                    event.preventDefault();
                    selectAnnotation(hit);
                    interactionRef.current = {
                      kind: 'move',
                      id: hit.id,
                      startPoint: imagePoint,
                      original: cloneAnnotation(hit),
                    };
                    canvas.setPointerCapture(event.pointerId);
                    return;
                  }

                  selectAnnotation(null);

                  if (tool === 'text') {
                    event.preventDefault();
                    setTextEditor({
                      id: null,
                      imagePoint,
                      displayPoint: point,
                      value: 'Text',
                    });
                    return;
                  }

                  const annotation = createAnnotation(tool, imagePoint, color, strokeWidth);
                  interactionRef.current = { kind: 'draw', annotation };
                  setDraftAnnotation(annotation);
                  canvas.setPointerCapture(event.pointerId);
                }}
                onPointerMove={(event) => {
                  const interaction = interactionRef.current;

                  if (!interaction) {
                    return;
                  }

                  const canvas = canvasRef.current;

                  if (!canvas) {
                    return;
                  }

                  const point = eventPoint(event, canvas);
                  const scale = canvas.clientWidth / canvas.width;
                  const imagePoint = toImagePoint(point, scale);

                  if (interaction.kind === 'draw') {
                    const nextAnnotation = updateDraftAnnotation(interaction.annotation, imagePoint);
                    interactionRef.current = { kind: 'draw', annotation: nextAnnotation };
                    setDraftAnnotation(nextAnnotation);
                    return;
                  }

                  if (interaction.kind === 'move') {
                    const delta = {
                      x: imagePoint.x - interaction.startPoint.x,
                      y: imagePoint.y - interaction.startPoint.y,
                    };
                    setAnnotations((current) =>
                      current.map((annotation) =>
                        annotation.id === interaction.id
                          ? moveAnnotation(interaction.original, delta)
                          : annotation,
                      ),
                    );
                    return;
                  }

                  setAnnotations((current) =>
                    current.map((annotation) =>
                      annotation.id === interaction.id
                        ? resizeAnnotation(interaction.original, interaction.handle, imagePoint)
                        : annotation,
                    ),
                  );
                }}
                onPointerUp={(event) => {
                  const interaction = interactionRef.current;
                  const canvas = canvasRef.current;

                  if (canvas?.hasPointerCapture(event.pointerId)) {
                    canvas.releasePointerCapture(event.pointerId);
                  }

                  if (interaction?.kind === 'draw') {
                    const annotation = interaction.annotation;
                    if (isMeaningfulAnnotation(annotation)) {
                      setAnnotations((current) => [...current, annotation]);
                      selectAnnotation(annotation);
                    }
                    setDraftAnnotation(null);
                  }

                  interactionRef.current = null;
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
                    commitText(textEditor, color, strokeWidth, setAnnotations, setSelectedId);
                    setTextEditor(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitText(textEditor, color, strokeWidth, setAnnotations, setSelectedId);
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
  editor: { id: string | null; imagePoint: Point; value: string },
  color: string,
  strokeWidth: number,
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>,
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>,
): void {
  const text = editor.value.trim();

  if (!text) {
    return;
  }

  if (editor.id) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === editor.id && annotation.tool === 'text'
          ? { ...annotation, text }
          : annotation,
      ),
    );
    setSelectedId(editor.id);
    return;
  }

  const annotation: TextAnnotation = {
    id: nextAnnotationId(),
    tool: 'text',
    point: editor.imagePoint,
    text,
    color,
    strokeWidth,
    fontSize: Math.max(18, strokeWidth * 5),
  };

  setAnnotations((current) => [...current, annotation]);
  setSelectedId(annotation.id);
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

function toDisplayPoint(point: Point, scale: number): Point {
  return {
    x: point.x * scale,
    y: point.y * scale,
  };
}

function createAnnotation(
  tool: Exclude<AnnotationTool, 'text'>,
  point: Point,
  color: string,
  strokeWidth: number,
): Annotation {
  if (tool === 'pen') {
    return {
      id: nextAnnotationId(),
      tool,
      points: [point],
      color,
      strokeWidth,
    };
  }

  return {
    id: nextAnnotationId(),
    tool,
    start: point,
    end: point,
    color,
    strokeWidth,
  };
}

function updateDraftAnnotation(annotation: Annotation, point: Point): Annotation {
  if (annotation.tool === 'text') {
    return annotation;
  }

  if (annotation.tool === 'pen') {
    return { ...annotation, points: [...annotation.points, point] };
  }

  return { ...annotation, end: point };
}

function isMeaningfulAnnotation(annotation: Annotation): boolean {
  if (annotation.tool === 'text') {
    return Boolean(annotation.text.trim());
  }

  const box = annotationBox(annotation, null);
  return box.width > 3 || box.height > 3;
}

function renderCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  annotations: Annotation[],
  draftAnnotation: Annotation | null,
  selectedId: string | null,
): void {
  const context = canvas.getContext('2d');

  if (!context) {
    return;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);
  for (const annotation of annotations) {
    drawAnnotation(context, annotation);
  }

  if (draftAnnotation) {
    drawAnnotation(context, draftAnnotation);
  }

  const selected = annotations.find((annotation) => annotation.id === selectedId);
  if (selected) {
    drawSelection(context, selected);
  }
}

function drawAnnotation(context: CanvasRenderingContext2D, annotation: Annotation): void {
  if (annotation.tool === 'text') {
    drawText(context, annotation.point, annotation.text, annotation.color, annotation.fontSize);
    return;
  }

  if (annotation.tool === 'pen') {
    drawPenPath(context, annotation.points, annotation.color, annotation.strokeWidth);
    return;
  }

  drawShape(context, annotation.tool, annotation.start, annotation.end, annotation.color, annotation.strokeWidth);
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

function drawPenPath(
  context: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  strokeWidth: number,
): void {
  if (points.length < 2) {
    return;
  }

  context.strokeStyle = color;
  context.lineWidth = strokeWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }
  context.stroke();
}

function drawText(
  context: CanvasRenderingContext2D,
  point: Point,
  text: string,
  color: string,
  fontSize: number,
): void {
  context.fillStyle = color;
  context.font = textFont(fontSize);
  context.textBaseline = 'alphabetic';
  context.fillText(text, point.x, point.y);
}

function pixelate(context: CanvasRenderingContext2D, start: Point, end: Point): void {
  const x = Math.max(0, Math.min(start.x, end.x));
  const y = Math.max(0, Math.min(start.y, end.y));
  const width = Math.min(context.canvas.width - x, Math.abs(end.x - start.x));
  const height = Math.min(context.canvas.height - y, Math.abs(end.y - start.y));

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

function drawSelection(context: CanvasRenderingContext2D, annotation: Annotation): void {
  const box = annotationBox(annotation, context);
  context.save();
  context.strokeStyle = '#0a84ff';
  context.lineWidth = 1;
  context.setLineDash([6, 4]);
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.setLineDash([]);

  for (const handle of selectionHandles(annotation, context)) {
    context.fillStyle = '#0a84ff';
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.fillRect(handle.point.x - handleSize / 2, handle.point.y - handleSize / 2, handleSize, handleSize);
    context.strokeRect(handle.point.x - handleSize / 2, handle.point.y - handleSize / 2, handleSize, handleSize);
  }
  context.restore();
}

function selectionHandles(
  annotation: Annotation,
  context: CanvasRenderingContext2D | null,
): Array<{ handle: ResizeHandle; point: Point }> {
  if (annotation.tool === 'arrow') {
    return [
      { handle: 'start', point: annotation.start },
      { handle: 'end', point: annotation.end },
    ];
  }

  const box = annotationBox(annotation, context);
  return [
    { handle: 'nw', point: { x: box.x, y: box.y } },
    { handle: 'ne', point: { x: box.x + box.width, y: box.y } },
    { handle: 'sw', point: { x: box.x, y: box.y + box.height } },
    { handle: 'se', point: { x: box.x + box.width, y: box.y + box.height } },
  ];
}

function hitTestHandle(
  context: CanvasRenderingContext2D,
  annotations: Annotation[],
  selectedId: string,
  point: Point,
  scale: number,
): ResizeHandle | null {
  const selected = annotations.find((annotation) => annotation.id === selectedId);

  if (!selected) {
    return null;
  }

  const tolerance = Math.max(handleSize / scale, 6);
  for (const handle of selectionHandles(selected, context)) {
    if (distance(point, handle.point) <= tolerance) {
      return handle.handle;
    }
  }

  return null;
}

function hitTestAnnotation(
  context: CanvasRenderingContext2D,
  annotations: Annotation[],
  point: Point,
  scale: number,
): Annotation | null {
  const tolerance = Math.max(8 / scale, 5);

  for (let annotationIndex = annotations.length - 1; annotationIndex >= 0; annotationIndex -= 1) {
    const annotation = annotations[annotationIndex];

    if (annotation.tool === 'arrow') {
      if (distanceToSegment(point, annotation.start, annotation.end) <= tolerance + annotation.strokeWidth / 2) {
        return annotation;
      }
      continue;
    }

    if (annotation.tool === 'pen') {
      for (let index = 1; index < annotation.points.length; index += 1) {
        if (
          distanceToSegment(point, annotation.points[index - 1], annotation.points[index]) <=
          tolerance + annotation.strokeWidth / 2
        ) {
          return annotation;
        }
      }
      continue;
    }

    const box = annotationBox(annotation, context);
    if (
      point.x >= box.x - tolerance &&
      point.x <= box.x + box.width + tolerance &&
      point.y >= box.y - tolerance &&
      point.y <= box.y + box.height + tolerance
    ) {
      return annotation;
    }
  }

  return null;
}

function annotationBox(annotation: Annotation, context: CanvasRenderingContext2D | null): DOMRect {
  if (annotation.tool === 'text') {
    const width = measureTextWidth(context, annotation.text, annotation.fontSize);
    const height = annotation.fontSize;
    return new DOMRect(annotation.point.x, annotation.point.y - height, width, height);
  }

  if (annotation.tool === 'pen') {
    const xs = annotation.points.map((point) => point.x);
    const ys = annotation.points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return new DOMRect(x, y, Math.max(1, Math.max(...xs) - x), Math.max(1, Math.max(...ys) - y));
  }

  const x = Math.min(annotation.start.x, annotation.end.x);
  const y = Math.min(annotation.start.y, annotation.end.y);
  return new DOMRect(x, y, Math.abs(annotation.end.x - annotation.start.x), Math.abs(annotation.end.y - annotation.start.y));
}

function moveAnnotation(annotation: Annotation, delta: Point): Annotation {
  if (annotation.tool === 'text') {
    return { ...annotation, point: addPoint(annotation.point, delta) };
  }

  if (annotation.tool === 'pen') {
    return { ...annotation, points: annotation.points.map((point) => addPoint(point, delta)) };
  }

  return {
    ...annotation,
    start: addPoint(annotation.start, delta),
    end: addPoint(annotation.end, delta),
  };
}

function resizeAnnotation(annotation: Annotation, handle: ResizeHandle, point: Point): Annotation {
  if (annotation.tool === 'arrow') {
    if (handle === 'start') {
      return { ...annotation, start: point };
    }
    return { ...annotation, end: point };
  }

  const box = annotationBox(annotation, null);
  const nextBox = resizeBox(box, handle as BoxHandle, point);

  if (annotation.tool === 'text') {
    const nextFontSize = Math.max(8, nextBox.height);
    return {
      ...annotation,
      point: { x: nextBox.x, y: nextBox.y + nextBox.height },
      fontSize: nextFontSize,
    };
  }

  if (annotation.tool === 'pen') {
    return {
      ...annotation,
      points: scalePoints(annotation.points, box, nextBox),
    };
  }

  return {
    ...annotation,
    start: { x: nextBox.x, y: nextBox.y },
    end: { x: nextBox.x + nextBox.width, y: nextBox.y + nextBox.height },
  };
}

function resizeBox(box: DOMRect, handle: BoxHandle, point: Point): DOMRect {
  const opposite = {
    nw: { x: box.x + box.width, y: box.y + box.height },
    ne: { x: box.x, y: box.y + box.height },
    sw: { x: box.x + box.width, y: box.y },
    se: { x: box.x, y: box.y },
  }[handle];
  const x = Math.min(opposite.x, point.x);
  const y = Math.min(opposite.y, point.y);

  return new DOMRect(x, y, Math.max(1, Math.abs(point.x - opposite.x)), Math.max(1, Math.abs(point.y - opposite.y)));
}

function scalePoints(points: Point[], from: DOMRect, to: DOMRect): Point[] {
  return points.map((point) => ({
    x: to.x + ((point.x - from.x) / Math.max(1, from.width)) * to.width,
    y: to.y + ((point.y - from.y) / Math.max(1, from.height)) * to.height,
  }));
}

function measureTextWidth(
  context: CanvasRenderingContext2D | null,
  text: string,
  fontSize: number,
): number {
  if (!context) {
    return Math.max(1, text.length * fontSize * 0.55);
  }

  context.save();
  context.font = textFont(fontSize);
  const width = context.measureText(text).width;
  context.restore();
  return Math.max(1, width);
}

function textFont(fontSize: number): string {
  return `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
}

function addPoint(point: Point, delta: Point): Point {
  return {
    x: point.x + delta.x,
    y: point.y + delta.y,
  };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return distance(point, start);
  }

  const progress = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared),
  );
  return distance(point, { x: start.x + progress * dx, y: start.y + progress * dy });
}

function cloneAnnotation(annotation: Annotation): Annotation {
  return structuredClone(annotation) as Annotation;
}

function nextAnnotationId(): string {
  return crypto.randomUUID();
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
