import { useCallback, useEffect, useState } from 'react';
import { appInfo } from '../../shared/app-info';
import type { CaptureFoundationResponse, SettingsResponse } from '../../shared/ipc';
import './styles.css';

export function App() {
  const [appName, setAppName] = useState<string>(appInfo.name);
  const [settingsResponse, setSettingsResponse] = useState<SettingsResponse | null>(null);
  const [captureFoundation, setCaptureFoundation] = useState<CaptureFoundationResponse | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshCaptureFoundation = useCallback(() => {
    void window.snappd.getCaptureFoundation().then(setCaptureFoundation);
  }, []);

  useEffect(() => {
    void window.snappd
      .getAppInfo()
      .then((info) => {
        setAppName(info.name);
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Could not load app info.');
      });
    void window.snappd.getSettings().then(setSettingsResponse);
    refreshCaptureFoundation();
  }, [refreshCaptureFoundation]);

  const shouldShowRecovery = captureFoundation
    ? captureFoundation.foundation.permission.canRequestRecovery ||
      captureFoundation.foundation.permission.status !== 'granted' ||
      captureFoundation.foundation.sources.length === 0
    : false;

  return (
    <main className="preferences-window">
      <aside className="preferences-sidebar" aria-label="Preferences sections">
        <div className="app-badge" aria-hidden="true">
          S
        </div>
        <nav>
          <button type="button" className="sidebar-item active">
            General
          </button>
          <button type="button" className="sidebar-item" disabled>
            Capture
          </button>
          <button type="button" className="sidebar-item" disabled>
            Shortcuts
          </button>
        </nav>
      </aside>

      <section className="preferences-content">
        <header className="preferences-header">
          <h1>{appName}</h1>
          <p>{appInfo.name} is running as a local menu bar screenshot utility.</p>
        </header>

        {loadError ? <p className="error-message">{loadError}</p> : null}

        <section className="settings-group" aria-labelledby="general-heading">
          <h2 id="general-heading">General</h2>
          {settingsResponse ? (
            <div className="settings-card">
              <div className="settings-row">
                <span>Region shortcut</span>
                <code>{settingsResponse.settings.regionShortcut}</code>
              </div>
              <div className="settings-row">
                <span>Shortcut status</span>
                <strong>{settingsResponse.shortcutStatus.region}</strong>
              </div>
              <div className="settings-row stacked">
                <span>Settings file</span>
                <code>{settingsResponse.settingsPath}</code>
              </div>
            </div>
          ) : (
            <div className="settings-card placeholder">Loading settings…</div>
          )}
        </section>

        <section className="settings-group" aria-labelledby="permission-heading">
          <h2 id="permission-heading">Screen Recording</h2>
          {captureFoundation ? (
            <div className="settings-card">
              <div className="settings-row stacked">
                <span>Permission</span>
                <p>{captureFoundation.foundation.permission.message}</p>
              </div>
              <div className="settings-row">
                <span>Status</span>
                <strong>{captureFoundation.foundation.permission.status}</strong>
              </div>
              <div className="settings-row">
                <span>Capture sources</span>
                <strong>{captureFoundation.foundation.sources.length}</strong>
              </div>
              <div className="settings-row">
                <span>Displays</span>
                <strong>{captureFoundation.foundation.displays.length}</strong>
              </div>
              {shouldShowRecovery ? (
                <div className="settings-row stacked">
                  <span>Recovery</span>
                  <div className="button-group">
                    <button
                      type="button"
                      onClick={() => void window.snappd.openScreenRecordingSettings()}
                    >
                      Open System Settings
                    </button>
                    <button type="button" onClick={refreshCaptureFoundation}>
                      Check Again
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="settings-card placeholder">Checking capture permission…</div>
          )}
        </section>
      </section>
    </main>
  );
}
