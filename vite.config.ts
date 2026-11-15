import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createMoonAiMiddleware, viteMoonAiEnv } from './server/moon-ai.mjs'

const cleanPresentationPath = {
  name: 'clean-presentation-path',
  configureServer(server: import('vite').ViteDevServer) { server.middlewares.use(servePresentation) },
  configurePreviewServer(server: import('vite').PreviewServer) { server.middlewares.use(servePresentation) },
}

const servePresentation: import('vite').Connect.NextHandleFunction = (incoming, _response, next) => {
  const request = incoming as typeof incoming & { url?: string }
  request.url = request.url?.replace(/^\/sunum\/?(?=\?|$)/, '/sunum.html')
  next()
}

export default defineConfig(({ mode }) => {
  const moonAi = createMoonAiMiddleware(viteMoonAiEnv(loadEnv, mode))
  return {
    plugins: [react(), cleanPresentationPath, {
      name: 'moon-ai-server',
      configureServer(server) { server.middlewares.use(moonAi) },
      configurePreviewServer(server) { server.middlewares.use(moonAi) },
    }],
    server: { port: 4173 },
    preview: { port: 4173 },
    build: {
      rollupOptions: { input: { atlas: 'index.html', sunum: 'sunum.html' }, output: { manualChunks: {
        three: ['three'],
        renderer: ['@react-three/fiber', '@react-three/drei'],
      } } },
    },
  }
})
