import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the two heavy, rarely-changing vendors so app-code deploys
        // don't invalidate them in the browser cache.
        manualChunks: {
          recharts: ['recharts'],
          firebase: ['firebase/app', 'firebase/analytics'],
        },
      },
    },
  },
})
