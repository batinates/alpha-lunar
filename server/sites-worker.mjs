import { createMoonAiHandler } from './moon-ai-handler.mjs'

const moonAi = createMoonAiHandler()

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === '/api/moon-ai') return moonAi(request, env)
    if (env.ASSETS) return env.ASSETS.fetch(request)
    return new Response('ALPHA LUNAR asset binding is unavailable.', { status: 503 })
  },
}
