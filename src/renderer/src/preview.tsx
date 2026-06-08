import { StrictMode, useEffect, useLayoutEffect, useReducer, useRef } from 'react';
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
type SelectionHandle = ResizeHandle | 'rotate';

type ShapeAnnotation = {
  id: string;
  tool: 'arrow' | 'rectangle' | 'pixelate';
  start: Point;
  end: Point;
  color: string;
  strokeWidth: number;
  rotation: number;
};

type TextAnnotation = {
  id: string;
  tool: 'text';
  point: Point;
  text: string;
  color: string;
  fontSize: number;
  strokeWidth: number;
  rotation: number;
};

type PenAnnotation = {
  id: string;
  tool: 'pen';
  points: Point[];
  color: string;
  strokeWidth: number;
  rotation: number;
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
    }
  | {
      kind: 'rotate';
      id: string;
      original: Annotation;
    };

type TextEditor = {
  id: string | null;
  imagePoint: Point;
  displayPoint: Point;
  value: string;
};

interface PreviewState {
  capture: CaptureResult | null;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  annotations: Annotation[];
  draftAnnotation: Annotation | null;
  selectedId: string | null;
  displaySize: { width: number; height: number } | null;
  zoom: number;
  textEditor: TextEditor | null;
  status: string;
}

type PreviewAction = Partial<PreviewState> | ((current: PreviewState) => Partial<PreviewState>);

const initialPreviewState: PreviewState = {
  capture: null,
  tool: 'arrow',
  color: '#ff3b30',
  strokeWidth: 6,
  annotations: [],
  draftAnnotation: null,
  selectedId: null,
  displaySize: null,
  zoom: 1,
  textEditor: null,
  status: '',
};

const colors = ['#ff3b30', '#ff9500', '#34c759', '#007aff', '#af52de', '#ffffff', '#000000'];
const handleSize = 12;
const rotateHandleSize = 30;
const minZoom = 0.25;
const maxZoom = 4;
const zoomStep = 0.25;

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imagePanelRef = useRef<HTMLElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [state, setState] = useReducer((current: PreviewState, action: PreviewAction) => {
    const next = typeof action === 'function' ? action(current) : action;
    return { ...current, ...next };
  }, initialPreviewState);
  const {
    capture,
    tool,
    color,
    strokeWidth,
    annotations,
    draftAnnotation,
    selectedId,
    displaySize,
    zoom,
    textEditor,
    status,
  } = state;
  const setAnnotations = (updater: (current: Annotation[]) => Annotation[]) => {
    setState((current) => ({ annotations: updater(current.annotations) }));
  };
  const setSelectedId = (updater: string | null) => setState({ selectedId: updater });

  useEffect(() => {
    void window.snappd.getPreviewCapture().then((response) => {
      setState({ capture: response.capture });
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
      setState({ displaySize: size });
      renderCanvas(canvas, image, [], null, null);
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

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !displaySize) {
      return;
    }

    canvas.style.width = `${displaySize.width * zoom}px`;
    canvas.style.height = `${displaySize.height * zoom}px`;
  }, [displaySize, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !textEditor) {
      return;
    }

    const scale = canvas.clientWidth / canvas.width;
    const displayPoint = toDisplayPoint(textEditor.imagePoint, scale);

    if (
      displayPoint.x === textEditor.displayPoint.x &&
      displayPoint.y === textEditor.displayPoint.y
    ) {
      return;
    }

    setState((current) => ({
      textEditor: current.textEditor
        ? {
            ...current.textEditor,
            displayPoint,
          }
        : null,
    }));
  }, [zoom, displaySize?.width, displaySize?.height, textEditor]);

  useLayoutEffect(() => {
    if (!textEditor) {
      return;
    }

    textInputRef.current?.focus();
    textInputRef.current?.select();
  }, [textEditor]);

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

    setState({ color: annotation.color, strokeWidth: annotation.strokeWidth });
  };

  const handlePreviewWheel = (event: React.WheelEvent<HTMLElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    const panel = imagePanelRef.current;

    if (!panel) {
      return;
    }

    event.preventDefault();

    const bounds = panel.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const contentX = panel.scrollLeft + pointerX;
    const contentY = panel.scrollTop + pointerY;
    let previousZoom = zoom;
    let nextZoom = zoom;

    setState((current) => {
      previousZoom = current.zoom;
      nextZoom = clampZoom(current.zoom * Math.exp(-event.deltaY * 0.005));
      return { zoom: nextZoom };
    });

    window.requestAnimationFrame(() => {
      if (nextZoom === previousZoom) {
        return;
      }

      const ratio = nextZoom / previousZoom;
      panel.scrollLeft = contentX * ratio - pointerX;
      panel.scrollTop = contentY * ratio - pointerY;
    });
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
          <PreviewToolbar
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            selectedId={selectedId}
            zoom={zoom}
            setState={setState}
            updateAnnotation={updateAnnotation}
          />

          <PreviewCanvas
            imagePanelRef={imagePanelRef}
            canvasRef={canvasRef}
            textInputRef={textInputRef}
            interactionRef={interactionRef}
            annotations={annotations}
            selectedId={selectedId}
            textEditor={textEditor}
            tool={tool}
            color={color}
            strokeWidth={strokeWidth}
            handlePreviewWheel={handlePreviewWheel}
            selectAnnotation={selectAnnotation}
            setAnnotations={setAnnotations}
            setSelectedId={setSelectedId}
            setState={setState}
          />

          <PreviewFooter
            capture={capture}
            status={status}
            exportPayload={exportPayload}
            setState={setState}
          />
        </>
      ) : (
        <p className="empty-state">No capture available.</p>
      )}
    </main>
  );
}

