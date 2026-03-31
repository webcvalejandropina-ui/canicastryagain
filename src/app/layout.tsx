import type { Metadata, Viewport } from 'next';
import { Space_Grotesk } from 'next/font/google';

import './globals.css';
import { LegacyServiceWorkerCleanup } from './legacy-sw-cleanup';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  preload: true
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f0e8' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0c09' }
  ]
};

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

const metadataBase = siteUrl ? new URL(siteUrl) : undefined;

const viralDescription =
  'Desafía a un amigo a un misère de canicas: partidas en vivo en el navegador, gratis y con buen rollo. Sin instalar nada.';

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: {
    default: 'Canicas Try Again — Partida amistosa online',
    template: '%s · Canicas Try Again'
  },
  description: viralDescription,
  keywords: [
    'juego online',
    'canicas',
    'misère',
    'multijugador',
    'gratis',
    'amigos',
    'navegador',
    'desafío',
    'buen rollo'
  ],
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    siteName: 'Canicas Try Again',
    title: 'Canicas Try Again 🍍 — Reto entre amigos',
    description: viralDescription
  },
  twitter: {
    card: 'summary',
    title: 'Canicas Try Again 🍍',
    description: viralDescription
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Canicas'
  },
  formatDetection: {
    telephone: false
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('__canicas_theme__');var mql=window.matchMedia('(prefers-color-scheme: dark)');var dark=s==='dark'||(s===null&&mql.matches);if(dark)document.documentElement.classList.add('dark');}catch(_e){}})();(function(){try{if(typeof window==='undefined')return;var host=window.location.hostname;var isLocalNet=host==='localhost'||host==='127.0.0.1'||host==='::1'||/^10\\./.test(host)||/^192\\.168\\./.test(host)||/^172\\.(1[6-9]|2[0-9]|3[0-1])\\./.test(host)||/\\.local$/i.test(host);if(!isLocalNet)return;if(sessionStorage.getItem('__canicas_sw_cleanup__')==='1')return;sessionStorage.setItem('__canicas_sw_cleanup__','1');if(!('serviceWorker' in navigator))return;var clearRegistrations=navigator.serviceWorker.getRegistrations().then(function(registrations){return Promise.all(registrations.map(function(reg){return reg.unregister();})).then(function(){return registrations.length;});});var clearCaches=('caches' in window)?caches.keys().then(function(keys){return Promise.all(keys.map(function(key){return caches.delete(key);})).then(function(){return keys.length;});}):Promise.resolve(0);Promise.all([clearRegistrations,clearCaches]).then(function(result){var hadRegistrations=(result[0]||0)>0;var hadCaches=(result[1]||0)>0;if(!hadRegistrations&&!hadCaches)return;var url=new URL(window.location.href);url.searchParams.set('__sw_cleaned__','1');window.location.replace(url.toString());});}catch(_e){}})();`
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${spaceGrotesk.variable} bg-background-dark font-display text-brown antialiased dark:bg-dark-bg dark:text-dark-text`}
      >
        <LegacyServiceWorkerCleanup />
        {children}
      </body>
    </html>
  );
}
