import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        // A local API can override this, while a plain `npm run dev` uses the deployed API.
        target: process.env.VITE_API_PROXY_TARGET || 'https://where-api-kimgeon5023.onrender.com',
        changeOrigin: true,
      },
    },
  },
})
