import { useMemo, useRef, useState } from 'react'
import {
  Aperture, Box, ChevronDown, CircleGauge, Crosshair, Database, Expand, Grid3X3,
  Info, Layers3, LocateFixed, Map, Menu, Moon, Orbit, PanelLeftClose, PanelRightClose,
  Search, Settings2, Sparkles, X, ZoomIn,
} from 'lucide-react'
import { MoonScene } from './components/MoonScene'
import { SouthPoleScene } from './components/SouthPoleScene'
import { LUNAR_FEATURES, SOUTH_POLE_FEATURES } from './data/lunarFeatures'
import type { Coordinates, ExplorerMode, LunarFeature, SurfaceStyle } from './domain/lunar'
import { formatLatitude, formatLongitude } from './lib/lunarCoordinates'

const FUTURE_MODULES = [
  'Mission Overview', 'Sun Analysis', 'Earth Communication', 'Terrain Intelligence',
  'Thermal Analysis', 'Water Ice & Resources', 'Mission Configuration',
  'Landing Optimization', 'Landing Simulation', 'Risk Assessment', 'Mission Reports',
]

function AlphaMark() {
  return (
    <div className="alpha-mark" aria-hidden="true">
      <span className="alpha-mark__orbit" />
      <span className="alpha-mark__moon" />
      <span className="alpha-mark__vector" />
    </div>
  )
}

