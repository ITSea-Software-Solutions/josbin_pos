// Used by:
//   - Vitest (test runner)
//   - Android Capacitor build  (npm run build:android / android:dev)
//
// Electron dev/build config lives in electron.vite.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  // ── Capacitor / Android build ───────────────────────────────────────────
  // @capacitor-community/tcp-sockets is a native-only Android plugin.
  // It has no npm package — it is injected by the Capacitor runtime inside
  // the compiled APK. Rollup must not try to bundle it.
  optimizeDeps: {
    exclude: ['@capacitor-community/tcp-sockets'],
  },
  build: {
    rollupOptions: {
      external: ['@capacitor-community/tcp-sockets'],
    },
  },

  // ── Dev-only API proxy ──────────────────────────────────────────────────
  // Lets `npm run dev` talk to a remote backend (e.g. the demo droplet)
  // without CORS / sandbox issues: the browser stays same-origin and the
  // Vite process forwards /api. Usage:
  //   VITE_API_URL=/api VITE_DEV_PROXY_TARGET=http://142.93.88.143:8080 npx vite
  server: process.env.VITE_DEV_PROXY_TARGET
    ? {
        proxy: {
          '/api': { target: process.env.VITE_DEV_PROXY_TARGET, changeOrigin: true },
        },
      }
    : undefined,

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
