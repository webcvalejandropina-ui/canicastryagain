'use client';

import Image from 'next/image';
import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {removeLegacyServiceWorkers} from '@/app/legacy-sw-cleanup';
import './pwa.css';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: string}>;
};
const Context = createContext({installed: false, offlineReady: false, install: () => {}});

export function PwaProvider({children}: {children: ReactNode}): React.ReactElement {
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const prompt = useRef<InstallPrompt | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)');
    setInstalled(mode.matches || Boolean((navigator as Navigator & {standalone?: boolean}).standalone));
    const before = (event: Event) => {event.preventDefault(); prompt.current = event as InstallPrompt;};
    const complete = () => {setInstalled(true); setHelp(false); prompt.current = null;};
    const prepared = (event: MessageEvent) => {
      if (event.data?.type === 'PRACTICE_READY') setOfflineReady(true);
    };
    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', complete);
    navigator.serviceWorker?.addEventListener('message', prepared);

    if ('serviceWorker' in navigator) void (async () => {
      await removeLegacyServiceWorkers();
      if (process.env.NODE_ENV !== 'production') {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter(registration => {
          const worker = registration.active || registration.waiting || registration.installing;
          return worker && new URL(worker.scriptURL).pathname === '/sw.js';
        }).map(registration => registration.unregister()));
        return;
      }
      if (!window.isSecureContext) return;
      // The installed copy can report readiness even when a subsequent update is offline.
      const existing = await navigator.serviceWorker.getRegistration('/');
      existing?.active?.postMessage({type: 'REFRESH_PRACTICE'});
      await navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'});
      const ready = await navigator.serviceWorker.ready;
      if (navigator.onLine) ready.active?.postMessage({type: 'REFRESH_PRACTICE'});
    })().catch(() => {/* Online play remains available if installation/storage is blocked. */});

    return () => {
      window.removeEventListener('beforeinstallprompt', before);
      window.removeEventListener('appinstalled', complete);
      navigator.serviceWorker?.removeEventListener('message', prepared);
    };
  }, []);

  useEffect(() => {
    if (help) dialog.current?.showModal();
    else dialog.current?.close();
  }, [help]);

  const install = () => {
    const deferred = prompt.current;
    if (!deferred) {setHelp(true); return;}
    prompt.current = null;
    void deferred.prompt().then(() => deferred.userChoice).catch(() => setHelp(true));
  };

  return <Context.Provider value={{installed, offlineReady, install}}>
    {children}
    <dialog className="pwa-install-dialog" ref={dialog} onCancel={() => setHelp(false)} aria-labelledby="pwa-title">
      <Image src="/icons/icon-192.png" alt="" width={64} height={64} unoptimized/>
      <h2 id="pwa-title">Canicas, a mano.</h2>
      <p>Instálalo desde el menú de tu navegador para abrirlo como una app.</p>
      <p><strong>iPhone o iPad:</strong> abre Compartir y elige «Añadir a pantalla de inicio».</p>
      <p><strong>Android y ordenador:</strong> busca «Instalar aplicación» o «Añadir a pantalla de inicio» en el menú.</p>
      <p role="status">{offlineReady ? 'Práctica preparada para jugar sin conexión.' : 'La práctica se prepara durante la primera carga con internet.'}</p>
      <small>Las partidas con amigos necesitan internet. La instalación requiere HTTPS o localhost.</small>
      <button type="button" onClick={() => setHelp(false)}>Entendido</button>
    </dialog>
  </Context.Provider>;
}

export const usePwa = () => useContext(Context);

export function InstallAppButton(): React.ReactElement | null {
  const {installed, offlineReady, install} = usePwa();
  if (installed) return null;
  return <button className="pwa-install-button" type="button" onClick={install}
    aria-label="Instalar Canicas como app" title={offlineReady ? 'Práctica disponible sin conexión' : 'Instalar Canicas'}>
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>
    </svg>
    <span>Instalar app</span>
  </button>;
}
