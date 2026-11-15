import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Download, ExternalLink, Play, X } from 'lucide-react'
import slides from '../data/projectPresentation.json'
import './project-presentation.css'

function SlideContent({ slide }: { slide: (typeof slides)[number] }) {
  return <>
    <div className="pitch-label">{slide.label}</div>
    <h2>{slide.title}</h2>
    <p className="pitch-lead">{slide.lead}</p>
    <div className="pitch-cards">
      {slide.cards.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}
    </div>
    {slide.sources.length > 0 && <div className="pitch-sources" aria-label="Kaynaklar">
      {slide.sources.map(([label, url]) => <a key={url} href={url} target="_blank" rel="noreferrer">{label}<ExternalLink size={13} /></a>)}
    </div>}
  </>
}

export function ProjectPresentation({ onMoonAi }: { onMoonAi: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  function move(offset: number) {
    const next = Math.max(0, Math.min(slides.length - 1, index + offset))
    if (next === index) return
    if (next === 0 || next === slides.length - 1) page.current?.focus({ preventScroll: true })
    setIndex(next)
    page.current?.scrollTo(0, 0)
  }

  return <>
    <section className="docs-section pitch-section" id="presentation">
      <div className="pitch-label">PROJE SUNUMU</div>
      <h2>ALPHA LUNAR Space Apps sunumu</h2>
      <p className="pitch-lead">Projenin çıkış noktası, veri ve doğrulama kapsamı, son geliştirmeler ve jüriye gösterilecek örnek çalışma.</p>
      <div className="pitch-actions">
        <button onClick={() => { setIndex(0); dialog.current?.showModal() }}><Play size={16} /> Sunumu başlat</button>
        <a href="/presentation/ALPHA-LUNAR-Space-Apps-Sunumu.pptx" download><Download size={16} /> PowerPoint’i indir</a>
        <button onClick={onMoonAi}>Moon AI’ı aç <ArrowRight size={16} /></button>
      </div>
      <div className="pitch-outline">
        {slides.slice(1).map(slide => <div className="pitch-outline-item" key={slide.id}><SlideContent slide={slide} /></div>)}
      </div>
    </section>
    <dialog className="pitch-dialog" ref={dialog} aria-label="ALPHA LUNAR Space Apps sunumu" onKeyDown={event => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        move(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }}>
      <div className="pitch-dialog-header">
        <span>ALPHA LUNAR · NASA SPACE APPS CHALLENGE</span>
        <button aria-label="Sunumu kapat" onClick={() => dialog.current?.close()}><X size={19} /></button>
      </div>
      <div className="pitch-page" ref={page} tabIndex={-1} aria-live="polite"><SlideContent slide={slides[index]} /></div>
      <div className="pitch-pagination">
        <button disabled={index === 0} onClick={() => move(-1)}><ArrowLeft size={16} /> Önceki</button>
        <span>{index + 1} / {slides.length}</span>
        <button disabled={index === slides.length - 1} onClick={() => move(1)}>Sonraki <ArrowRight size={16} /></button>
      </div>
    </dialog>
  </>
}