function PreviewCanvas({
  imagePanelRef,
  canvasRef,
  textInputRef,
  interactionRef,
  annotations,
  selectedId,
  textEditor,
  tool,
  color,
  strokeWidth,
  handlePreviewWheel,
  selectAnnotation,
  setAnnotations,
  setSelectedId,
  setState,
}: {
  imagePanelRef: React.RefObject<HTMLElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  textInputRef: React.RefObject<HTMLInputElement | null>;
  interactionRef: React.RefObject<Interaction | null>;
  annotations: Annotation[];
  selectedId: string | null;
  textEditor: TextEditor | null;
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  handlePreviewWheel: (event: React.WheelEvent<HTMLElement>) => void;
  selectAnnotation: (annotation: Annotation | null) => void;
  setAnnotations: (updater: (current: Annotation[]) => Annotation[]) => void;
  setSelectedId: (selectedId: string | null) => void;
  setState: React.Dispatch<PreviewAction>;
}) {
  return (
    <section className="image-panel" ref={imagePanelRef} onWheel={handlePreviewWheel}>
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          onDoubleClick={() => {
            const selected = annotations.find((annotation) => annotation.id === selectedId);
            const canvas = canvasRef.current;

            if (selected?.tool !== 'text' || !canvas) {
              return;
            }

            const scale = canvas.clientWidth / canvas.width;
            setState({
              textEditor: {
                id: selected.id,
                imagePoint: selected.point,
                displayPoint: toDisplayPoint(selected.point, scale),
                value: selected.text,
              },
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
              const selected = annotations.find(
                (annotation) => annotation.id === selectedId,
              ) as Annotation;

              event.preventDefault();
              interactionRef.current =
                handleHit === 'rotate'
                  ? {
                      kind: 'rotate',
                      id: selectedId as string,
                      original: cloneAnnotation(selected),
                    }
                  : {
                      kind: 'resize',
                      id: selectedId as string,
                      handle: handleHit,
                      startPoint: imagePoint,
                      original: cloneAnnotation(selected),
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
              setState({
                textEditor: {
                  id: null,
                  imagePoint,
                  displayPoint: point,
                  value: 'Text',
                },
              });
              return;
            }

            const annotation = createAnnotation(tool, imagePoint, color, strokeWidth);
            interactionRef.current = { kind: 'draw', annotation };
            setState({ draftAnnotation: annotation });
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
              setState({ draftAnnotation: nextAnnotation });
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

            if (interaction.kind === 'resize') {
              setAnnotations((current) =>
                current.map((annotation) =>
                  annotation.id === interaction.id
                    ? resizeAnnotation(interaction.original, interaction.handle, imagePoint)
                    : annotation,
                ),
              );
              return;
            }

            setAnnotations((current) =>
              current.map((annotation) =>
                annotation.id === interaction.id
                  ? rotateAnnotation(interaction.original, imagePoint)
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
              setState({ draftAnnotation: null });
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
            aria-label="Annotation text"
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => {
              setState({ textEditor: { ...textEditor, value: event.currentTarget.value } });
            }}
            onBlur={() => {
              commitText(textEditor, color, strokeWidth, setAnnotations, setSelectedId);
              setState({ textEditor: null });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitText(textEditor, color, strokeWidth, setAnnotations, setSelectedId);
                setState({ textEditor: null });
              }

              if (event.key === 'Escape') {
                setState({ textEditor: null });
              }
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function PreviewToolbar({
  tool,
  color,
  strokeWidth,
  selectedId,
  zoom,
  setState,
  updateAnnotation,
}: {
  tool: AnnotationTool;
  color: string;
  strokeWidth: number;
  selectedId: string | null;
  zoom: number;
  setState: React.Dispatch<PreviewAction>;
  updateAnnotation: (id: string, updater: (annotation: Annotation) => Annotation) => void;
}) {
  return (
    <header className="annotation-toolbar">
      <div className="tool-list" role="toolbar" aria-label="Annotation tools">
        {(['arrow', 'rectangle', 'text', 'pixelate', 'pen'] as const).map((nextTool) => (
          <button
            type="button"
            className={tool === nextTool ? 'icon-button active' : 'icon-button'}
            key={nextTool}
            onClick={() => setState({ tool: nextTool })}
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
              setState({ color: nextColor });
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
            setState({ strokeWidth: nextStrokeWidth });
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

      <fieldset className="zoom-control" aria-label="Preview zoom controls">
        <button
          type="button"
          onClick={() => setState((current) => ({ zoom: clampZoom(current.zoom - zoomStep) }))}
          disabled={zoom <= minZoom}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setState((current) => ({ zoom: clampZoom(current.zoom + zoomStep) }))}
          disabled={zoom >= maxZoom}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setState({ zoom: 1 })}
          disabled={zoom === 1}
          title="Reset zoom"
        >
          Reset
        </button>
      </fieldset>
    </header>
  );
}

function PreviewFooter({
  capture,
  status,
  exportPayload,
  setState,
}: {
  capture: CaptureResult;
  status: string;
  exportPayload: () => { dataUrl: string; width: number; height: number } | null;
  setState: React.Dispatch<PreviewAction>;
}) {
  return (
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
                .then(() => setState({ status: 'Copied' }));
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
                setState({
                  status:
                    response.status === 'saved'
                      ? `Saved to ${response.filePath}`
                      : response.message,
                });
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
  );
}

function commitText(
  editor: { id: string | null; imagePoint: Point; value: string },
  color: string,
  strokeWidth: number,
  setAnnotations: (updater: (current: Annotation[]) => Annotation[]) => void,
  setSelectedId: (selectedId: string | null) => void,
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
    rotation: 0,
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

function clampZoom(value: number): number {
  return Math.min(maxZoom, Math.max(minZoom, value));
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
      rotation: 0,
    };
  }

  return {
    id: nextAnnotationId(),
    tool,
    start: point,
    end: point,
    color,
    strokeWidth,
    rotation: 0,
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
  context.save();
  rotateContext(context, annotation);

  if (annotation.tool === 'text') {
    drawText(context, annotation.point, annotation.text, annotation.color, annotation.fontSize);
    context.restore();
    return;
  }

  if (annotation.tool === 'pen') {
    drawPenPath(context, annotation.points, annotation.color, annotation.strokeWidth);
    context.restore();
    return;
  }

  drawShape(
    context,
    annotation.tool,
    annotation.start,
    annotation.end,
    annotation.color,
    annotation.strokeWidth,
  );
  context.restore();
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
  const headWidth = Math.max(12, strokeWidth * 3);
  const shaftEnd = {
    x: end.x - Math.cos(angle) * headLength * 0.72,
    y: end.y - Math.sin(angle) * headLength * 0.72,
  };
  const perpendicular = angle + Math.PI / 2;
  const leftBase = {
    x: shaftEnd.x + Math.cos(perpendicular) * headWidth * 0.5,
    y: shaftEnd.y + Math.sin(perpendicular) * headWidth * 0.5,
  };
  const rightBase = {
    x: shaftEnd.x - Math.cos(perpendicular) * headWidth * 0.5,
    y: shaftEnd.y - Math.sin(perpendicular) * headWidth * 0.5,
  };

  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = strokeWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(shaftEnd.x, shaftEnd.y);
  context.stroke();

  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(leftBase.x, leftBase.y);
  context.lineTo(rightBase.x, rightBase.y);
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
  const center = annotationCenter(annotation, context);

  context.save();
  context.translate(center.x, center.y);
  context.rotate(annotation.rotation);
  context.translate(-center.x, -center.y);
  context.strokeStyle = '#0a84ff';
  context.lineWidth = 1;
  context.setLineDash([6, 4]);
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.setLineDash([]);

  const topCenter = { x: box.x + box.width / 2, y: box.y };
  context.beginPath();
  context.moveTo(topCenter.x, topCenter.y);
  context.lineTo(topCenter.x, topCenter.y - 36);
  context.stroke();
  context.restore();

  for (const handle of selectionHandles(annotation, context)) {
    context.save();
    context.translate(handle.point.x, handle.point.y);
    context.rotate(annotation.rotation);
    if (handle.handle === 'rotate') {
      drawRotateHandle(context);
    } else {
      drawResizeHandle(context);
    }
    context.restore();
  }
}

function drawResizeHandle(context: CanvasRenderingContext2D): void {
  context.fillStyle = '#0a84ff';
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  context.fillRect(-handleSize / 2, -handleSize / 2, handleSize, handleSize);
  context.strokeRect(-handleSize / 2, -handleSize / 2, handleSize, handleSize);
}

function drawRotateHandle(context: CanvasRenderingContext2D): void {
  const radius = rotateHandleSize / 2;

  context.fillStyle = '#ffffff';
  context.strokeStyle = '#ff9500';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.save();
  context.strokeStyle = '#ff9500';
  context.lineWidth = 2.5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.scale(0.78, 0.78);
  context.translate(-12, -12);
  context.stroke(new Path2D('M21 2v6h-6'));
  context.stroke(new Path2D('M3 12a9 9 0 0 1 15-6.7L21 8'));
  context.stroke(new Path2D('M3 22v-6h6'));
  context.stroke(new Path2D('M21 12a9 9 0 0 1-15 6.7L3 16'));
  context.restore();
}

function selectionHandles(
  annotation: Annotation,
  context: CanvasRenderingContext2D | null,
): Array<{ handle: SelectionHandle; point: Point }> {
  const center = annotationCenter(annotation, context);
  const box = annotationBox(annotation, context);
  const localHandles: Array<{ handle: SelectionHandle; point: Point }> =
    annotation.tool === 'arrow'
      ? [
          { handle: 'start', point: annotation.start },
          { handle: 'end', point: annotation.end },
        ]
      : [
          { handle: 'nw', point: { x: box.x, y: box.y } },
          { handle: 'ne', point: { x: box.x + box.width, y: box.y } },
          { handle: 'sw', point: { x: box.x, y: box.y + box.height } },
          { handle: 'se', point: { x: box.x + box.width, y: box.y + box.height } },
        ];

  localHandles.push({ handle: 'rotate', point: { x: box.x + box.width / 2, y: box.y - 36 } });

  return localHandles.map((handle) => ({
    ...handle,
    point: rotatePoint(handle.point, center, annotation.rotation),
  }));
}

function hitTestHandle(
  context: CanvasRenderingContext2D,
  annotations: Annotation[],
  selectedId: string,
  point: Point,
  scale: number,
): SelectionHandle | null {
  const selected = annotations.find((annotation) => annotation.id === selectedId);

  if (!selected) {
    return null;
  }

  for (const handle of selectionHandles(selected, context)) {
    const tolerance =
      handle.handle === 'rotate'
        ? Math.max(rotateHandleSize / scale / 2, 10)
        : Math.max(handleSize / scale, 6);

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

    const localPoint = rotatePoint(
      point,
      annotationCenter(annotation, context),
      -annotation.rotation,
    );

    if (annotation.tool === 'arrow') {
      if (
        distanceToSegment(localPoint, annotation.start, annotation.end) <=
        tolerance + annotation.strokeWidth / 2
      ) {
        return annotation;
      }
      continue;
    }

    if (annotation.tool === 'pen') {
      for (let index = 1; index < annotation.points.length; index += 1) {
        if (
          distanceToSegment(localPoint, annotation.points[index - 1], annotation.points[index]) <=
          tolerance + annotation.strokeWidth / 2
        ) {
          return annotation;
        }
      }
      continue;
    }

    const box = annotationBox(annotation, context);
    if (
      localPoint.x >= box.x - tolerance &&
      localPoint.x <= box.x + box.width + tolerance &&
      localPoint.y >= box.y - tolerance &&
      localPoint.y <= box.y + box.height + tolerance
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
  return new DOMRect(
    x,
    y,
    Math.abs(annotation.end.x - annotation.start.x),
    Math.abs(annotation.end.y - annotation.start.y),
  );
}

function annotationCenter(annotation: Annotation, context: CanvasRenderingContext2D | null): Point {
  const box = annotationBox(annotation, context);

  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function rotateContext(context: CanvasRenderingContext2D, annotation: Annotation): void {
  if (annotation.rotation === 0) {
    return;
  }

  const center = annotationCenter(annotation, context);
  context.translate(center.x, center.y);
  context.rotate(annotation.rotation);
  context.translate(-center.x, -center.y);
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
  const localPoint = rotatePoint(point, annotationCenter(annotation, null), -annotation.rotation);

  if (annotation.tool === 'arrow') {
    if (handle === 'start') {
      return { ...annotation, start: localPoint };
    }
    return { ...annotation, end: localPoint };
  }

  const box = annotationBox(annotation, null);
  const nextBox = resizeBox(box, handle as BoxHandle, localPoint);

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

function rotateAnnotation(annotation: Annotation, point: Point): Annotation {
  const center = annotationCenter(annotation, null);
  const angle = Math.atan2(point.y - center.y, point.x - center.x) + Math.PI / 2;

  return { ...annotation, rotation: angle };
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

  return new DOMRect(
    x,
    y,
    Math.max(1, Math.abs(point.x - opposite.x)),
    Math.max(1, Math.abs(point.y - opposite.y)),
  );
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

function rotatePoint(point: Point, center: Point, rotation: number): Point {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const x = point.x - center.x;
  const y = point.y - center.y;

  return {
    x: center.x + x * cos - y * sin,
    y: center.y + x * sin + y * cos,
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

export function ToolIcon({ tool }: { tool: AnnotationTool }) {
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
