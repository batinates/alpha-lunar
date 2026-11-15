import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build } from 'vite'

await build({
  configFile: false,
  publicDir: false,
  ssr: { target: 'webworker', noExternal: true },
  build: {
    ssr: resolve('server/sites-worker.mjs'),
    target: 'es2022',
    outDir: 'dist/server',
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: 'index.js' } },
  },
})
writeFileSync('dist/server/wrangler.json', JSON.stringify({
  main: 'index.js',
  compatibility_date: '2026-10-21',
  assets: { directory: '../client', binding: 'ASSETS', run_worker_first: ['/api/*'] },
}, null, 2) + '\n')
