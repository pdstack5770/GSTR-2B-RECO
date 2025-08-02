import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: './public', // Critical for index.html resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src') // Proper path mapping
    }
  },
  build: {
    outDir: '../dist', // Output directory
    emptyOutDir: true, // Clean before build
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, './public/index.html') // Explicit entry point
      }
    }
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    strictPort: true
  }
})
