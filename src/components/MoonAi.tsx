import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, ArrowUpRight, CircleStop, History, KeyRound, Plus, Sparkles } from 'lucide-react'
import { useLanguage } from '../lib/i18n'
import type { Coordinates } from '../domain/lunar'
import type { MissionProfile } from '../domain/mission'
import { createMoonTools, type Block, type MoonAction, type MoonMessage, type MoonModule, type ToolUse } from '../services/moonAi'
import { readMoonChats, saveMoonTurn, updateMoonChat, type MoonChat, type MoonTurn } from '../services/moonAiHistory'
import './moon-ai.css'

const labels: Record<MoonModule, string> = {
  map: 'Locate on map', archive: 'Landing Site Archive', optimize: 'Landing Optimization', simulation: 'Landing Simulation',
  risk: 'Risk Assessment', ice: 'Water Ice & Resources', thermal: 'Thermal Analysis', terrain: 'Terrain Intelligence',
  power: 'Surface Power', radio: 'Earth Communication', time: 'Time Explorer', comparison: 'Site Comparison',
  reports: 'Mission Reports', artemis: 'Artemis Launch System', missions: 'Lunar Missions', regional: 'Regional Terrain Detail',
  documentation: 'Documentation', settings: 'Mission Configuration',
}
const suggestions = [
  'Find a landing site for this vehicle and compare the risks.',
  'What do we know about water ice near Haworth?',
  'Compare lighting, battery and Earth visibility at two sites.',
]
const toolLabels: Record<string, string> = {
  find_sites: 'Finding lunar sites…', screen_landings: 'Screening landing sites…', inspect_site: 'Reading lunar data…',
  simulate_descent: 'Running descent scenarios…', compare_operations: 'Comparing surface operations…', open_module: 'Preparing workspace…',
}
const apiErrors: Record<string, string> = {
  unconfigured: 'Claude is not configured on this server.',
  access: 'The Moon AI access code is missing or incorrect.',
  provider: 'Claude did not complete the request. Check the server’s Claude configuration or try again.',
  limit: 'Claude is busy. Try again shortly.',
  request: 'This conversation is too large to send. Start a new chat.',
}

function Reply({ text }: { text: string }) {
  // Render model output as text. Only explicit Markdown links to HTTPS or lunar assets are linked.
  const parts = text.split(/(\[[^\]\n]+\]\((?:https:\/\/|\/lunar\/)[^\s)]+\)|\*\*[^*\n]+\*\*)/g)
  return <div className="moon-ai-reply">{parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
    const link = /^\[([^\]]+)\]\(((?:https:\/\/|\/lunar\/)[^\s)]+)\)$/.exec(part)
    return link ? <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a> : part
  })}</div>
}

