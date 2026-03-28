'use client';

import { useEffect } from 'react';

const LEGACY_CACHE_PREFIXES = ['juego-bolitas', 'canicas-try-again', 'workbox'];

function isLocalNetworkHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;
  if (/\.local$/i.test(hostname)) return true;
  return false;
}

export function LegacyServiceWorkerCleanup(): React.ReactElement | null {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (!isLocalNetworkHost(window.location.hostname)) return;

    const clearLegacyRegistrations = async (): Promise<void> => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch {
        // Si el navegador bloquea SW, continuamos sin romper la app.
      }

      if (!('caches' in window)) return;

      try {
        const cacheKeys = await caches.keys();
        const legacyKeys = cacheKeys.filter((key) => LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)));
        await Promise.all(legacyKeys.map((key) => caches.delete(key)));
      } catch {
        // Ignorar errores de caché en modo dev.
      }
    };

    void clearLegacyRegistrations();
  }, []);

  return null;
}
