// Capacitor v8 config
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'sr.josbin_pos.pos',
  appName: 'Josbin POS',
  webDir: 'dist',
  // When running `npm run dev`, point at Vite dev server so Android hot-reloads
  server: process.env.CAPACITOR_DEV
    ? { url: 'http://10.0.2.2:5173', cleartext: true }  // 10.0.2.2 = host machine from Android emulator
    : undefined,
  android: {
    // Allow cleartext HTTP to LAN printer/backend during dev
    allowMixedContent: true,
    // Keep screen on — POS terminals should never dim
    backgroundColor: '#1a1a2e',
  },
  plugins: {
    // No Capacitor plugins require config here — @anuradev/capacitor-printer
    // and @capacitor-community/tcp-sockets are configured via their own APIs.
  },
}

export default config