export function MoonAi({ open, coordinates, time, profile, onAction, onClose }: {
  open: boolean; coordinates: Coordinates; time: number; profile: MissionProfile
  onAction: (action: MoonAction) => void; onClose: () => void
}) {
  const { t, language } = useLanguage()
  const [server, setServer] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [token, setToken] = useState('')
  const [showAccess, setShowAccess] = useState(false)
  const [draft, setDraft] = useState('')
  const [chats, setChats] = useState<MoonChat[]>([])
  const [chatId, setChatId] = useState<string>()
  const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [showHistory, setShowHistory] = useState(false)
  const [writeFailed, setWriteFailed] = useState(false)
  const [pending, setPending] = useState('')
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const active = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const currentChat = chats.find(chat => chat.id === chatId)
  const turns = currentChat?.turns
  const historyDate = showHistory ? new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }) : null

  useEffect(() => {
    let mounted = true
    readMoonChats().then(saved => {
      if (!mounted) return
      setChats(saved)
      setChatId(saved[0]?.id)
      setHistoryStatus('ready')
    }).catch(() => { if (mounted) setHistoryStatus('unavailable') })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    fetch('/api/moon-ai', { signal: controller.signal }).then(async response => response.ok ? await response.json() : null)
      .then(value => { if (!controller.signal.aborted) setServer(value?.configured === true ? 'ready' : 'unavailable') })
      .catch(() => { if (!controller.signal.aborted) setServer('unavailable') })
    return () => controller.abort()
  }, [open])
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: 'end' }) }, [turns, pending, stage, open])
  useEffect(() => () => active.current?.abort(), [])

  function selectChat(id?: string) {
    if (active.current) return
    setShowHistory(false)
    if (id !== undefined && id === chatId) return
    setChatId(id)
    setDraft('')
    setError('')
  }

  async function recordTurn(chat: MoonChat, turn: MoonTurn) {
    const now = Date.now()
    setChats(previous => {
      const latest = previous.find(item => item.id === chat.id) ?? chat
      return [updateMoonChat(latest, turn, now), ...previous.filter(item => item.id !== chat.id)]
    })
    if (historyStatus !== 'ready') return
    try {
      await saveMoonTurn(chat, turn, now)
    } catch {
      setWriteFailed(true)
    }
  }

  async function send(value: string) {
    const question = value.trim()
    if (!question || active.current || server !== 'ready' || historyStatus === 'loading') return
    if (!token) { setShowAccess(true); setError(apiErrors.access); return }
    const job = new AbortController()
    active.current = job
    const chat = currentChat ?? {
      id: crypto.randomUUID(),
      title: question.replace(/\s+/g, ' ').slice(0, 100),
      updatedAt: Date.now(),
      turns: [],
    }
    const turn: MoonTurn = { id: crypto.randomUUID(), question, answer: '', actions: [] }
    setChatId(chat.id)
    setDraft(''); setPending(turn.id); setError(''); setStage('Analyzing your request…')
    const input: MoonMessage = { role: 'user', content: [{ type: 'text', text: question }] }
    // Plain prior turns give follow-up context without replaying large tool payloads.
    const history: MoonMessage[] = chat.turns.filter(turn => turn.answer).slice(-6).flatMap(turn => [
      { role: 'user', content: [{ type: 'text', text: turn.question }] },
      { role: 'assistant', content: [{ type: 'text', text: turn.answer }] },
    ])
    const transcript: MoonMessage[] = [input]
    const actions: MoonAction[] = []
    const execute = createMoonTools({ coordinates, time, profile }, job.signal)
    const context = JSON.stringify({ locale: language, selectedCoordinates: coordinates, epochUtc: new Date(time).toISOString(), profile })
    try {
      await recordTurn(chat, turn)
      job.signal.throwIfAborted()
      for (let round = 0; round < 7; round++) {
        const response = await fetch('/api/moon-ai', {
          method: 'POST', signal: job.signal,
          headers: { 'content-type': 'application/json', 'x-moon-ai-access': token },
          body: JSON.stringify({ messages: [...history,
            { ...input, content: [{ type: 'text', text: 'Current application context: ' + context }, ...input.content] }, ...transcript.slice(1)] }),
        })
        const result = await response.json()
        if (!response.ok) {
          if (response.status === 401) setShowAccess(true)
          throw new Error(apiErrors[result.error] ?? apiErrors.provider)
        }
        const content = result.content as Block[]
        if (!Array.isArray(content) || !content.length) throw new Error(apiErrors.provider)
        transcript.push({ role: 'assistant', content })
        const calls = content.filter((block): block is ToolUse => block.type === 'tool_use')
        const answer = content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n\n')
        if (!calls.length) {
          if (!answer.trim()) throw new Error(apiErrors.provider)
          await recordTurn(chat, { ...turn, answer, actions })
          return
        }
        const evidence: Block[] = []
        for (const call of calls) {
          job.signal.throwIfAborted()
          setStage(toolLabels[call.name] ?? 'Analyzing your request…')
          try {
            const result = await execute(call)
            if (result.actions) for (const action of result.actions) {
              const ranked = actions.find(item => item.landing && item.site?.id === action.site?.id && item.landing.profile.massKg === action.descent?.profile.massKg)
              actions.push(ranked ? { ...action, time: ranked.time, landing: ranked.landing } : action)
            }
            evidence.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(result.evidence) })
          } catch (cause) {
            job.signal.throwIfAborted()
            evidence.push({ type: 'tool_result', tool_use_id: call.id, content: cause instanceof Error ? cause.message : 'Analysis unavailable.', is_error: true })
          }
        }
        transcript.push({ role: 'user', content: evidence })
      }
      throw new Error('The analysis took too many steps. Ask about one site or workflow at a time.')
    } catch (cause) {
      setDraft(question)
      if (!job.signal.aborted) {
        setError(cause instanceof Error ? cause.message : apiErrors.provider)
        if (actions.length) await recordTurn(chat, { ...turn, actions })
      }
    } finally {
      if (active.current === job) { active.current = null; setStage(''); setPending('') }
    }
  }

  if (!open) return null
  return <section className={`moon-ai-page${showHistory ? ' has-history' : ''}`} aria-label="Moon AI">
    <header className="moon-ai-top">
      <button className="icon-button" aria-label={t('Return to explorer')} onClick={onClose}><ArrowLeft size={18} /></button>
      <strong>Moon AI</strong>
      {server === 'ready' && <span>{t('Powered by Claude')}</span>}
      <div className="moon-ai-top-actions">
        <button className="analysis-action" aria-expanded={showHistory} aria-controls="moon-ai-history" onClick={() => setShowHistory(value => !value)}><History size={15} />{t('Chat history')}</button>
        {server === 'ready' && <button className="analysis-action" onClick={() => setShowAccess(value => !value)}><KeyRound size={15} />{t('Access')}</button>}
        <button className="analysis-action" disabled={!!pending || historyStatus === 'loading'} onClick={() => selectChat()}><Plus size={16} />{t('New chat')}</button>
      </div>
    </header>
    {showAccess && <form className="moon-ai-access" onSubmit={event => { event.preventDefault(); setShowAccess(false); setError('') }}>
      <label>{t('Moon AI access code')}<input type="password" autoComplete="off" value={token} onChange={event => setToken(event.currentTarget.value)} maxLength={256} /></label>
      <button className="analysis-action" type="submit">{t('Continue')}</button>
    </form>}
    {showHistory && <aside id="moon-ai-history" className="moon-ai-history" aria-label={t('Chat history')}>
      <h2>{t('Chat history')}</h2>
      <p>{t('Chats are saved in this browser.')}</p>
      {historyStatus === 'loading' && <p role="status">{t('Loading saved chats…')}</p>}
      {!chats.length && historyStatus === 'ready' && <p>{t('Your chats will appear here after you send a message.')}</p>}
      <ul>
        {chats.map(chat => <li key={chat.id}>
          <button type="button" aria-current={chat.id === chatId ? 'true' : undefined} disabled={!!pending} onClick={() => selectChat(chat.id)}>
            <span title={chat.title}>{chat.title}</span>
            <time dateTime={new Date(chat.updatedAt).toISOString()}>{historyDate?.format(chat.updatedAt)}</time>
          </button>
        </li>)}
      </ul>
    </aside>}
    <div className="moon-ai-scroll" aria-live="polite">
      <div className="moon-ai-thread">
        {!turns?.length && !pending && <div className="moon-ai-welcome">
          <Sparkles size={29} aria-hidden="true" />
          <h1>{t('What would you like to explore?')}</h1>
          <p>{t('Plan a lunar landing, inspect the terrain or compare surface operations.')}</p>
          {server === 'ready' && <div className="moon-ai-suggestions">{suggestions.map(suggestion =>
            <button key={suggestion} className="analysis-action" onClick={() => setDraft(t(suggestion))}>{t(suggestion)}<ArrowUpRight size={15} /></button>)}</div>}
          {server === 'unavailable' && <div className="moon-ai-suggestions">{(['optimize', 'archive', 'comparison', 'simulation'] as const).map(module =>
            <button key={module} className="analysis-action" onClick={() => onAction({ module })}>{t(labels[module])}<ArrowUpRight size={15} /></button>)}</div>}
        </div>}
        {turns?.map(turn => <article className="moon-ai-turn" key={turn.id}>
          <div className="moon-ai-question">{turn.question}</div>
          {turn.id === pending ? <p role="status">{t(stage)}</p> : turn.answer ? <Reply text={turn.answer} /> :
            <p className="moon-ai-turn-status">{t('Response unfinished.')}</p>}
          {turn.actions.length > 0 && <div className="moon-ai-actions">
            {[...new Map(turn.actions.map(action => [`${action.module}:${action.site?.id ?? ''}:${action.time ?? ''}:${action.comparison?.sites.map(site => site.id).join(',') ?? ''}`, action])).values()].map((action, index) =>
              <button className="analysis-action" key={index} onClick={() => onAction(action)}>
                {t(labels[action.module])}{action.site ? ` · ${t(action.site.name)}` : action.comparison ? ` · ${action.comparison.sites.map(site => t(site.name)).join(' / ')}` : ''}<ArrowUpRight size={14} />
              </button>)}
          </div>}
        </article>)}
        <div ref={end} />
      </div>
    </div>
    <form className="moon-ai-compose" onSubmit={event => { event.preventDefault(); void send(draft) }}>
      {error && <p role="alert">{t(error)}</p>}
      {(historyStatus === 'unavailable' || writeFailed) && <p role="status">{t('Chat history could not be saved in this browser.')}</p>}
      <div className="moon-ai-input">
        <textarea aria-label={t('Message Moon AI')} placeholder={t('Ask about a lunar mission…')} maxLength={3000} rows={2}
          disabled={server !== 'ready'} value={draft} onChange={event => setDraft(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft) }
          }} />
        {pending ? <button type="button" aria-label={t('Stop response')} onClick={() => active.current?.abort()}><CircleStop size={20} /></button> :
          <button type="submit" aria-label={t('Send message')} disabled={!draft.trim() || server !== 'ready' || historyStatus === 'loading'}><ArrowUp size={20} /></button>}
      </div>
      <p>{t(server === 'unavailable' ? 'Claude is not configured on this server.' : server === 'loading' ? 'Checking Claude connection…' :
        'Your message and selected study context are sent to Claude.')}</p>
    </form>
  </section>
}
