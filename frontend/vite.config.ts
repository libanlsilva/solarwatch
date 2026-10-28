import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': process.env.SOLARWATCH_API_URL ?? 'http://127.0.0.1:5171',
    },
  },
  preview: {
    proxy: {
      '/api': process.env.SOLARWATCH_API_URL ?? 'http://127.0.0.1:5171',
    },
  },
})
