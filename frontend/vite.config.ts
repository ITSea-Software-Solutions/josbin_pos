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

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
