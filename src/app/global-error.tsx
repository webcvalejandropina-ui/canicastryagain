"use client";

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactNode {
  useEffect(() => {
    // Log to console for debugging; real monitoring would go to a service
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-background-dark font-display text-brown antialiased dark:bg-dark-bg dark:text-dark-text">
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse 600px 400px at 50% 30%, rgba(74,144,226,0.12) 0%, transparent 70%)'
              }}
            />
          </div>

          <div className="relative text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-danger/10 dark:bg-danger/20">
              <span className="text-5xl" role="img" aria-label="alerta">
                ⚠️
              </span>
            </div>

            <h1 className="text-3xl font-black uppercase tracking-tight text-[#4a3f32] dark:text-dark-text sm:text-4xl">
              Algo salió mal
            </h1>

            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#6b5d4f] dark:text-dark-muted sm:text-base">
              Ha ocurrido un error inesperado. Puedes intentar reiniciar la aplicación o volver al lobby.
              {error.digest && (
                <span className="mt-2 block font-mono text-xs opacity-60">
                  #{error.digest}
                </span>
              )}
            </p>

            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-[#4a3f32] shadow-lg shadow-primary/25 transition-all hover:bg-primary-light hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97] dark:shadow-primary/15"
              >
                <span>🔄</span>
                <span>Reintentar</span>
              </button>

              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-[#e8e0d5] px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-[#4a3f32] shadow-lg transition-all hover:bg-[#ddd5c8] active:scale-[0.97] dark:bg-dark-surface dark:text-dark-text dark:hover:bg-dark-surface-soft"
              >
                <span>🏠</span>
                <span>Volver al lobby</span>
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
