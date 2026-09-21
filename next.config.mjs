/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const nextConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  // Skip next-pwa webpack compilation on Vercel. The committed public/sw.js
  // is still deployed; this matches the working Next 16 preview path, which
  // does not run the webpack plugin.
  disable: Boolean(process.env.VERCEL),
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
})({
  eslint: {
    ignoreDuringBuilds: true,
  },
  // ... other config options ...
});

export default nextConfig;
