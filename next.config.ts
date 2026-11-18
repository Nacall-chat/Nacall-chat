import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  // Versão com que o app foi montado; o sino compara com /api/version para avisar de atualização.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? '' },
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self)' },
    ] }];
  },
};
export default config;
