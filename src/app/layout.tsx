import type { Metadata, Viewport } from "next";

import "./globals.css";
import "./club.css";
import "./appearance.css";
import "./worlds.css";
import "./glass-assets.css";
import "./glass.css";
import { AppearanceProvider } from "@/features/appearance/AppearanceProvider";
import { APPEARANCE_BOOTSTRAP } from "@/features/appearance/appearance";
import { PwaProvider } from "@/features/pwa/PwaProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5ef" },
    { media: "(prefers-color-scheme: dark)", color: "#08090b" },
  ],
};

const siteUrl =
  process.env.PUBLIC_ORIGIN?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

const metadataBase = new URL(siteUrl || "http://localhost:13000");

const viralDescription =
  "Desafía a un amigo a un misère de canicas: partidas en vivo en el navegador, gratis y con buen rollo. Sin instalar nada.";

export const metadata: Metadata = {
  ...(metadataBase ? { metadataBase } : {}),
  title: {
    default: "Canicas Try Again — Partida amistosa online",
    template: "%s · Canicas Try Again",
  },
  manifest: "/manifest.webmanifest",
  icons: {icon:[{url:"/icons/marble-32.png",sizes:"32x32",type:"image/png"},{url:"/favicon.ico",sizes:"48x48"}],apple:"/icons/marble-180.png"},
  description: viralDescription,
  keywords: [
    "juego online",
    "canicas",
    "misère",
    "multijugador",
    "gratis",
    "amigos",
    "navegador",
    "desafío",
    "buen rollo",
  ],
  openGraph: {
    type: "website",
    images: [{url:"/share/canicas-invitacion.jpg",width:1200,height:630,alt:"Canicas de cristal. ¿Una partida?"}],
    locale: "es_ES",
    siteName: "Canicas Try Again",
    title: "Canicas Try Again — Reto entre amigos",
    description: viralDescription,
  },
  twitter: {
    card: "summary_large_image",
    images: ["/share/canicas-invitacion.jpg"],
    title: "Canicas Try Again",
    description: viralDescription,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Canicas",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP }} />
      </head>
      <body
        suppressHydrationWarning
        className="bg-background-dark font-display text-brown antialiased dark:bg-dark-bg dark:text-dark-text"
      >
        <PwaProvider><AppearanceProvider>{children}</AppearanceProvider></PwaProvider>
      </body>
    </html>
  );
}
