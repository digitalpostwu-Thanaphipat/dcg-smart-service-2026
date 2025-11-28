import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'WUS Track DCG',
        short_name: 'WUS Track',
        description: 'ระบบบริหารงานไปรษณีย์ ส่วนอำนวยการสารบรรณ',
        theme_color: '#6A2C70',
        background_color: '#F9F7F7',
        display: 'standalone',
        icons: [
          {
            // รูปบุรุษไปรษณีย์ (Postman Officer)
            src: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2830/2830305.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})