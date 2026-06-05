import { useEffect, useState } from 'react';
import { appInfo } from '../../shared/app-info';
import type { SettingsResponse } from '../../shared/ipc';
import './styles.css';

export function App() {
  const [appName, setAppName] = useState<string>(appInfo.name);
  const [settingsResponse, setSettingsResponse] = useState<SettingsResponse | null>(null);

  useEffect(() => {
    void window.snappd.getAppInfo().then((info) => {
      setAppName(info.name);
    });
    void window.snappd.getSettings().then(setSettingsResponse);
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Preferences shell</p>
        <h1>{appName}</h1>
        <p>{appInfo.name} is running as a secure menu bar utility.</p>
        {settingsResponse ? (
          <dl className="settings-list">
            <div>
              <dt>Region shortcut</dt>
              <dd>{settingsResponse.settings.regionShortcut}</dd>
            </div>
            <div>
              <dt>Shortcut status</dt>
              <dd>{settingsResponse.shortcutStatus.region}</dd>
            </div>
            <div>
              <dt>Settings path</dt>
              <dd>{settingsResponse.settingsPath}</dd>
            </div>
          </dl>
        ) : null}
      </section>
    </main>
  );
}
