import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.png', 'a4layout_bg.pdf'],
      manifest: {
        name: 'GoForPrice — Impression étiquettes',
        short_name: 'GoForPrice',
        description: "Impression d'étiquettes et affiches pour Go For Prize",
        theme_color: '#1B2B3A',
        background_color: '#EDEEF0',
        display: 'standalone',
        orientation: 'landscape',
        lang: 'fr',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,pdf}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
