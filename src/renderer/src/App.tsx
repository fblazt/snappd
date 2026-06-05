import { useEffect, useState } from 'react';
import { appInfo } from '../../shared/app-info';
import './styles.css';

export function App() {
  const [appName, setAppName] = useState<string>(appInfo.name);

  useEffect(() => {
    void window.snappd.getAppInfo().then((info) => {
      setAppName(info.name);
    });
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Preferences shell</p>
        <h1>{appName}</h1>
        <p>{appInfo.name} is running as a secure menu bar utility.</p>
      </section>
    </main>
  );
}