function App() {
  const [mode, setMode] = useState<ExplorerMode>('global')
  const [selected, setSelected] = useState<LunarFeature | null>(LUNAR_FEATURES.find((feature) => feature.id === 'copernicus') ?? null)
  const [coordinates, setCoordinates] = useState<Coordinates>({ latitude: 9.62, longitude: -20.08 })
  const [surfaceStyle, setSurfaceStyle] = useState<SurfaceStyle>('surface')
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [gridVisible, setGridVisible] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 1040)
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth > 1040)
  const [dataOpen, setDataOpen] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)

  const searchResults = useMemo(() => LUNAR_FEATURES.filter((feature) => feature.name.toLowerCase().includes(query.toLowerCase())), [query])

  function chooseFeature(feature: LunarFeature) {
    setSelected(feature)
    setCoordinates({ latitude: feature.latitude, longitude: feature.longitude })
    setSearchOpen(false)
    setQuery('')
  }

  function enterMode(nextMode: ExplorerMode) {
    setMode(nextMode)
    if (nextMode === 'south-pole') {
      chooseFeature(LUNAR_FEATURES.find((feature) => feature.id === 'shackleton')!)
    }
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await viewport.current?.requestFullscreen()
    else await document.exitFullscreen()
  }

  return (
    <div className="app-shell" ref={viewport}>
      <header className="topbar">
        <div className="brand">
          <button className="icon-button mobile-menu" onClick={() => setLeftOpen((value) => !value)} aria-label="Toggle navigation"><Menu size={17} /></button>
          <AlphaMark />
          <div className="brand__type">
            <span>ALPHA</span><strong>LUNAR</strong>
            <small>MISSION INTELLIGENCE</small>
          </div>
          <div className="phase-badge">PHASE 01</div>
        </div>
        <div className="topbar__telemetry">
          <div className="telemetry-item"><span>REFERENCE FRAME</span><strong>MOON / IAU</strong></div>
          <div className="telemetry-item"><span>LATITUDE</span><strong>{formatLatitude(coordinates.latitude)}</strong></div>
          <div className="telemetry-item"><span>LONGITUDE</span><strong>{formatLongitude(coordinates.longitude)}</strong></div>
          <div className="telemetry-item data-state"><span className="status-dot" />REFERENCE DATA READY</div>
        </div>
        <div className="topbar__actions">
          <button className="icon-button" aria-label="Open location search" onClick={() => setSearchOpen(true)}><Search size={17} /></button>
          <button className="icon-button" aria-label="Open data status" onClick={() => setDataOpen(true)}><Database size={17} /></button>
          <button className="icon-button" aria-label="Enter fullscreen" onClick={toggleFullscreen}><Expand size={17} /></button>
        </div>
      </header>

      <aside className={`left-rail ${leftOpen ? '' : 'is-collapsed'}`}>
        <div className="rail-content">
          <div className="rail-section-label">EXPLORATION</div>
          <button className={`nav-module ${mode === 'global' ? 'is-active' : ''}`} onClick={() => enterMode('global')}>
            <span className="nav-module__icon"><Orbit size={17} /></span><span><strong>Lunar Explorer</strong><small>Global orbital view</small></span>
          </button>
          <button className={`nav-module ${mode === 'south-pole' ? 'is-active' : ''}`} onClick={() => enterMode('south-pole')}>
            <span className="nav-module__icon"><Crosshair size={17} /></span><span><strong>South Pole Command</strong><small>Regional terrain view</small></span>
          </button>
          <div className="rail-section-label future-label">MISSION SYSTEMS <span>ROADMAP</span></div>
          <div className="future-modules">
            {FUTURE_MODULES.map((item, index) => (
              <div className="future-module" key={item}><span>{String(index + 3).padStart(2, '0')}</span>{item}</div>
            ))}
          </div>
        </div>
        <div className="rail-footer">
          <div><span className="status-dot" />SYSTEM NOMINAL</div>
          <button className="collapse-button" onClick={() => setLeftOpen(false)}><PanelLeftClose size={15} /> Collapse</button>
        </div>
      </aside>

      {!leftOpen && <button className="restore-panel restore-left" onClick={() => setLeftOpen(true)} aria-label="Open navigation"><Menu size={16} /></button>}

      <main className={`viewport ${!leftOpen ? 'viewport--wide-left' : ''} ${!rightOpen ? 'viewport--wide-right' : ''}`}>
        <div className={`viewport__scene scene-layer ${mode === 'global' ? 'is-active' : ''}`}>
            <MoonScene
              active={mode === 'global'}
              selected={selected}
              coordinates={coordinates}
              surfaceStyle={surfaceStyle}
              labelsVisible={labelsVisible}
              gridVisible={gridVisible}
              onSelectFeature={chooseFeature}
              onSelectCoordinates={(value) => { setCoordinates(value); setSelected(null) }}
            />
        </div>
        <div className={`viewport__scene scene-layer ${mode === 'south-pole' ? 'is-active' : ''}`}>
          <SouthPoleScene active={mode === 'south-pole'} selected={selected} onSelect={chooseFeature} />
        </div>

        <div className="scene-heading">
          <div className="eyebrow"><span /> {mode === 'global' ? 'GLOBAL LUNAR RECONNAISSANCE' : 'REGIONAL EXPLORATION MODE'}</div>
          <h1>{mode === 'global' ? 'Lunar Explorer' : 'Lunar South Pole'}</h1>
          <p>{mode === 'global' ? 'IAU geographical reference layer · interactive globe' : 'High-detail visual terrain preview · 84°S–90°S'}</p>
        </div>

        <div className="mode-switch" role="group" aria-label="Explorer mode">
          <button className={mode === 'global' ? 'is-active' : ''} onClick={() => enterMode('global')}><Moon size={15} /> GLOBAL</button>
          <button className={mode === 'south-pole' ? 'is-active' : ''} onClick={() => enterMode('south-pole')}><Crosshair size={15} /> SOUTH POLE</button>
        </div>

        {mode === 'global' && (
          <div className="scene-tools">
            <button className={surfaceStyle === 'surface' ? 'is-active' : ''} onClick={() => setSurfaceStyle('surface')} title="Realistic surface"><Aperture size={16} /></button>
            <button className={surfaceStyle === 'relief' ? 'is-active' : ''} onClick={() => setSurfaceStyle('relief')} title="Enhanced visual relief"><Layers3 size={16} /></button>
            <div className="tool-divider" />
            <button className={labelsVisible ? 'is-active' : ''} onClick={() => setLabelsVisible((value) => !value)} title="Toggle labels"><LocateFixed size={16} /></button>
            <button className={gridVisible ? 'is-active' : ''} onClick={() => setGridVisible((value) => !value)} title="Toggle coordinate grid"><Grid3X3 size={16} /></button>
          </div>
        )}

        <div className="interaction-hint">
          <span><i className="mouse-icon" />DRAG TO ORBIT</span><span><ZoomIn size={13} />SCROLL TO ZOOM</span><span><LocateFixed size={13} />SELECT SURFACE</span>
        </div>

        {mode === 'south-pole' && (
          <div className="preview-notice"><Info size={14} /><span><strong>VISUAL TERRAIN PREVIEW</strong> Relief is procedural—not a measured elevation product. LOLA/SLDEM ingestion is reserved for Phase 2.</span></div>
        )}
      </main>

      <aside className={`right-panel ${rightOpen ? '' : 'is-collapsed'}`}>
        <div className="panel-topline"><span>LOCATION INTELLIGENCE</span><button onClick={() => setRightOpen(false)} aria-label="Close detail panel"><PanelRightClose size={16} /></button></div>
        {selected ? (
          <div className="location-detail">
            <div className="location-index">SELECTED FEATURE / {selected.id.toUpperCase().replaceAll('-', '_')}</div>
            <div className="location-title">
              <div><small>{selected.kind}</small><h2>{selected.name}</h2></div>
              <span className="feature-symbol"><Crosshair size={21} /></span>
            </div>
            <p className="location-summary">{selected.summary}</p>
            <div className="coordinate-block">
              <div><span>LATITUDE</span><strong>{formatLatitude(selected.latitude)}</strong></div>
              <div><span>LONGITUDE</span><strong>{formatLongitude(selected.longitude)}</strong></div>
              <div><span>DIAMETER</span><strong>{selected.diameterKm ? `${selected.diameterKm.toLocaleString()} km` : '—'}</strong></div>
              <div><span>CLASS</span><strong>{selected.kind.toUpperCase()}</strong></div>
            </div>
            <div className="provenance-card">
              <div className="provenance-card__head"><Database size={14} /><span>REFERENCE PROVENANCE</span><i>VERIFIED</i></div>
              <p>Feature center and classification follow the IAU/USGS Gazetteer of Planetary Nomenclature.</p>
              <a href={selected.gazetteerUrl} target="_blank" rel="noreferrer">OPEN GAZETTEER RECORD <span>↗</span></a>
            </div>
            {mode === 'south-pole' && (
              <div className="regional-list">
                <div className="panel-section-title"><span>NEARBY LANDMARKS</span><small>{SOUTH_POLE_FEATURES.length} INDEXED</small></div>
                {SOUTH_POLE_FEATURES.map((feature) => (
                  <button key={feature.id} className={selected.id === feature.id ? 'is-active' : ''} onClick={() => chooseFeature(feature)}>
                    <span className="landmark-dot" /><span><strong>{feature.name}</strong><small>{formatLatitude(feature.latitude)} · {formatLongitude(feature.longitude)}</small></span><i>›</i>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="coordinate-selection">
            <Crosshair size={32} />
            <span>SURFACE COORDINATE</span>
            <h2>{formatLatitude(coordinates.latitude)}</h2>
            <h2>{formatLongitude(coordinates.longitude)}</h2>
            <p>No named feature selected. Choose a label or search the lunar gazetteer layer.</p>
          </div>
        )}
        <div className="panel-disclaimer"><Sparkles size={13} /><span>Visualization foundation only. No landing suitability or scientific analysis is calculated in Phase 1.</span></div>
      </aside>

      {!rightOpen && <button className="restore-panel restore-right" onClick={() => setRightOpen(true)} aria-label="Open detail panel"><Info size={16} /></button>}

      <footer className={`bottom-status ${!leftOpen ? 'bottom-status--wide-left' : ''} ${!rightOpen ? 'bottom-status--wide-right' : ''}`}>
        <div className="status-segment"><span>RENDER PIPELINE</span><strong><i className="status-dot" /> WEBGL ACTIVE</strong></div>
        <div className="status-segment"><span>SURFACE MODEL</span><strong>{mode === 'global' ? 'PROCEDURAL GLOBAL' : 'PROCEDURAL REGIONAL'}</strong></div>
        <div className="status-segment"><span>GAZETTEER</span><strong>{LUNAR_FEATURES.length} FEATURES LOADED</strong></div>
        <div className="status-grow" />
        <button onClick={() => setDataOpen(true)}><Database size={13} /> DATA INTEGRATION STATUS <ChevronDown size={13} /></button>
      </footer>

      {searchOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSearchOpen(false)}>
          <section className="search-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div className="search-input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lunar features…" /><kbd>ESC</kbd><button onClick={() => setSearchOpen(false)}><X size={17} /></button></div>
            <div className="search-meta"><span>IAU FEATURE INDEX</span><small>{searchResults.length} RESULTS</small></div>
            <div className="search-results">
              {searchResults.map((feature) => (
                <button key={feature.id} onClick={() => chooseFeature(feature)}>
                  <span className="search-result__icon"><Map size={16} /></span>
                  <span><strong>{feature.name}</strong><small>{feature.kind} · {formatLatitude(feature.latitude)} / {formatLongitude(feature.longitude)}</small></span>
                  <i>GO TO ↗</i>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {dataOpen && (
        <div className="modal-backdrop" onMouseDown={() => setDataOpen(false)}>
          <section className="data-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-heading"><div><small>PHASE 01 / SYSTEM</small><h2>Data Integration Status</h2></div><button onClick={() => setDataOpen(false)}><X size={18} /></button></div>
            <div className="data-row is-ready"><span><Database size={17} /></span><div><strong>IAU / USGS Gazetteer references</strong><small>Feature centers, names, classifications, diameters</small></div><i>READY</i></div>
            <div className="data-row"><span><Box size={17} /></span><div><strong>LRO / LOLA elevation products</strong><small>Adapter boundary prepared · ingestion begins Phase 2</small></div><i>QUEUED</i></div>
            <div className="data-row"><span><CircleGauge size={17} /></span><div><strong>Scientific analysis engines</strong><small>No synthetic analysis exposed in this foundation</small></div><i>NOT ACTIVE</i></div>
            <div className="integrity-note"><Info size={15} /><p><strong>Scientific integrity boundary</strong>The rendered albedo and regional relief are procedural visual assets. They are never presented as measured topography, illumination, hazard, or resource data.</p></div>
            <button className="dialog-close" onClick={() => setDataOpen(false)}>RETURN TO EXPLORER</button>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
