import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true, port: 5173,
    proxy: {
      '/api': 'http://localhost:5174' // backend port
    }
  },
  plugins: [react()],
});