import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 4173 },
  preview: { port: 4173 },
  build: {
    rollupOptions: { output: { manualChunks: {
      three: ['three'],
      renderer: ['@react-three/fiber', '@react-three/drei'],
    } } },
  },
})
