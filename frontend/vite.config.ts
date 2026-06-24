import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:8000',
      '/photos': 'http://localhost:8000',
    },
  },
})
