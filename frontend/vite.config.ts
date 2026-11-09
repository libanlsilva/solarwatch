import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiUrl = process.env.SOLARWATCH_API_URL ?? 'http://127.0.0.1:5171'
// `/hubs` carries the SignalR live-readings WebSocket and needs the upgrade forwarded.
const proxy = { '/api': apiUrl, '/hubs': { target: apiUrl, ws: true } }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
})
