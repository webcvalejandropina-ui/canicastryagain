/** @type {import('next').NextConfig} */
export default function createNextConfig() {
  const explicitDistDir = process.env.NEXT_DIST_DIR?.trim();

  return {
    output: 'standalone',
    serverExternalPackages: ['better-sqlite3'],
    ...(explicitDistDir ? { distDir: explicitDistDir } : {})
  };
}
