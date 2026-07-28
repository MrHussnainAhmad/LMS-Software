import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    chunkSizeWarningLimit: 1600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|react-router)/ },
            { name: 'vendor-charts', test: /node_modules[\\/]recharts/ },
            { name: 'vendor-pdf', test: /node_modules[\\/](jspdf|html2canvas|canvg|core-js)/ },
          ],
        },
      },
    },
  },
})
