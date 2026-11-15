import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Maximize, Minimize,
} from 'lucide-react'
import './short-presentation.css'

const pages = [
  { id: 'baslangic', label: 'Başlangıç' },
  { id: 'neden', label: 'Çözüm' },
  { id: 'nasil', label: 'Kolaylıklar' },
  { id: 'ornek', label: 'Örnek' },
]
const docs = '/?view=documentation'
const challenge = 'https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/'
const moonSource = 'https://svs.gsfc.nasa.gov/4720/'

function currentPage() {
  const hash = window.location.hash === '#demo' ? '#ornek' : window.location.hash
  return Math.max(0, pages.findIndex(page => '#' + page.id === hash))
}

const capabilities = [
  {
    title: 'Bilim',
    items: [
      'Arazi değerlendirmesi',
      'Aydınlanma analizi',
      'Görünürlük analizi',
      'Buz kaynaklarına erişim',
      'Gün doğumu, gün batımı, Dünya’nın doğuşu ve batışı',
      'Güneş ışığı alma süreleri',
      'Dünya ile görüşme süreleri',
      'Su buzu kanıtlarının sıralaması',
    ],
  },
  {
    title: 'Teknoloji',
    items: [
      '3B Ay atlası',
      'Enerji planlaması',
      'Haberleşme planlaması',
      'Saha ve tarih karşılaştırması',
      'Moon AI ile senaryo incelemesi',
      'Kaynaklı raporlama',
    ],
  },
  {
    title: 'Veriler',
    items: [
      'İniş alanları',
      'Yörünge ve konum verileri (efemeris)',
      'Arazi verileri',
      'Su buzu bulguları',
      'Güneş ve Dünya’nın gökyüzündeki konumu',
      'Arazi yapısı',
    ],
  },
]

function Slide({ index }: { index: number }) {
  switch (index) {
    case 0:
      return <>
        <div className="cover-copy">
          <p className="eyebrow">NASA SPACE APPS CHALLENGE</p>
          <h1 id="slide-title">Ay’a nereye ve ne zaman <em>inmeliyiz?</em></h1>
          <div className="slide-copy">
            <p>Ay’ın Güney Kutbu’nda bir görev planladığımızı düşünelim. İlk sorumuz, aracın nereye inebileceği. İkinci sorumuz ise oraya ne zaman inmenin daha uygun olduğu.</p>
            <p>Arazi inişe elverişli görünse bile araç, seçtiğimiz tarihte uzun süre gölgede kalabilir. Çevredeki yükseltiler de Dünya’yı doğrudan görebildiğimiz saatleri değiştirebilir.</p>
            <p>Biz bu soruları birlikte değerlendirmek için <strong>ALPHA LUNAR</strong>’ı geliştirdik. NASA’nın açık Ay verilerini 3B bir atlasta bir araya getirdik.</p>
            <p>Kullanıcı bir bölge ve tarih aralığı seçtiğinde araziyi, güneş ışığı koşullarını ve Dünya görüşünü aynı ekranda inceleyebiliyor. Ardından farklı bölgeleri veya tarihleri aynı görev koşullarıyla karşılaştırabiliyor.</p>
          </div>
          <a className="button primary" href="#neden">Çözümü gör <ArrowRight size={20} /></a>
        </div>
        <figure className="cover-moon">
          <img src="/presentation/pitch-moon.webp" alt="" width="900" height="900" fetchPriority="high" />
          <figcaption><a href={moonSource} target="_blank" rel="noreferrer">Ay yüzeyi · NASA SVS <ArrowUpRight size={13} /></a></figcaption>
        </figure>
      </>
    case 1:
      return <>
        <h1 id="slide-title">ALPHA LUNAR <em>ne çözüm sunuyor?</em></h1>
        <div className="solution-grid">
          <article className="slide-copy">
            <h2>Görev ekibi ne görür?</h2>
            <p>ALPHA LUNAR, görev ekiplerinin Ay’ın Güney Kutbu’nda nereye ve ne zaman inileceğini birlikte değerlendirmesini sağlar.</p>
            <p>Ekip, 3B atlas üzerinden bir saha ve tarih aralığı seçerek arazinin eğimini, aracın ne kadar süre güneş ışığı alabileceğini ve Dünya’nın hangi saatlerde görüş hattında olacağını aynı ekranda inceler.</p>
            <p>Ardından farklı sahaları ve tarihleri karşılaştırarak hangi seçeneklerin daha ayrıntılı incelenmesi gerektiğini belirler.</p>
          </article>
          <article className="slide-copy">
            <h2>Hangi verileri kullandık?</h2>
            <p>NASA’nın açık LRO verileriyle Ay’ın arazisini modelledik. NASA JPL’nin SPICE verilerini bu arazi modeliyle birleştirerek seçilen konum ve tarihte Güneş ve Dünya görüşünü hesapladık.</p>
            <p>Böylece NASA’nın açık verilerini, görev ekiplerinin <strong>“Bu sahada, bu tarihte görev yapabilir miyiz?”</strong> sorusunu değerlendirmesine yardımcı olan bir araca dönüştürdük.</p>
          </article>
        </div>
        <a className="source-link" href={challenge} target="_blank" rel="noreferrer">Space Apps görev tanımı <ArrowUpRight size={15} /></a>
      </>
    case 2:
      return <>
        <h1 id="slide-title">ALPHA LUNAR’ın <em>Sağladığı Kolaylıklar</em></h1>
        <div className="capabilities-grid">
          {capabilities.map(group => <section className="capability-group" key={group.title}>
            <h2>{group.title}</h2>
            <ul>{group.items.map(item => <li key={item}>{item}</li>)}</ul>
          </section>)}
        </div>
      </>
    default:
      return <>
        <p className="eyebrow">72 SAATLİK ÖRNEK</p>
        <h1 id="slide-title">Haworth ve <em>Mons Mouton</em></h1>
        <p className="slide-lead">ALPHA LUNAR’da iki sahayı aynı görev koşulları altında karşılaştırdık. “Bu iki saha için seçtiğimiz tarih aralığı uygun mu?”</p>
        <table className="example-table">
          <caption><strong>Analiz aralığı</strong> <time dateTime="2028-02-01T00:00:00Z">1 Şubat 2028, 00.00 UTC</time>’den itibaren 72 saat</caption>
          <thead><tr><th scope="col">Model sonucu</th><th scope="col">Haworth</th><th scope="col">Mons Mouton</th></tr></thead>
          <tbody>
            <tr><th scope="row">Dünya’nın görüş hattında kaldığı süre</th><td>72 saat</td><td>72 saat</td></tr>
            <tr><th scope="row">Güneş’in yerel ufkun üzerinde kaldığı süre</th><td>0 saat</td><td>0 saat</td></tr>
          </tbody>
        </table>
        <p className="example-takeaway">Her iki sahada da Dünya görüşü açık. Bu aralıkta güneş enerjisine dayanan bir görev, depolanmış enerjiye veya başka bir güç kaynağına ihtiyaç duyar.</p>
        <div className="example-actions">
          <a className="button primary" href="/">Atlası aç <ArrowRight size={20} /></a>
          <a className="button secondary" href={docs + '#validation'}><BookOpen size={18} /> Model ve doğrulama</a>
        </div>
      </>
  }
}

