import { useEffect, useState } from 'react'

type ErrorStats = { count: number; bias: number; mae: number; rmse: number; maxAbs: number }
type Report = {
  version: number
  windows: string[]
  longPeriod: { start: string; end: string; count: number; stepHours: number }
  groups: {
    site: string; body: 'sun' | 'earth'
    angles: { azimuth: ErrorStats; elevation: ErrorStats; separation: ErrorStats }
    visibility: { complete: number; total: number; delta: ErrorStats | null }
  }[]
}

const folder = '/lunar/validation'
const number = (value: number, digits: number) => value.toLocaleString('tr-TR', { maximumFractionDigits: digits })
const name = (body: 'sun' | 'earth') => body === 'sun' ? 'Güneş' : 'Dünya'

export function ExternalValidation() {
  const [lroc, setLroc] = useState<{ products: { id: string; source: string; utc: string; points: number; matchPercent: number; mcc: number | null; fp: number; fn: number }[] } | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [site, setSite] = useState('All sites')
  useEffect(() => {
    const controller = new AbortController()
    fetch(folder + '/lroc.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('LROC check unavailable')
      return response.json()
    }).then(setLroc).catch(() => {})
    return () => controller.abort()
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    fetch(folder + '/report.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Report unavailable')
      return response.json()
    }).then((data: Report) => {
      if (data.version !== 1 || !data.groups?.length) throw new Error('Unexpected report')
      if (!controller.signal.aborted) setReport(data)
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true)
    })
    return () => controller.abort()
  }, [attempt])
  const groups = report?.groups.filter(group => group.site === site) ?? []
  return <section className="docs-section external-validation" id="validation">
    <div className="docs-section__index">08 / DIŞ REFERANS KONTROLLERİ</div>
    <div className="docs-section__heading"><div><h2>Bilimsel doğrulama</h2>
      <p>Gök cismi yönlerini JPL Horizons ile, uzun dönem görünürlüğünü NASA PGDA ile ve yerel aydınlık/gölge sınıflarını tarihli LROC WAC görüntüleriyle karşılaştırdık.</p></div></div>
    {!report && (failed
      ? <p role="alert">Doğrulama raporu yüklenemedi. <button onClick={() => { setFailed(false); setAttempt(n => n + 1) }}>Tekrar dene</button></p>
      : <p role="status">Doğrulama raporu yükleniyor…</p>)}
    {report && <>
      <label className="validation-filter">İnceleme bölgesi<select value={site} onChange={event => setSite(event.target.value)}>
        {[...new Set(report.groups.map(group => group.site))].map(value => <option value={value} key={value}>{value === 'All sites' ? 'Üç bölge birlikte' : value}</option>)}
      </select></label>
      <div className="validation-check">
        <h3>JPL Horizons · Güneş ve Dünya açıları</h3>
        <p>2026–2028’de altı bir haftalık pencere, 6 saat aralıklı örnekler. Gözlemci konumu ve yüksekliği eşleştirildi. Horizons’ın kırılmasız görünür açıları, uygulamanın geometrik açılarıyla karşılaştırıldı.</p>
        <div className="validation-table"><table>
          <thead><tr><th scope="col">Cisim</th><th scope="col">Örnek</th><th scope="col">Azimut RMSE</th><th scope="col">Yükselim RMSE</th><th scope="col">En büyük yön farkı</th></tr></thead>
          <tbody>{groups.map(({ body, angles }) => <tr key={body}><th scope="row">{name(body)}</th><td>{angles.separation.count}</td>
            <td>{number(angles.azimuth.rmse, 5)}°</td><td>{number(angles.elevation.rmse, 5)}°</td><td>{number(angles.separation.maxAbs, 5)}°</td></tr>)}</tbody>
        </table></div>
      </div>
      <div className="validation-check">
        <h3>NASA PGDA · Uzun dönem görünürlüğü</h3>
        <p>60 m referans haritasıyla diskten herhangi bir kısmın ufku aştığı örneklerin yüzdesi karşılaştırıldı. Model: {number(report.longPeriod.count, 0)} örnek, {report.longPeriod.stepHours} saat aralık, yaklaşık 18,6 yıl. Referans farklı çözünürlük ve döneme ait ayrı bir modeldir.</p>
        <div className="validation-table"><table>
          <thead><tr><th scope="col">Cisim</th><th scope="col">Tam kapsanan nokta</th><th scope="col">Ortalama mutlak fark</th><th scope="col">Ortalama sapma</th><th scope="col">En büyük mutlak fark</th></tr></thead>
          <tbody>{groups.map(({ body, visibility: v }) => <tr key={body}><th scope="row">{name(body)}</th><td>{v.complete} / {v.total}</td>
            <td>{v.delta ? number(v.delta.mae, 2) + ' yp' : '—'}</td><td>{v.delta ? number(v.delta.bias, 2) + ' yp' : '—'}</td>
            <td>{v.delta ? number(v.delta.maxAbs, 2) + ' yp' : '—'}</td></tr>)}</tbody>
        </table></div>
        <p>yp: yüzde puanı. Sapma, ALPHA LUNAR eksi PGDA. Bu kontrol, tek bir günün gölge saatlerini, üretilen enerjiyi veya radyo bağlantısını ölçmez.</p>
      </div>
      {lroc && (site === 'All sites' || site === 'Shackleton Rim') && <div className="validation-check">
        <h3>LROC WAC · Tarihli gölge kontrolü</h3>
        <p>Shackleton Rim’de iki görüntü. Görüntü parlaklığı Otsu eşiğiyle sınıflandırıldı ve SPICE yönünde atılan 100 km arazi ışınlarıyla karşılaştırıldı. Her görüntü bir gözlem aralığını kapsar. Model bu aralığın ortasını kullanır.</p>
        <div className="validation-table"><table><thead><tr><th>UTC</th><th>Nokta</th><th>Eşleşme</th><th>MCC</th><th>Fazla / eksik aydınlık</th></tr></thead>
          <tbody>{lroc.products.map(row => <tr key={row.id}><th scope="row"><a href={row.source}>{row.utc.slice(0, 16).replace('T', ' ')}</a></th>
            <td>{number(row.points, 0)}</td><td>%{number(row.matchPercent, 1)}</td><td>{row.mcc === null ? '—' : number(row.mcc, 3)}</td><td>{row.fp} / {row.fn}</td></tr>)}</tbody>
        </table></div>
        <div className="validation-downloads"><a href={folder + '/lroc.json'} download>LROC karşılaştırması (JSON)</a></div>
      </div>}
      <div className="validation-downloads">
        <a href={folder + '/angles.csv'} download>Açı örnekleri (CSV)</a>
        <a href={folder + '/visibility.csv'} download>Görünürlük noktaları (CSV)</a>
        <a href={folder + '/report.json'} download>Yöntem, sorgular ve özet (JSON)</a>
        <a href="https://ssd.jpl.nasa.gov/horizons/manual.html" target="_blank" rel="noreferrer">JPL Horizons ↗</a>
        <a href="https://pgda.gsfc.nasa.gov/products/69" target="_blank" rel="noreferrer">NASA PGDA ↗</a>
      </div>
    </>}
  </section>
}
