import { Component } from 'react';
import { RefreshCw, Home } from 'lucide-react';

/** Catches unexpected render errors and shows a friendly recovery screen (no stack traces). */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('UI error:', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    // A failed lazy chunk after a deploy is best fixed by a reload.
    const chunkError = /Loading chunk|dynamically imported module|Failed to fetch/i.test(String(this.state.error?.message));
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-8 grid h-24 w-24 place-items-center rounded-[2rem] bg-brand-soft">
            <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
              <path d="M16 10h16l-2.2 28.4a3 3 0 0 1-3 2.6h-5.6a3 3 0 0 1-3-2.6Z" fill="#B9A8E8" />
              <rect x="14" y="6" width="20" height="5" rx="2.5" fill="#6D5BD0" />
              <path d="M20 24c2-2 6-2 8 0" stroke="#17161C" strokeWidth="2" fill="none" strokeLinecap="round" transform="rotate(180 24 25)" />
            </svg>
          </div>
          <p className="eyebrow">Unexpected error</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Well, that spilled.</h1>
          <p className="mt-3 text-muted">
            {chunkError ? 'A newer version of the store is available. Reload to continue.' : 'Something went wrong while displaying this page. Your cart and account are safe.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => (chunkError ? window.location.reload() : this.reset())}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" /> {chunkError ? 'Reload' : 'Try again'}
            </button>
            <a href="/" className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong px-6 text-sm font-semibold">
              <Home className="h-4 w-4" /> Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
