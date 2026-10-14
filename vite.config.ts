import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: { alias: {
    '@': fileURLToPath(new URL('./src/institution', import.meta.url)),
    'next/link': fileURLToPath(new URL('./src/institution/adapters/link.tsx', import.meta.url)),
    'next/image': fileURLToPath(new URL('./src/institution/adapters/image.tsx', import.meta.url)),
    'next/navigation': fileURLToPath(new URL('./src/institution/adapters/navigation.ts', import.meta.url)),
  } },
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
