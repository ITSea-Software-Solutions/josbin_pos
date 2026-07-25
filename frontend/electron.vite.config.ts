import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Derive backend host from VITE_API_URL so dev proxy follows whichever stack
// the POS was started against (live 8080 / demo 8082 / sandbox 8091).
// Hardcoded 8080 caused silent ECONNREFUSED loops on demo / sandbox.
const POS_RAW_API  = process.env.VITE_API_URL ?? 'http://localhost:8080/api'
const POS_API_HOST = POS_RAW_API.replace(/\/api\/?$/, '').replace(/\/$/, '')

export default defineConfig({
  main: {
    build: {
      outDir: resolve(__dirname, 'dist-electron'),
      emptyOutDir: true,
      lib: {
        entry: resolve(__dirname, 'electron/main.ts'),
      },
    },
  },
  preload: {
    build: {
      outDir: resolve(__dirname, 'dist-electron'),
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, 'electron/preload.ts'),
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        // Android-only Capacitor plugins: `src/lib/capacitor-printer.ts` is
        // reached ONLY through a dynamic import guarded by detectPlatform()
        // === 'android', so on the Electron/desktop build this chunk is never
        // loaded at runtime. Externalise the plugins so Rollup doesn't try to
        // resolve them at build time (they're not installed in the desktop
        // dependency set) — without this the whole `.exe` build fails.
        external: [
          '@capgo/capacitor-printer',
        ],
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: POS_API_HOST,
          changeOrigin: true,
        },
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    },
  },
})
