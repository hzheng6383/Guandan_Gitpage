import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/guandan_gitpage/', // Set to repo subpath for GitHub Pages. If you need Capacitor/Android relative assets, switch back to './' when building for native.
    plugins: [
      react(),
      // VitePWA({
      //   registerType: 'autoUpdate',
      //   includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      //   manifest: {
      //     name: 'AI 掼蛋大师',
      //     short_name: '掼蛋大师',
      //     description: 'Premium Web-based Guandan Card Game',
      //     theme_color: '#064e3b', // Updated to match Emerald Green
      //     background_color: '#064e3b',
      //     display: 'standalone',
      //     orientation: 'any', // CHANGED: Allow any orientation
      //     scope: '/',
      //     start_url: '/',
      //     icons: [
      //       {
      //         src: 'pwa-192x192.png',
      //         sizes: '192x192',
      //         type: 'image/png'
      //       },
      //       {
      //         src: 'pwa-512x512.png',
      //         sizes: '512x512',
      //         type: 'image/png'
      //       },
      //       {
      //         src: 'pwa-512x512.png',
      //         sizes: '512x512',
      //         type: 'image/png',
      //         purpose: 'any maskable'
      //       }
      //     ]
      //   },
      //   workbox: {
      //     globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      //   }
      // })
    ],
  };
});