function ShortPresentation() {
  const [index, setIndex] = useState(currentPage)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const syncPage = () => {
      setIndex(currentPage())
      window.scrollTo(0, 0)
    }
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement))
    window.addEventListener('hashchange', syncPage)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => {
      window.removeEventListener('hashchange', syncPage)
      document.removeEventListener('fullscreenchange', syncFullscreen)
    }
  }, [])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return
      const targets: Partial<Record<string, number>> = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: pages.length - 1 }
      const next = targets[event.key]
      if (next === undefined || next < 0 || next >= pages.length || next === index) return
      event.preventDefault()
      window.location.hash = pages[next].id
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [index])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      setFullscreen(Boolean(document.fullscreenElement))
    }
  }

  const page = pages[index]
  return <div className="short-presentation">
    <header className="short-header">
      <a className="short-brand" href="/" aria-label="ALPHA LUNAR atlası">
        <img src="/alpha-lunar.svg" alt="" width="35" height="35" /> ALPHA LUNAR
      </a>
      <div className="short-header-actions">
        <a className="short-docs" href={docs} aria-label="Dokümantasyon"><BookOpen size={16} /> <span>Dokümantasyon</span></a>
        {document.fullscreenEnabled && <button className="fullscreen" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Tam ekrandan çık' : 'Tam ekran'} title={fullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}>
          {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>}
      </div>
    </header>
    <main className={`short-stage short-stage--${page.id}`} aria-labelledby="slide-title" aria-live="polite">
      <Slide index={index} />
    </main>
    <footer className="short-footer">
      <nav className="short-pages" aria-label="Slaytlar">
        {pages.map((item, number) => <a href={`#${item.id}`} key={item.id} aria-current={number === index ? 'step' : undefined} aria-label={`${number + 1}. ${item.label}`}>
          <span>{String(number + 1).padStart(2, '0')}</span><span className="page-name">{item.label}</span>
        </a>)}
      </nav>
      <nav className="short-controls" aria-label="Slayt geçişleri">
        {index > 0 ? <a className="icon-control" href={`#${pages[index - 1].id}`} aria-label="Önceki slayt"><ArrowLeft size={19} /></a>
          : <span className="icon-control disabled" aria-hidden="true"><ArrowLeft size={19} /></span>}
        {index < pages.length - 1 ? <a className="icon-control next" href={`#${pages[index + 1].id}`} aria-label="Sonraki slayt"><ArrowRight size={19} /></a>
          : <span className="icon-control disabled" aria-hidden="true"><ArrowRight size={19} /></span>}
      </nav>
    </footer>
  </div>
}

createRoot(document.getElementById('root')!).render(<ShortPresentation />)
