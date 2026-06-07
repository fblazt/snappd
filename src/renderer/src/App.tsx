import { useCallback, useEffect, useState } from 'react';
import { appInfo } from '../../shared/app-info';
import type { CaptureFoundationResponse, SettingsResponse } from '../../shared/ipc';
import type { AppSettings } from '../../shared/settings';
import './styles.css';

export function App() {
  const [appName, setAppName] = useState<string>(appInfo.name);
  const [settingsResponse, setSettingsResponse] = useState<SettingsResponse | null>(null);
  const [draftSettings, setDraftSettings] = useState<AppSettings | null>(null);
  const [captureFoundation, setCaptureFoundation] = useState<CaptureFoundationResponse | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const refreshCaptureFoundation = useCallback(() => {
    void window.snappd.getCaptureFoundation().then(setCaptureFoundation);
  }, []);

  const loadSettings = useCallback(() => {
    void window.snappd.getSettings().then((response) => {
      setSettingsResponse(response);
      setDraftSettings(response.settings);
    });
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
    loadSettings();
    refreshCaptureFoundation();
  }, [loadSettings, refreshCaptureFoundation]);

  const saveSettings = useCallback(
    (nextSettings = draftSettings) => {
      if (!nextSettings) {
        return;
      }

      setSaveStatus('Saving…');
      void window.snappd.updateSettings(nextSettings).then((response) => {
        setSettingsResponse(response);
        setDraftSettings(response.settings);
        setSaveStatus(response.message ?? 'Saved');
      });
    },
    [draftSettings],
  );

  const selectSaveFolder = () => {
    void window.snappd.selectSaveFolder().then((response) => {
      if (!response.filePath || !draftSettings) {
        return;
      }

      const nextSettings = { ...draftSettings, saveFolder: response.filePath };
      setDraftSettings(nextSettings);
      saveSettings(nextSettings);
    });
  };

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
          <button type="button" className="sidebar-item">
            Capture
          </button>
          <button type="button" className="sidebar-item">
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
        {settingsResponse?.message ? (
          <p className="error-message">{settingsResponse.message}</p>
        ) : null}
        {saveStatus ? <p className="status-message">{saveStatus}</p> : null}

        <section className="settings-group" aria-labelledby="general-heading">
          <h2 id="general-heading">General</h2>
          {draftSettings && settingsResponse ? (
            <div className="settings-card">
              <label className="settings-row">
                <span>Launch at login</span>
                <input
                  type="checkbox"
                  checked={draftSettings.launchAtLogin}
                  onChange={(event) => {
                    const nextSettings = {
                      ...draftSettings,
                      launchAtLogin: event.currentTarget.checked,
                    };
                    setDraftSettings(nextSettings);
                    saveSettings(nextSettings);
                  }}
                />
              </label>
              <label className="settings-row">
                <span>Show Dock icon</span>
                <input
                  type="checkbox"
                  checked={draftSettings.showDockIcon}
                  onChange={(event) => {
                    const nextSettings = {
                      ...draftSettings,
                      showDockIcon: event.currentTarget.checked,
                    };
                    setDraftSettings(nextSettings);
                    saveSettings(nextSettings);
                  }}
                />
              </label>
              <div className="settings-row stacked">
                <span>Settings file</span>
                <code>{settingsResponse.settingsPath}</code>
              </div>
            </div>
          ) : (
            <div className="settings-card placeholder">Loading settings…</div>
          )}
        </section>

        <section className="settings-group" aria-labelledby="capture-heading">
          <h2 id="capture-heading">Capture</h2>
          {draftSettings ? (
            <div className="settings-card">
              <label className="settings-row">
                <span>Post-capture preview</span>
                <input
                  type="checkbox"
                  checked={draftSettings.showPostCapturePreview}
                  onChange={(event) => {
                    const nextSettings = {
                      ...draftSettings,
                      showPostCapturePreview: event.currentTarget.checked,
                    };
                    setDraftSettings(nextSettings);
                    saveSettings(nextSettings);
                  }}
                />
              </label>
              <label className="settings-row">
                <span>Copy captures automatically</span>
                <input
                  type="checkbox"
                  checked={draftSettings.automaticClipboardCopy}
                  onChange={(event) => {
                    const nextSettings = {
                      ...draftSettings,
                      automaticClipboardCopy: event.currentTarget.checked,
                    };
                    setDraftSettings(nextSettings);
                    saveSettings(nextSettings);
                  }}
                />
              </label>
              <div className="settings-row stacked">
                <span>Save folder</span>
                <div className="path-control">
                  <code>{draftSettings.saveFolder}</code>
                  <button type="button" onClick={selectSaveFolder}>
                    Choose…
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="settings-card placeholder">Loading capture settings…</div>
          )}
        </section>

        <section className="settings-group" aria-labelledby="shortcuts-heading">
          <h2 id="shortcuts-heading">Shortcuts</h2>
          {draftSettings && settingsResponse ? (
            <div className="settings-card">
              <label className="settings-row stacked">
                <span>Region shortcut</span>
                <div className="shortcut-control">
                  <div className="path-control">
                    <input
                      className="text-input"
                      type="text"
                      value={draftSettings.regionShortcut}
                      onChange={(event) => {
                        setDraftSettings({
                          ...draftSettings,
                          regionShortcut: event.currentTarget.value,
                        });
                      }}
                      placeholder="Command+Shift+9"
                      onFocus={() => {
                        setSaveStatus('Type an Electron accelerator, for example Command+Shift+9.');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.currentTarget.blur();
                          return;
                        }

                        if (event.key === 'Enter') {
                          saveSettings({
                            ...draftSettings,
                            regionShortcut: event.currentTarget.value,
                          });
                          event.currentTarget.blur();
                        }
                      }}
                    />
                    <button type="button" onClick={() => saveSettings()}>
                      Save
                    </button>
                  </div>
                  <div className="shortcut-presets">
                    {['Command+Shift+9', 'Command+Shift+2', 'Command+Option+2'].map((shortcut) => (
                      <button
                        type="button"
                        key={shortcut}
                        onClick={() => {
                          const nextSettings = { ...draftSettings, regionShortcut: shortcut };
                          setDraftSettings(nextSettings);
                          saveSettings(nextSettings);
                        }}
                      >
                        {shortcut}
                      </button>
                    ))}
                  </div>
                </div>
              </label>
              <div className="settings-row">
                <span>Shortcut status</span>
                <strong>{settingsResponse.shortcutStatus.region}</strong>
              </div>
            </div>
          ) : (
            <div className="settings-card placeholder">Loading shortcuts…</div>
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
