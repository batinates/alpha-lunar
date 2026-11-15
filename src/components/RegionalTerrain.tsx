import { useLanguage } from '../lib/i18n'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide } from 'three'
import { X } from 'lucide-react'
import { SceneBoundary } from './SceneBoundary'

interface Level { file: string; width: number; sha256: string }
interface Site {
  id: string; name: string; x: number; z: number; size: number; reference: string
  comparison: { elevationCells: number; elevationRmseMeters: number; slopeRmseDeg: number }
  levels: Record<'20' | '80', Level>
}
const assetRoot = '/lunar/regional/'
const NO_DATA = -32768
function TerrainProducts({ grid, width, spacing }: { grid: Int16Array; width: number; spacing: number }) {
  const { t } = useLanguage()
  const elevation = useRef<HTMLCanvasElement>(null), slope = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const size = 160
    const a = elevation.current?.getContext('2d'), b = slope.current?.getContext('2d')
    if (!a || !b) return
    let min = Infinity, max = -Infinity
    for (const n of grid) if (n !== NO_DATA) { min = Math.min(min, n); max = Math.max(max, n) }
    const height = a.createImageData(size, size), gradient = b.createImageData(size, size)
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = Math.max(1, Math.min(width - 2, Math.floor((i + .5) * width / size)))
      const y = Math.max(1, Math.min(width - 2, Math.floor((j + .5) * width / size)))
      const k = y * width + x, cell = (j * size + i) * 4
      const z = grid[k]
      const color = z === NO_DATA ? 0 : Math.round(255 * (z - min) / Math.max(1, max - min))
      height.data.set([color * .65, color * .84, color, 255], cell)
      const neighbors = [grid[k - 1], grid[k + 1], grid[k - width], grid[k + width]]
      const angle = z === NO_DATA || neighbors.includes(NO_DATA) ? 0 :
        Math.atan(Math.hypot(neighbors[1] - neighbors[0], neighbors[3] - neighbors[2]) / (4 * spacing)) * 180 / Math.PI
      const shade = Math.min(255, angle / 45 * 255)
      gradient.data.set([shade, shade * .65, shade * .28, 255], cell)
    }
    a.putImageData(height, 0, 0)
    b.putImageData(gradient, 0, 0)
  }, [grid, width, spacing])
  return <div className="terrain-products">
    <figure><figcaption>{t('Relative elevation · darker is lower')}</figcaption><canvas ref={elevation} width="160" height="160" aria-label={t('Regional relative elevation map')} /></figure>
    <figure><figcaption>{t('Slope · 0–45° color scale')}</figcaption><canvas ref={slope} width="160" height="160" aria-label={t('Regional slope map')} /></figure>
  </div>
}
const cache = new Map<string, Promise<Int16Array>>()
function loadLevel(level: Level) {
  let task = cache.get(level.file)
  if (!task) {
    task = fetch(assetRoot + level.file).then(async response => {
      if (!response.ok) throw new Error('Terrain tile unavailable')
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength !== level.width ** 2 * 2) throw new Error('Invalid terrain tile dimensions')
      const bytes = new DataView(buffer)
      return Int16Array.from({ length: level.width ** 2 }, (_, index) => bytes.getInt16(index * 2, true))
    }).catch(error => { cache.delete(level.file); throw error })
    cache.set(level.file, task)
  }
  return task
}

function RegionMesh({ grid, width, size, onZoom }: { grid: Int16Array; width: number; size: number; onZoom: (close: boolean) => void }) {
  const previous = useRef(false)
  useFrame(({ camera }) => {
    const distance = camera.position.length()
    const close = previous.current ? distance < 15 : distance < 12
    if (close !== previous.current) {
      previous.current = close
      onZoom(close)
    }
  })
  const geometry = useMemo(() => {
    const positions = new Float32Array(grid.length * 3)
    const indices = []
    const vertex = (row: number, col: number) => row * width + col
    const terrain = new BufferGeometry()
    for (let row = 0; row < width; row++) {
      for (let col = 0; col < width; col++) {
        const i = vertex(row, col)
        positions[i * 3] = ((col + .5) / width - .5) * size / 1000
        positions[i * 3 + 1] = grid[i] === NO_DATA ? 0 : grid[i] / 2000
        positions[i * 3 + 2] = ((row + .5) / width - .5) * size / 1000
        if (row === 0 || col === 0) continue
        const a = i - width - 1, b = i - width, c = i - 1
        if (grid[a] !== NO_DATA && grid[b] !== NO_DATA && grid[c] !== NO_DATA) indices.push(a, c, b)
        if (grid[b] !== NO_DATA && grid[c] !== NO_DATA && grid[i] !== NO_DATA) indices.push(b, c, i)
      }
    }
    terrain.setAttribute('position', new BufferAttribute(positions, 3))
    terrain.setIndex(indices)
    terrain.computeVertexNormals()
    return terrain
  }, [grid, width, size])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry}><meshStandardMaterial color="#8393a1" side={DoubleSide} roughness={1} /></mesh>
}

