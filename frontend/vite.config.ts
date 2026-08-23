import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Honour an injected PORT so a supervising harness can place the dev server
    // somewhere free instead of vite silently picking the next port itself.
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the heavy, rarely-changing charting vendor so app-code deploys
        // don't invalidate it in the browser cache.
        manualChunks: {
          recharts: ['recharts'],
        },
      },
    },
  },
})
