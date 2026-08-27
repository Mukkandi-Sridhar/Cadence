import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend URL — in Docker this is the service name, locally it's localhost
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // bind 0.0.0.0 for Docker
    proxy: {
      // All /api/* calls are forwarded to the backend service
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        // SSE connections must not be buffered — disable timeout for streaming
        configure: (proxy) => {
          proxy.on('proxyReq', (_proxyReq, req) => {
            // For SSE endpoints, force streaming mode
            if (req.url?.includes('/stream/')) {
              _proxyReq.setHeader('Accept', 'text/event-stream')
            }
          })
        },
      },
    },
  },
  build: {
    sourcemap: true,
  },
})
