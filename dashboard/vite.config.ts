import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// Derive the API host (e.g. http://localhost:8082) from VITE_API_URL so the
// dev proxy points at whichever stack the dashboard is running against.
//   bash scripts/dev.sh up                  → demo  (8082 / 6002)
//   JOSBIN_STACK=live bash scripts/dev.sh up→ live (8080 / 6001)
// Without this the proxy was hardcoded to live (8080 / 6001) and dashboards
// pointed at demo silently failed every /broadcasting/auth call — Echo
// reconnect loop, browser felt like it was "reloading".
const RAW_API   = process.env.VITE_API_URL ?? 'http://localhost:8080/api'
const API_HOST  = RAW_API.replace(/\/api\/?$/, '').replace(/\/$/, '')
const REVERB_HOST = process.env.VITE_REVERB_HOST ?? 'localhost'
const REVERB_PORT = process.env.VITE_REVERB_PORT ?? (API_HOST.endsWith(':8082') ? '6002' : '6001')

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: API_HOST,
        changeOrigin: true,
      },
      '/broadcasting': {
        target: `http://${REVERB_HOST}:${REVERB_PORT}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
