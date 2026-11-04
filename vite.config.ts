import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: '모아',
        short_name: '모아',
        description: '할 일 & 일정 관리 앱',
        theme_color: '#86A03F',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ko',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // 실제 스크린샷 캡처본이 준비되면 screenshots 배열을 다시 추가하세요.
        // (존재하지 않는 파일을 참조하면 설치 UI가 깨진 이미지를 시도합니다)
      },
      workbox: {
        // 타임박스 알림(웹 푸시)을 받아서 띄우는 코드 - public/push-sw.js
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
})
