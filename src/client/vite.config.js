import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
        '/auth': {
            target: 'http://127.0.0.1:8080',
            changeOrigin: true,
            secure: false,
        },
        '/user': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
          secure: false,
      }
    }
}
})
