import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { CaptureResult } from '../../shared/capture';
import './preview.css';

function Preview() {
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    void window.snappd.getPreviewCapture().then((response) => {
      setCapture(response.capture);
    });
  }, []);

  return (
    <main className="preview-window">
      {capture ? (
        <>
          <section className="image-panel">
            <img src={capture.image.dataUrl} alt="Captured screenshot preview" />
          </section>
          <footer className="toolbar">
            <div>
              <strong>
                {capture.width} × {capture.height}
              </strong>
              {status ? <span>{status}</span> : null}
            </div>
            <div className="actions">
              <button type="button" disabled title="Annotation tools arrive in a later phase.">
                Annotate
              </button>
              <button
                type="button"
                onClick={() => {
                  void window.snappd.copyPreviewCapture().then(() => setStatus('Copied again'));
                }}
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => {
                  void window.snappd.savePreviewCapture().then((response) => {
                    setStatus(
                      response.status === 'saved'
                        ? `Saved to ${response.filePath}`
                        : response.message,
                    );
                  });
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

const root = document.getElementById('preview-root');

if (!root) {
  throw new Error('Preview root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
