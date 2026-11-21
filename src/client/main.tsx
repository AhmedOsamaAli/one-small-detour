import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/fraunces/full.css';
import './styles.css';
import './art.css';
import './craft.css';
import './home.css';
import App from './App.tsx';
import { trackViewport } from './viewport.ts';

const stopViewport = trackViewport();
import.meta.hot?.dispose(stopViewport);

class GameBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error): { error: Error } { return { error }; }
  override componentDidCatch(error: Error, info: ErrorInfo): void { console.error('Detour could not render:', error, info); }
  override render(): ReactNode {
    return this.state.error ? <main className="loading-place">
      <p className="eyebrow">THE ISLAND NEEDS A MOMENT</p><h1>Something got tangled.</h1>
      <p role="alert">{this.state.error.message}</p><button className="primary-button" onClick={() => window.location.reload()}>Reload the island</button>
    </main> : this.props.children;
  }
}

const root = document.getElementById('root');
if (!root) throw new Error('The game root is missing.');
createRoot(root).render(<GameBoundary><App/></GameBoundary>);
