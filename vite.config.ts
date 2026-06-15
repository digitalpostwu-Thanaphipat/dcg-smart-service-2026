/// <reference types="vitest" />
import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.agent', '.agents'],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://script.google.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/macros/s/AKfycbwSosmXqRi1ByBBMo5h06JkIn0Zc1x4NI9at-btDns8obmcAHuNSCwTNFUwlgpNJqiczw'),
      }
    }
  },
  plugins: [
    react(),
    mode === 'production' && VitePWA({
      registerType: 'prompt',
      includeAssets: ['pwa_app_icon.png', 'icon-192.png', 'icon-512.png', 'vite.svg'],
      manifest: {
        name: 'DCG Smart Service',
        short_name: 'DCG Smart Service',
        description: 'ระบบบริการงานไปรษณีย์ ส่วนอำนวยการสารบรรณ - มหาวิทยาลัยวลัยลักษณ์',
        theme_color: '#6A2C70',
        background_color: '#F9F7F7',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    // })
    })
  ],
}))