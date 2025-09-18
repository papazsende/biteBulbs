import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// IMPORTANT: set this to your repo name (the folder name on GitHub).
// If you name your repo 'bitebulbs', use '/bitebulbs/'.
const base = '/bitebulbs/'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png','icons/icon-512.png'],
      manifest: {
        name: 'BiteBulbs by Barış Çetin',
        short_name: 'BiteBulbs',
        description: '8-bit bulbs visualizer with quiz and local leaderboard',
        theme_color: '#0c0f13',
        background_color: '#0c0f13',
        display: 'standalone',
        scope: base,
        start_url: base,
        icons: [
          { src: 'src/assets/icon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  base,
  // Build into /docs so GitHub Pages can publish straight from your main branch
  build: { outDir: 'docs' }
})
