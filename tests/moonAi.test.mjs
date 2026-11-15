import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'
import { createMoonAiMiddleware } from '../server/moon-ai.mjs'

test('Moon AI authorizes Claude requests and preserves the tool exchange', async t => {
  let credentials = {}
  const upstream = []
  const mockClaude = async (url, options) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages')
    assert.equal(options.headers['x-api-key'], 'mock-provider-secret')
    const body = JSON.parse(options.body)
    assert.ok(body.tools.some(tool => tool.name === 'simulate_descent'))
    upstream.push(body)
    return Response.json({ content: upstream.length === 1 ?
      [{ type: 'tool_use', id: 'site-call', name: 'find_sites', input: { query: 'Haworth' } }] :
      [{ type: 'text', text: 'Haworth found.' }] })
  }
  const middleware = createMoonAiMiddleware(() => credentials, mockClaude)
  const server = createServer((req, res) => middleware(req, res, () => res.end()))
  server.listen(0, '127.0.0.1')
  t.after(() => server.close())
  await once(server, 'listening')
  const path = `http://127.0.0.1:${server.address().port}/api/moon-ai`
  const question = { role: 'user', content: [{ type: 'text', text: 'Where is Haworth?' }] }
  const post = (messages, access = '') => fetch(path, { method: 'POST', headers: { 'x-moon-ai-access': access }, body: JSON.stringify({ messages }) })

  assert.deepEqual(await (await fetch(path)).json(), { configured: false, accessRequired: false })
  assert.equal((await post([question])).status, 503)
  credentials = { ANTHROPIC_API_KEY: 'mock-provider-secret', MOON_AI_ACCESS_TOKEN: 'mock-application-access' }
  assert.equal((await post([question], 'wrong-token')).status, 401)
  assert.equal((await post([null, null, question], 'mock-application-access')).status, 400)
  assert.equal(upstream.length, 0)
  const authorized = await post([question], 'mock-application-access')
  const { content } = await authorized.json()
  const toolResult = { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'site-call', content: '{"name":"Haworth"}' }] }
  const answer = await post([question, { role: 'assistant', content }, toolResult], 'mock-application-access')
  assert.deepEqual(await answer.json(), { content: [{ type: 'text', text: 'Haworth found.' }] })
  assert.deepEqual(upstream[1].messages.at(-1), toolResult)
})
