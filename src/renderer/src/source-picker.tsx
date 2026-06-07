import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { SourcePickerItem } from '../../shared/ipc';
import './source-picker.css';

function SourcePicker() {
  const [sources, setSources] = useState<SourcePickerItem[]>([]);

  useEffect(() => {
    void window.snappd.getSourcePickerSources().then((response) => setSources(response.sources));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void window.snappd.cancelSourcePicker();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <main className="source-picker-window">
      <header>
        <h1>Choose a window</h1>
        <p>Select a visible window to capture. Press Esc to cancel.</p>
      </header>

      {sources.length > 0 ? (
        <div className="source-grid">
          {sources.map((source) => (
            <button
              className="source-card"
              type="button"
              key={source.id}
              onClick={() => void window.snappd.selectSourcePickerSource(source.id)}
            >
              <img src={source.thumbnailDataUrl} alt="" />
              <span>{source.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="empty-state">No capturable windows found.</p>
      )}
    </main>
  );
}

const root = document.getElementById('source-picker-root');

if (!root) {
  throw new Error('Source picker root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <SourcePicker />
  </StrictMode>,
);