export function RegionalTerrain({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const [sites, setSites] = useState<Site[]>([])
  const [id, setId] = useState('04')
  const [zoom, setZoom] = useState(false)
  const [retry, setRetry] = useState(0)
  const [grid, setGrid] = useState<{ id: string; spacing: '20' | '80'; data: Int16Array } | null>(null)
  const [error, setError] = useState('')
  const site = sites.find(item => item.id === id)
  const requested = zoom ? '20' : '80'
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  useEffect(() => {
    if (!open || sites.length) return
    const controller = new AbortController()
    setError('')
    fetch(assetRoot + 'manifest.json', { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error()
      return response.json()
    }).then(data => { if (!controller.signal.aborted) setSites(data.sites) }).catch(() => {
      if (!controller.signal.aborted) setError('Regional catalog unavailable.')
    })
    return () => controller.abort()
  }, [open, sites.length, retry])
  useEffect(() => {
    if (!open || !site) return
    let active = true
    setError('')
    loadLevel(site.levels[requested]).then(data => {
      if (active) setGrid({ id: site.id, spacing: requested, data })
    }, () => { if (active) setError('Terrain tile unavailable. You can retry the request.') })
    return () => { active = false }
  }, [open, site, requested, retry])
  const current = grid?.id === id ? grid : null

  return <dialog className="mission-dialog descent-dialog" ref={dialog} aria-labelledby="regional-title"
    onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="mission-shell">
      <header className="mission-header"><h2 id="regional-title">{t('Regional Terrain Detail')}</h2><button className="icon-button" aria-label={t('Close terrain detail')} onClick={onClose}><X size={18} /></button></header>
      <div className="mission-body">
        {sites.length > 0 && <label className="descent-select">{t('LOLA region')} <select value={id} onChange={event => { setId(event.target.value); setZoom(false) }}>
          {sites.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>}
        {error && <p role="alert">{t(error)} <button className="analysis-action" onClick={() => setRetry(value => value + 1)}>{t('Retry')}</button></p>}
        {!error && (!current || requested !== current.spacing) && <p role="status">{t('Loading')} {requested} m terrain…</p>}
        {open && site && current && <div className="descent-scene" aria-label={t('Regional terrain 3D view')}>
          <SceneBoundary><Canvas key={id} frameloop="demand" dpr={[1,1.3]} camera={{ position: [13, 11, 14], near: .02, far: 100 }}>
            <color attach="background" args={['#08111b']} />
            <ambientLight intensity={.7} />
            <directionalLight position={[4,5,-2]} intensity={2.4} />
            <RegionMesh grid={current.data} width={site.levels[current.spacing].width} size={site.size} onZoom={setZoom} />
            <OrbitControls enablePan={false} enableDamping minDistance={2} maxDistance={38} maxPolarAngle={Math.PI / 2} />
          </Canvas></SceneBoundary>
        </div>}
        {site && <><p>{current ? `${current.spacing} m display grid · ` : ''}{t('16 × 16 km patch. Orbit and zoom to change the detail level. Surface relief derives from the 5 m LOLA elevation source.')}</p>
          {current && <details className="mission-candidate"><summary>{t('Compare elevation and slope')}</summary>
            <TerrainProducts grid={current.data} width={site.levels[current.spacing].width} spacing={Number(current.spacing)} />
          </details>}
          <p>{t('Matched 160 m comparison across')} {site.comparison.elevationCells.toLocaleString()} {t('cells. Elevation RMSE')} {site.comparison.elevationRmseMeters.toFixed(2)} m. Slope RMSE {site.comparison.slopeRmseDeg.toFixed(2)}°.</p>
          <p>{t('Mission screening retains the consistent 160 m regional DEM.')}</p>
          <a href={assetRoot + 'manifest.json'} target="_blank" rel="noreferrer">{t('Data manifest and checksums ↗')}</a> · <a href={site.reference} target="_blank" rel="noreferrer">{t('NASA source GeoTIFF ↗')}</a></>}
      </div>
    </div>
  </dialog>
}
