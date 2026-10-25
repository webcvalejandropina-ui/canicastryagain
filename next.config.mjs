/** @type {import('next').NextConfig} */
export default function createNextConfig() {
  const explicitDistDir = process.env.NEXT_DIST_DIR?.trim();

  return {
    output: 'standalone',
    devIndicators: false,
    serverExternalPackages: ['better-sqlite3'],
    async headers() {
      return [{source:'/:path*',headers:[{key:'Content-Security-Policy',value:"object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"},{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]},{source:'/api/:path((?!appearance$|backgrounds/).*)',headers:[{key:'Cache-Control',value:'private, no-store'}]},{source:'/pwa-assets.json',headers:[{key:'Cache-Control',value:'no-cache'}]}, {source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache'},{key:'Service-Worker-Allowed',value:'/'}]}, {source:'/manifest.webmanifest',headers:[{key:'Cache-Control',value:'no-cache'}]}, { source: '/glass/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }, { source: '/worlds/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
    },
    ...(explicitDistDir ? { distDir: explicitDistDir } : {})
  };
}
