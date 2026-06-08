import { useCallback, useEffect, useReducer } from 'react';
import { appInfo } from '../../shared/app-info';
import type { CaptureFoundationResponse, SettingsResponse } from '../../shared/ipc';
import type { AppSettings } from '../../shared/settings';
import './styles.css';

interface AppState {
  appName: string;
  settingsResponse: SettingsResponse | null;
  draftSettings: AppSettings | null;
  captureFoundation: CaptureFoundationResponse | null;
  loadError: string | null;
  saveStatus: string;
}

const initialAppState: AppState = {
  appName: appInfo.name,
  settingsResponse: null,
  draftSettings: null,
  captureFoundation: null,
  loadError: null,
  saveStatus: '',
};

export function App() {
  const [state, setState] = useReducer(
    (current: AppState, next: Partial<AppState>) => ({ ...current, ...next }),
    initialAppState,
  );
  const { appName, settingsResponse, draftSettings, captureFoundation, loadError, saveStatus } =
    state;

  const refreshCaptureFoundation = useCallback(() => {
    void window.snappd
      .getCaptureFoundation()
      .then((captureFoundation) => setState({ captureFoundation }));
  }, []);

  const loadSettings = useCallback(() => {
    void window.snappd.getSettings().then((response) => {
      setState({ settingsResponse: response, draftSettings: response.settings });
    });
  }, []);

  useEffect(() => {
    void window.snappd
      .getAppInfo()
      .then((info) => setState({ appName: info.name }))
      .catch((error: unknown) => {
        setState({
          loadError: error instanceof Error ? error.message : 'Could not load app info.',
        });
      });
    loadSettings();
    refreshCaptureFoundation();
  }, [loadSettings, refreshCaptureFoundation]);

  const saveSettings = useCallback(
    (nextSettings = draftSettings) => {
      if (!nextSettings) {
        return;
      }

      setState({ saveStatus: 'Saving…' });
      void window.snappd.updateSettings(nextSettings).then((response) => {
        setState({
          settingsResponse: response,
          draftSettings: response.settings,
          saveStatus: response.message ?? 'Saved',
        });
      });
    },
    [draftSettings],
  );

  const updateDraftSettings = (draftSettings: AppSettings) => setState({ draftSettings });
  const setSaveStatus = (saveStatus: string) => setState({ saveStatus });

  const selectSaveFolder = () => {
    void window.snappd.selectSaveFolder().then((response) => {
      if (!response.filePath || !draftSettings) {
        return;
      }

      const nextSettings = { ...draftSettings, saveFolder: response.filePath };
      updateDraftSettings(nextSettings);
      saveSettings(nextSettings);
    });
  };

  return (
    <main className="preferences-window">
      <PreferencesSidebar />
      <section className="preferences-content">
        <PreferencesHeader appName={appName} />
        <StatusMessages
          loadError={loadError}
          settingsMessage={settingsResponse?.message}
          saveStatus={saveStatus}
        />
        <GeneralSettings
          draftSettings={draftSettings}
          settingsResponse={settingsResponse}
          updateDraftSettings={updateDraftSettings}
          saveSettings={saveSettings}
        />
        <CaptureSettings
          draftSettings={draftSettings}
          updateDraftSettings={updateDraftSettings}
          saveSettings={saveSettings}
          selectSaveFolder={selectSaveFolder}
        />
        <ShortcutSettings
          draftSettings={draftSettings}
          settingsResponse={settingsResponse}
          updateDraftSettings={updateDraftSettings}
          saveSettings={saveSettings}
          setSaveStatus={setSaveStatus}
        />
        <ScreenRecordingSettings
          captureFoundation={captureFoundation}
          refreshCaptureFoundation={refreshCaptureFoundation}
        />
      </section>
    </main>
  );
}

function PreferencesSidebar() {
  return (
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
  );
}

function PreferencesHeader({ appName }: { appName: string }) {
  return (
    <header className="preferences-header">
      <h1>{appName}</h1>
      <p>{appInfo.name} is running as a local menu bar screenshot utility.</p>
    </header>
  );
}

function StatusMessages({
  loadError,
  settingsMessage,
  saveStatus,
}: {
  loadError: string | null;
  settingsMessage: string | undefined;
  saveStatus: string;
}) {
  return (
    <>
      {loadError ? <p className="error-message">{loadError}</p> : null}
      {settingsMessage ? <p className="error-message">{settingsMessage}</p> : null}
      {saveStatus ? <p className="status-message">{saveStatus}</p> : null}
    </>
  );
}

