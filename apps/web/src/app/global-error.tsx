'use client';

import * as React from 'react';

/**
 * Last-resort error boundary for failures in the root layout itself (fonts,
 * providers, etc.) — the one place `error.tsx` cannot help, since a broken
 * root layout means there is no shell left to render error.tsx inside of.
 *
 * Deliberately minimal and inline-styled: it must not depend on globals.css,
 * the theme provider, or any other part of the app that might be what broke.
 * Must render its own <html>/<body> — Next.js replaces the whole document
 * with this component when triggered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Root layout error boundary caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          backgroundColor: '#0f172a',
          color: '#f1f5f9',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 20 }}>
            The application failed to load. Try reloading the page.
          </p>
          <button
            onClick={() => reset()}
            style={{
              backgroundColor: '#4f46e5',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
