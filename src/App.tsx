import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Aperture, Box, ChevronDown, CircleGauge, Crosshair, Database, Expand, Grid3X3,
  Info, Layers3, LocateFixed, Map, Menu, Moon, Orbit, PanelLeftClose, PanelRightClose,
  Search, Settings2, Sparkles, X, ZoomIn,
} from 'lucide-react'
import { MoonScene } from './components/MoonScene'
import { SouthPoleScene } from './components/SouthPoleScene'
import { SceneBoundary } from './components/SceneBoundary'
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
  const [selected, setSelected] = useState<LunarFeature | null>(null)
  const [coordinates, setCoordinates] = useState<Coordinates>({ latitude: 9.62, longitude: -20.08 })
  const [surfaceStyle, setSurfaceStyle] = useState<SurfaceStyle>('surface')
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [gridVisible, setGridVisible] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 1040)
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth > 1040)
  const [dataOpen, setDataOpen] = useState(false)
  const [lightAngle, setLightAngle] = useState(38)
  const [exaggeration, setExaggeration] = useState(2)
  const [resetKey, setResetKey] = useState(0)
  const [globalReady, setGlobalReady] = useState(false)
  const [polarReady, setPolarReady] = useState(false)
  const [polarMounted, setPolarMounted] = useState(false)
  const readyGlobal = useCallback(() => setGlobalReady(true), [])
  const readyPolar = useCallback(() => setPolarReady(true), [])
  useEffect(() => {
    const onKey = (event:KeyboardEvent) => {if(event.key==='Escape'){setSearchOpen(false);setDataOpen(false)}}
    window.addEventListener('keydown',onKey)
    return () => window.removeEventListener('keydown',onKey)
  }, [])
  const viewport = useRef<HTMLDivElement>(null)

  const searchResults = useMemo(() => LUNAR_FEATURES.filter((feature) => feature.name.toLowerCase().includes(query.toLowerCase())), [query])

  function chooseFeature(feature: LunarFeature) {
    if (mode === 'south-pole' && feature.latitude > -85) setMode('global')
    setSelected(feature)
    setCoordinates({ latitude: feature.latitude, longitude: feature.longitude })
    setSearchOpen(false)
    setQuery('')
  }

  function enterMode(nextMode: ExplorerMode) {
    setMode(nextMode)
    if (nextMode === 'south-pole') {
      setPolarMounted(true)
      chooseFeature(LUNAR_FEATURES.find((feature) => feature.id === 'shackleton')!)
    } else {
      setSelected(null)
      setResetKey(value=>value+1)
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
          <div className="phase-badge">PHASE 02</div>
        </div>
        <div className="topbar__telemetry">
          <div className="telemetry-item"><span>REFERENCE FRAME</span><strong>MOON / IAU</strong></div>
          <div className="telemetry-item"><span>LATITUDE</span><strong>{formatLatitude(coordinates.latitude)}</strong></div>
          <div className="telemetry-item"><span>LONGITUDE</span><strong>{formatLongitude(coordinates.longitude)}</strong></div>
          <div className="telemetry-item data-state"><span className="status-dot" />NASA SURFACE ATLAS</div>
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
        <SceneBoundary><div className={`viewport__scene scene-layer ${mode === 'global' ? 'is-active' : ''}`}>
            <MoonScene
              lightAngle={lightAngle} resetKey={resetKey} onReady={readyGlobal}
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
          {polarMounted && <SouthPoleScene surfaceStyle={surfaceStyle} active={mode === 'south-pole'} selected={selected} onSelect={chooseFeature} labelsVisible={labelsVisible} lightAngle={lightAngle} exaggeration={exaggeration} resetKey={resetKey} onReady={readyPolar} onSelectCoordinates={value=>{setCoordinates(value);setSelected(null)}} />}
        </div></SceneBoundary>
        {!(mode==='global'?globalReady:polarReady)&&<div className="scene-loading"><span className="loading-orbit"/><strong>{mode==='global'?'Loading the lunar surface':'Loading South Pole elevation'}</strong><small>NASA / LRO · verified raster assets</small></div>}

        <div className="scene-heading">
          <div className="eyebrow"><span /> {mode === 'global' ? 'GLOBAL LUNAR RECONNAISSANCE' : 'REGIONAL EXPLORATION MODE'}</div>
          <h1>{mode === 'global' ? 'Lunar Explorer' : 'Lunar South Pole'}</h1>
          <p>{mode === 'global' ? 'LROC color mosaic / LOLA surface relief' : 'LOLA elevation atlas / 85°S–90°S'}</p>
        </div>

        <div className="mode-switch" role="group" aria-label="Explorer mode">
          <button className={mode === 'global' ? 'is-active' : ''} onClick={() => enterMode('global')}><Moon size={15} /> GLOBAL</button>
          <button className={mode === 'south-pole' ? 'is-active' : ''} onClick={() => enterMode('south-pole')}><Crosshair size={15} /> SOUTH POLE</button>
        </div>

        {(
          <div className="scene-tools">
            <button className={surfaceStyle === 'surface' ? 'is-active' : ''} onClick={() => setSurfaceStyle('surface')} title="Realistic surface"><Aperture size={16} /></button>
            {mode==='global'&&<button className={surfaceStyle === 'relief' ? 'is-active' : ''} onClick={() => setSurfaceStyle('relief')} title="Enhanced visual relief"><Layers3 size={16} /></button>}
            <button className={surfaceStyle === 'elevation' ? 'is-active' : ''} onClick={() => setSurfaceStyle('elevation')} title="LOLA elevation colors"><Map size={16}/></button>
            <div className="tool-divider" />
            <button className={labelsVisible ? 'is-active' : ''} onClick={() => setLabelsVisible((value) => !value)} title="Toggle labels"><LocateFixed size={16} /></button>
            {mode==='global'&&<button className={gridVisible ? 'is-active' : ''} onClick={() => setGridVisible((value) => !value)} title="Toggle coordinate grid"><Grid3X3 size={16} /></button>}
            <button onClick={()=>setResetKey(value=>value+1)} title="Reset camera"><Orbit size={16}/></button>
          </div>
        )}

        <div className="interaction-hint">
          <span><i className="mouse-icon" />DRAG TO ORBIT</span><span><ZoomIn size={13} />SCROLL TO ZOOM</span><span><LocateFixed size={13} />SELECT SURFACE</span>
        </div>

        <div className="surface-caption"><span>01 / {mode==='global'?'ORBITAL PERSPECTIVE':'POLAR TERRAIN'}</span><strong>{mode==='global'?'The Moon, in detail.':'A landscape at the edge of light.'}</strong><small>{mode==='global'?'NASA LROC · 8K imagery · LOLA displacement':'NASA LOLA · 40 m source · 160 m resampled grid'}</small></div>
        {surfaceStyle==='elevation'&&<div className="elevation-legend"><span>LOLA HEIGHT / km</span><i/><div><b>−10</b><b>0</b><b>+12</b></div><small>Above the 1,737.4 km reference sphere</small></div>}
        <div className="view-controls"><label><span>INSPECTION LIGHT</span><input aria-label="Inspection light angle" type="range" min="0" max="100" value={lightAngle} onChange={e=>setLightAngle(Number(e.target.value))}/><output>{lightAngle}°</output></label>
          {mode==='south-pole'&&<label><span>VERTICAL SCALE</span><select aria-label="Vertical exaggeration" value={exaggeration} onChange={e=>setExaggeration(Number(e.target.value))}><option value={1}>1× actual scale</option><option value={2}>2× relief</option><option value={3}>3× relief</option></select></label>}
          <small>Lighting for surface inspection · not a time simulation</small>
        </div>
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
            <span>{mode==='global'?'LUNAR RECONNAISSANCE':'SURFACE COORDINATE'}</span>
            <h2>{formatLatitude(coordinates.latitude)}</h2>
            <h2>{formatLongitude(coordinates.longitude)}</h2>
            <p>Explore the surface. Select a landmark or search the lunar feature index to begin.</p>
            <button className="dialog-close" onClick={()=>setSearchOpen(true)}>FIND A LUNAR LOCATION</button>
          </div>
        )}
        <div className="panel-disclaimer"><Sparkles size={13} /><span>NASA surface visualization. Lighting is adjustable for inspection. Terrain is not evaluated for landing suitability.</span></div>
      </aside>

      {!rightOpen && <button className="restore-panel restore-right" onClick={() => setRightOpen(true)} aria-label="Open detail panel"><Info size={16} /></button>}

      <footer className={`bottom-status ${!leftOpen ? 'bottom-status--wide-left' : ''} ${!rightOpen ? 'bottom-status--wide-right' : ''}`}>
        <div className="status-segment"><span>RENDER PIPELINE</span><strong><i className="status-dot" /> {(mode==='global'?globalReady:polarReady)?'SURFACE READY':'LOADING'}</strong></div>
        <div className="status-segment"><span>SURFACE MODEL</span><strong>{mode === 'global' ? 'LROC / LOLA' : 'LOLA POLAR DEM'}</strong></div>
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
            <div className="dialog-heading"><div><small>PHASE 02 / SURFACE ATLAS</small><h2>Data Integration Status</h2></div><button aria-label="Close data status" onClick={() => setDataOpen(false)}><X size={18} /></button></div>
            <div className="data-row is-ready"><span><Database size={17} /></span><div><strong>IAU / USGS Gazetteer references</strong><small>Feature centers, names, classifications, diameters</small></div><i>READY</i></div>
            <div className="data-row is-ready"><span><Box size={17} /></span><div><strong>LROC 8K color / global LOLA relief</strong><small>NASA SVS CGI Moon Kit · 2019 visualization mosaic</small></div><i>INTEGRATED</i></div>
            <div className="data-row is-ready"><span><Layers3 size={17}/></span><div><strong>South Pole LOLA elevation · V2.0</strong><small>40 m source → 160 m grid · ~474 m mesh · DE421</small></div><i>INTEGRATED</i></div>
            <div className="data-row"><span><CircleGauge size={17} /></span><div><strong>Scientific analysis engines</strong><small>No synthetic analysis exposed in this foundation</small></div><i>NOT ACTIVE</i></div>
            <div className="integrity-note"><Info size={15} /><p><strong>Source and rendering limits</strong>Color is a NASA visualization mosaic with polar infill. Elevation is gridded and interpolated from LOLA observations; browser derivatives are resampled. Regional vertical scale is selectable. Light direction is illustrative.</p></div>
            <div className="source-links"><a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noreferrer">NASA source ↗</a><a href="/lunar/ldem_85s_40m.lbl" target="_blank" rel="noreferrer">PDS product label ↗</a><a href="/lunar/manifest.json" target="_blank" rel="noreferrer">Provenance & checksums ↗</a></div>
            <button className="dialog-close" onClick={() => setDataOpen(false)}>RETURN TO EXPLORER</button>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
