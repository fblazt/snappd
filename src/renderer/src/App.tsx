import { appInfo } from '../../shared/app-info';
import './styles.css';

export function App() {
  const bridgedName = window.snappd.getAppName();

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Phase 0 bootstrap</p>
        <h1>{bridgedName}</h1>
        <p>{appInfo.name} is ready for the secure app shell, shortcut, and capture phases.</p>
      </section>
    </main>
  );
}