function GeneralSettings({
  draftSettings,
  settingsResponse,
  updateDraftSettings,
  saveSettings,
}: SettingsSectionProps & { settingsResponse: SettingsResponse | null }) {
  return (
    <section className="settings-group" aria-labelledby="general-heading">
      <h2 id="general-heading">General</h2>
      {draftSettings && settingsResponse ? (
        <div className="settings-card">
          <SettingsCheckbox
            label="Launch at login"
            checked={draftSettings.launchAtLogin}
            onChange={(launchAtLogin) => {
              const nextSettings = { ...draftSettings, launchAtLogin };
              updateDraftSettings(nextSettings);
              saveSettings(nextSettings);
            }}
          />
          <SettingsCheckbox
            label="Show Dock icon"
            checked={draftSettings.showDockIcon}
            onChange={(showDockIcon) => {
              const nextSettings = { ...draftSettings, showDockIcon };
              updateDraftSettings(nextSettings);
              saveSettings(nextSettings);
            }}
          />
          <div className="settings-row stacked">
            <span>Settings file</span>
            <code>{settingsResponse.settingsPath}</code>
          </div>
        </div>
      ) : (
        <div className="settings-card placeholder">Loading settings…</div>
      )}
    </section>
  );
}

function CaptureSettings({
  draftSettings,
  updateDraftSettings,
  saveSettings,
  selectSaveFolder,
}: SettingsSectionProps & { selectSaveFolder: () => void }) {
  return (
    <section className="settings-group" aria-labelledby="capture-heading">
      <h2 id="capture-heading">Capture</h2>
      {draftSettings ? (
        <div className="settings-card">
          <SettingsCheckbox
            label="Post-capture preview"
            checked={draftSettings.showPostCapturePreview}
            onChange={(showPostCapturePreview) => {
              const nextSettings = { ...draftSettings, showPostCapturePreview };
              updateDraftSettings(nextSettings);
              saveSettings(nextSettings);
            }}
          />
          <SettingsCheckbox
            label="Copy captures automatically"
            checked={draftSettings.automaticClipboardCopy}
            onChange={(automaticClipboardCopy) => {
              const nextSettings = { ...draftSettings, automaticClipboardCopy };
              updateDraftSettings(nextSettings);
              saveSettings(nextSettings);
            }}
          />
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
  );
}

function ShortcutSettings({
  draftSettings,
  settingsResponse,
  updateDraftSettings,
  saveSettings,
  setSaveStatus,
}: SettingsSectionProps & {
  settingsResponse: SettingsResponse | null;
  setSaveStatus: (saveStatus: string) => void;
}) {
  return (
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
                    updateDraftSettings({
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
                      saveSettings({ ...draftSettings, regionShortcut: event.currentTarget.value });
                      event.currentTarget.blur();
                    }
                  }}
                />
                <button type="button" onClick={() => saveSettings()}>
                  Save
                </button>
              </div>
              <ShortcutPresets
                draftSettings={draftSettings}
                updateDraftSettings={updateDraftSettings}
                saveSettings={saveSettings}
              />
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
  );
}

function ShortcutPresets({
  draftSettings,
  updateDraftSettings,
  saveSettings,
}: SettingsSectionProps & { draftSettings: AppSettings }) {
  return (
    <div className="shortcut-presets">
      {['Command+Shift+9', 'Command+Shift+2', 'Command+Option+2'].map((shortcut) => (
        <button
          type="button"
          key={shortcut}
          onClick={() => {
            const nextSettings = { ...draftSettings, regionShortcut: shortcut };
            updateDraftSettings(nextSettings);
            saveSettings(nextSettings);
          }}
        >
          {shortcut}
        </button>
      ))}
    </div>
  );
}

function ScreenRecordingSettings({
  captureFoundation,
  refreshCaptureFoundation,
}: {
  captureFoundation: CaptureFoundationResponse | null;
  refreshCaptureFoundation: () => void;
}) {
  const shouldShowRecovery = captureFoundation
    ? captureFoundation.foundation.permission.canRequestRecovery ||
      captureFoundation.foundation.permission.status !== 'granted' ||
      captureFoundation.foundation.sources.length === 0
    : false;

  return (
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
  );
}

function SettingsCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
    </label>
  );
}

interface SettingsSectionProps {
  draftSettings: AppSettings | null;
  updateDraftSettings: (draftSettings: AppSettings) => void;
  saveSettings: (nextSettings?: AppSettings | null) => void;
}
