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

  // The running version, shown in Settings. Without it nobody — cashier,
  // manager or support — can tell which build a terminal in the field is
  // actually on, which turns every "it still doesn't work" into guesswork.
  // Mirrors the same define in electron.vite.config.ts.
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
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
