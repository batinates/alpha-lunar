import { Readable } from 'node:stream'
import { createMoonAiHandler } from './moon-ai-handler.mjs'

export function viteMoonAiEnv(loadEnv, mode) {
  const values = loadEnv(mode, process.cwd(), ['ANTHROPIC_', 'MOON_AI_'])
  return () => ({ ...values, ...process.env })
}

export function createMoonAiMiddleware(getEnv = () => process.env, request = fetch) {
  const handle = createMoonAiHandler(request)
  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/api/moon-ai') return next()
    const controller = new AbortController()
    const cancel = () => controller.abort()
    res.once('close', cancel)
    try {
      const options = { method: req.method, headers: new Headers(req.headers), signal: controller.signal }
      if (req.method === 'POST') Object.assign(options, { body: Readable.toWeb(req), duplex: 'half' })
      const response = await handle(new Request(url, options), getEnv())
      if (res.destroyed) return
      res.writeHead(response.status, Object.fromEntries(response.headers))
      res.end(await response.text())
    } catch {
      if (res.destroyed) return
      res.writeHead(502, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      res.end('{"error":"provider"}')
    } finally {
      res.removeListener('close', cancel)
    }
  }
}
