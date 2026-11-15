import { useLanguage } from './lib/i18n'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Aperture, BookOpen, Box, ChevronDown, CircleGauge, Crosshair, Database, Expand, Grid3X3,
  Info, Layers3, LocateFixed, Map, Menu, Moon, Orbit, PanelLeftClose, PanelRightClose,
  Search, Settings2, Sparkles, Sun, X, ZoomIn, Mountain, Snowflake, Thermometer, Rocket, ShieldAlert, Navigation, FileText, Radio, Library, Presentation,
} from 'lucide-react'
import { MoonScene } from './components/MoonScene'
import { LunarMissions } from './components/LunarMissions'
import { APOLLO_SITES, type OrbiterId } from './data/spacecraft'
import { ARTEMIS_DATA_SOURCES, ARTEMIS_MISSIONS, ARTEMIS_TIMELINE, HISTORICAL_STUDY_SITES, architecture, artemisVehicles, hardwareIII, landers, operationsIII, regions2024, type ArtemisMission, type ArtemisSurfaceMission } from './data/artemis'
import type { ComparisonRequest, ComparisonResult } from './services/science/comparison.worker'
import { SceneBoundary } from './components/SceneBoundary'
import { DocumentationCenter } from './components/DocumentationCenter'
import { TimeExplorer } from './components/TimeExplorer'
import { MissionPlanner, type MissionView } from './components/MissionPlanner'
import { DescentLab, type DescentView } from './components/DescentLab'
import { MissionReports } from './components/MissionReports'
import { MissionOverview } from './components/MissionOverview'
import { EarthCommunication } from './components/EarthCommunication'
import { SurfacePower } from './components/SurfacePower'
import { SiteComparison, type ComparisonSeed } from './components/SiteComparison'
import { REGIONAL_STUDY_SITES } from './data/regionalStudySites'
import { coordinateKey, type CompareSite } from './services/science/siteComparison'
import type { ArchiveSite } from './services/science/siteArchive'
import { readReports, reportProvenance, writeReports, type MissionReport, type MissionReportInput, type SearchEvidence } from './domain/missionReport'
import { ARTEMIS, ROBOTIC, type MissionProfile } from './domain/mission'
import type { LandingOption } from './services/science/landingOptimization'
import { POLAR_ANALYSES, PolarAnalysisLegend, PolarAnalysisPanel, type PolarAnalysis } from './components/PolarAnalysisPanel'
import { LCROSS_IMPACT, loadPolarEnvironment, ENVIRONMENT_MANIFEST } from './services/science/polarEnvironment'
import { loadHeightRaster, latLonToPolar, POLAR_HALF_EXTENT, type HeightRaster } from './services/science/lunarAssets'
import { interpolateEphemeris, sceneSun, validateEphemeris, type Ephemeris } from './services/science/ephemeris'
import { LUNAR_FEATURES, SOUTH_POLE_FEATURES } from './data/lunarFeatures'
import type { Coordinates, ExplorerMode, LunarFeature, SurfaceStyle } from './domain/lunar'
import { formatLatitude, formatLongitude } from './lib/lunarCoordinates'
import type { MoonAction } from './services/moonAi'

const SouthPoleScene = lazy(() => import('./components/SouthPoleScene').then(module => ({ default: module.SouthPoleScene })))
const RegionalTerrain = lazy(() => import('./components/RegionalTerrain').then(module => ({ default: module.RegionalTerrain })))
const LandingSiteArchive = lazy(() => import('./components/LandingSiteArchive').then(module => ({ default: module.LandingSiteArchive })))
const ArtemisLaunchSystem = lazy(() => import('./components/ArtemisLaunchSystem').then(module => ({ default: module.ArtemisLaunchSystem })))
const MoonAi = lazy(() => import('./components/MoonAi').then(module => ({ default: module.MoonAi })))
const ANALYSIS_ICONS = { terrain: Mountain, thermal: Thermometer, ice: Snowflake }


function App() {
  const { t, language, setLanguage } = useLanguage()
  const [moonAiOpen, setMoonAiOpen] = useState(false)
  const [moonAiMounted, setMoonAiMounted] = useState(false)
  const [agentDescent, setAgentDescent] = useState<{ action: MoonAction; id: number } | null>(null)
  const [archiveStart, setArchiveStart] = useState<string>()
  const [missionView, setMissionView] = useState<MissionView | null>(null)
  const [missionProfile, setMissionProfile] = useState<MissionProfile>(ROBOTIC)
  const [descentView, setDescentView] = useState<DescentView | null>(null)
  const [descentArrival, setDescentArrival] = useState<{ option: LandingOption; profile: MissionProfile; search: SearchEvidence } | null>(null)
  const [reports, setReports] = useState(readReports)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [reportId, setReportId] = useState<string | null>(null)
  const [reportMessage, setReportMessage] = useState('')
  const [timeOpen,setTimeOpen]=useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [powerOpen, setPowerOpen] = useState(false)
  const [comparison, setComparison] = useState<ComparisonSeed | null>(null)
  const [powerStudy, setPowerStudy] = useState({ height: ROBOTIC.mastHeight, hours: ROBOTIC.durationHours })
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [artemisOpen, setArtemisOpen] = useState(false)
  const [lunarMissionsOpen, setLunarMissionsOpen] = useState(false)
  const [apollo, setApollo] = useState('11')
  const [orbiter, setOrbiter] = useState<OrbiterId>('lro')
  const [orbiterDetails, setOrbiterDetails] = useState(false)
  const [animateOrbit, setAnimateOrbit] = useState(true)
  const [regionalOpen, setRegionalOpen] = useState(false)
  const [regionalMounted, setRegionalMounted] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archiveSelection, setArchiveSelection] = useState<ArchiveSite | null>(null)
  const needsEphemeris = timeOpen || linkOpen || powerOpen || descentView === 'simulation'
  const [timeObserver, setTimeObserver] = useState({ height: 2, revision: 0 })
  const [ephemeris,setEphemeris]=useState<Ephemeris|null>(null)
  const [ephemerisError,setEphemerisError]=useState('')
  const [simulationTime,setSimulationTime]=useState(()=>Math.max(Date.parse('2026-01-01T00:00Z'),Math.min(Date.now(),Date.parse('2029-01-01T00:00Z'))))
  useEffect(()=>{
    if(!needsEphemeris||ephemeris)return
    const controller=new AbortController()
    setEphemerisError('')
    fetch('/lunar/ephemeris.json',{signal:controller.signal}).then(r=>{if(!r.ok)throw new Error('Ephemeris unavailable');return r.json()}).then(validateEphemeris).then(setEphemeris).catch(e=>{if(e.name!=='AbortError')setEphemerisError('SPICE data unavailable. Close and reopen to retry.')})
    return ()=>controller.abort()
  },[needsEphemeris,ephemeris])
  const sunDirection=useMemo(()=>timeOpen&&ephemeris?sceneSun(interpolateEphemeris(ephemeris,simulationTime).sun):undefined,[timeOpen,ephemeris,simulationTime])
  const [docsOpen, setDocsOpen] = useState(() => new URLSearchParams(window.location.search).get('view') === 'documentation')
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
  const [analysis, setAnalysis] = useState<PolarAnalysis | null>(null)
  const [focusCoordinates, setFocusCoordinates] = useState<Coordinates | null>(null)
  const [analysisRaster, setAnalysisRaster] = useState<HeightRaster | null>(null)
  const [environment, setEnvironment] = useState<DataView | null>(null)
  const [failedAnalysis, setFailedAnalysis] = useState<PolarAnalysis | null>(null)
  const [retryAnalysis, setRetryAnalysis] = useState(0)
  const readyGlobal = useCallback(() => setGlobalReady(true), [])
  const readyPolar = useCallback(() => setPolarReady(true), [])
  useEffect(() => {
    if (!analysis || (analysis === 'terrain' ? analysisRaster : environment)) return
    let active = true
    setFailedAnalysis(null)
    const load = analysis === 'terrain'
      ? loadHeightRaster('south-pole').then(value => { if (active) setAnalysisRaster(value) })
      : loadPolarEnvironment().then(value => { if (active) setEnvironment(value) })
    load.catch(() => { if (active) setFailedAnalysis(analysis) })
    return () => { active = false }
  }, [analysis, analysisRaster, environment, retryAnalysis])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return
      setSearchOpen(false)
      setDataOpen(false)
      setDocsOpen(false)
    }
    const onHistory = () => setDocsOpen(new URLSearchParams(window.location.search).get('view') === 'documentation')
    window.addEventListener('keydown',onKey)
    window.addEventListener('popstate',onHistory)
    return () => { window.removeEventListener('keydown',onKey); window.removeEventListener('popstate',onHistory) }
  }, [])
  const viewport = useRef<HTMLDivElement>(null)

  const searchResults = useMemo(() => LUNAR_FEATURES.filter((feature) => feature.name.toLowerCase().includes(query.toLowerCase())), [query])

  function chooseFeature(feature: LunarFeature) {
    setArchiveSelection(null)
    const { x, z } = latLonToPolar(feature.latitude, feature.longitude)
    if (mode === 'south-pole' && (Math.abs(x) > POLAR_HALF_EXTENT || Math.abs(z) > POLAR_HALF_EXTENT)) {
      setMode('global')
      setAnalysis(null)
    }
    setFocusCoordinates(null)
    setSelected(feature)
    setCoordinates({ latitude: feature.latitude, longitude: feature.longitude })
    setSearchOpen(false)
    setQuery('')
  }

  function focusApollo(id: string) {
    const site = APOLLO_SITES.find(item => item.id === id)
    if (!site) return
    const point = { latitude: site.latitude, longitude: site.longitude }
    setApollo(id)
    setMode('global')
    setSelected(null)
    setAnalysis(null)
    setArchiveSelection(null)
    setCoordinates(point)
    setFocusCoordinates(point)
  }

  function enterMode(nextMode: ExplorerMode) {
    setArchiveSelection(null)
    setAnalysis(null)
    setFocusCoordinates(null)
    setMode(nextMode)
    if (nextMode === 'south-pole') {
      setPolarMounted(true)
      chooseFeature(LUNAR_FEATURES.find((feature) => feature.id === 'shackleton')!)
    } else {
      setSelected(null)
      setResetKey(value=>value+1)
    }
  }

  function openAnalysis(next: PolarAnalysis) {
    if (mode !== 'south-pole') enterMode('south-pole')
    setAnalysis(next)
    setTimeOpen(false)
    setLinkOpen(false)
    setPowerOpen(false)
    if (window.innerWidth <= 1040) setLeftOpen(false)
  }

  function selectSurface(value: Coordinates) {
    setArchiveSelection(null)
    setCoordinates(value)
    setSelected(null)
    setFocusCoordinates(null)
  }

  function locateArchiveSite(site: ArchiveSite, screen: boolean) {
    if (site.lat === null || site.lon === null) return
    const point = { latitude: site.lat, longitude: site.lon }
    const { x, z } = latLonToPolar(point.latitude, point.longitude)
    const regional = Math.max(Math.abs(x), Math.abs(z)) < POLAR_HALF_EXTENT - 160
    setArchiveOpen(false)
    setAnalysis(null)
    setTimeOpen(false)
    setLinkOpen(false)
    setPowerOpen(false)
    setCoordinates(point)
    setArchiveSelection(site)
    setFocusCoordinates(regional ? point : null)
    setMode(regional ? 'south-pole' : 'global')
    if (regional) setPolarMounted(true)
    setSelected(null)
    if (screen && regional) setMissionView('optimize')
    else if (window.innerWidth > 1040) setRightOpen(true)
  }

  function openMission(view: MissionView) {
    if (view === 'optimize' && mode !== 'south-pole') enterMode('south-pole')
    setTimeOpen(false)
    setLinkOpen(false)
    setPowerOpen(false)
    setMissionView(view)
    if (window.innerWidth <= 1040) setLeftOpen(false)
  }

  function openLink() {
    setLunarMissionsOpen(false)
    setTimeOpen(false)
    setPowerOpen(false)
    setLinkOpen(true)
    if (window.innerWidth <= 1040) setLeftOpen(false)
  }

  function openPower(height = missionProfile.mastHeight, hours = missionProfile.durationHours) {
    setLunarMissionsOpen(false)
    setTimeOpen(false)
    setLinkOpen(false)
    setPowerStudy({ height, hours })
    setPowerOpen(true)
    if (window.innerWidth <= 1040) setLeftOpen(false)
  }

  function openComparison(arrivals: LandingOption[] = [], profile = missionProfile) {
    const candidates: CompareSite[] = arrivals.map(({ site, time }) => ({ ...site, id: 'arrival-' + site.id + '-' + time, arrival: time }))
    const mapSite = Math.abs(coordinates.latitude) >= 75 ? [{ ...coordinates, id: 'map', name: archiveSelection?.name ?? selected?.name ?? 'Selected map point' }] : []
    const northStudy = { id: 'north-reference', name: 'North polar study point', latitude: 89, longitude: 0 }
    const choices = [...candidates, ...mapSite, ...REGIONAL_STUDY_SITES, northStudy]
    const options = choices.filter((site, i) => choices.findIndex(s => s.id === site.id) === i)
    const distinct = options.filter((site, i) => options.findIndex(s => coordinateKey(s) === coordinateKey(site)) === i)
    setMissionView(null)
    setTimeOpen(false)
    setLinkOpen(false)
    setPowerOpen(false)
    setComparison({
      options, selection: distinct.slice(0, 2).map(site => site.id),
      time: arrivals[0]?.time ?? simulationTime,
      height: Number.isFinite(profile.mastHeight) && profile.mastHeight >= 0 && profile.mastHeight <= 100 ? profile.mastHeight : ROBOTIC.mastHeight,
      hours: Number.isInteger(profile.durationHours) && profile.durationHours >= 1 && profile.durationHours <= 672 ? profile.durationHours : ROBOTIC.durationHours,
    })
    if (window.innerWidth <= 1040) setLeftOpen(false)
  }

  function toggleTime() {
    setLunarMissionsOpen(false)
    setLinkOpen(false)
    setPowerOpen(false)
    setTimeOpen(value => !value)
  }

  function inspectArrival(option: LandingOption) {
    setArchiveSelection(null)
    setMissionView(null)
    setPolarMounted(true)
    setMode('south-pole')
    setAnalysis(null)
    setSelected(null)
    setCoordinates(option.site)
    setFocusCoordinates({ ...option.site })
    setSimulationTime(option.time)
    setTimeObserver(observer => ({ height: option.mastHeight, revision: observer.revision + 1 }))
    setTimeOpen(true)
    setPowerOpen(false)
  }

  function inspectArrivalPower(option: LandingOption, profile: MissionProfile) {
    inspectArrival(option)
    openPower(option.mastHeight, profile.durationHours)
  }

  function openDescent(view: DescentView) {
    setAgentDescent(null)
    if (mode !== 'south-pole') enterMode('south-pole')
    setDescentArrival(null)
    setTimeOpen(false)
    setLinkOpen(false)
    setPowerOpen(false)
    setDescentView(view)
    if (window.innerWidth <= 1040) setLeftOpen(false)
  }

  function simulateArrival(option: LandingOption, profile: MissionProfile, search: SearchEvidence) {
    setAgentDescent(null)
    setMissionView(null)
    setDescentArrival({ option, profile, search })
    setDescentView('simulation')
  }

  function updateReports(next: MissionReport[]) {
    setReports(next)
    try {
      writeReports(next)
      setReportMessage('')
    } catch {
      setReportMessage('Browser storage could not be updated. Download JSON to keep this report.')
    }
  }

  function createReport(input: MissionReportInput) {
    const report: MissionReport = { ...input, schema: 1, id: crypto.randomUUID(), createdAt: new Date().toISOString(), assets: reportProvenance }
    updateReports([report, ...reports])
    setReportId(report.id)
    setMissionView(null)
    setDescentView(null)
    setReportsOpen(true)
  }

  function openArtemisStudy(mission: ArtemisSurfaceMission, lander: string) {
    setArtemisOpen(false)
    openComparison()
    setComparison({ options: HISTORICAL_STUDY_SITES, selection: ['a3_haworth', 'a3_mons_mouton'],
      time: Date.parse(ARTEMIS_MISSIONS[mission].studyStart), height: ARTEMIS.mastHeight, hours: ARTEMIS.durationHours,
      artemis: { mission, lander } })
  }

  function openArtemisTime(mission: ArtemisSurfaceMission) {
    const site = HISTORICAL_STUDY_SITES.find(site => site.id === 'a3_haworth')!
    setArtemisOpen(false)
    enterMode('south-pole')
    setSelected(null)
    setCoordinates(site)
    setFocusCoordinates({ ...site })
    setSimulationTime(Date.parse(ARTEMIS_MISSIONS[mission].studyStart))
    setTimeObserver(observer => ({ height: ARTEMIS.mastHeight, revision: observer.revision + 1 }))
    setPowerOpen(false)
    setLinkOpen(false)
    setTimeOpen(true)
  }

  function saveArtemisReport(mission: ArtemisMission, settings?: ComparisonRequest, results?: ComparisonResult[]) {
    const plan = ARTEMIS_MISSIONS[mission]
    const sources: NonNullable<MissionReportInput['artemisReview']>['sources'] =
      [{ label: 'Published mission plan', name: 'NASA mission plan', detail: plan.updated, href: plan.source }]
    sources.push({ label: 'Published mission plan', name: 'NASA architecture update', detail: '2026-11-04', href: architecture })
    if (mission === 'III') sources.push({ label: 'Published mission plan', name: 'NASA rendezvous and docking operations', detail: '2026-10-23', href: operationsIII },
      { label: 'Published mission plan', name: 'NASA Artemis III rocket hardware', detail: '2026-08-05', href: hardwareIII })
    else sources.push({ label: 'Published mission plan', name: 'NASA lander alternatives', detail: '2026-10-23', href: landers },
      { label: 'Observation-derived data', name: 'Historical NASA study areas · 2024', detail: 'Region centroids, USGS P1MEQ6UK', href: regions2024 }, ...ARTEMIS_DATA_SOURCES)
    const site = settings?.sites[0]
    const evidence = settings && results ? { settings, sites: results.map(entry => {
      const result = 'result' in entry ? entry.result : null
      return { name: entry.site.name, latitude: entry.site.latitude, longitude: entry.site.longitude,
        environment: 'environment' in entry ? entry.environment : undefined,
        generatedWh: result && result.energy.unknownHours === 0 ? result.energy.generatedWh : null,
        lowestCharge: result?.energy.minimumPercent ?? null,
        sunHours: result?.sunVisibleHours ?? null,
        earthHours: result?.earthClearHours ?? null, radioHours: result?.linkHours ?? null }
    }) } : undefined
    setArtemisOpen(false)
    setComparison(null)
    createReport({
      profile: { ...ARTEMIS, name: `Artemis ${mission}` },
      name: settings ? 'Historical NASA study areas · 2024' : 'Published mission plan',
      coordinates: site ?? { latitude: 0, longitude: 0 },
      time: settings?.first ?? Date.now(), candidate: null,
      artemisReview: { mission, ...plan, sources, vehicles: artemisVehicles(mission), timeline: mission === 'III' ? ARTEMIS_TIMELINE : undefined,
        lander: evidence ? comparison?.artemis?.lander : undefined, comparison: evidence },
    })
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await viewport.current?.requestFullscreen()
    else await document.exitFullscreen()
  }

  function openDocumentation() {
    const url = new URL(window.location.href)
    url.searchParams.set('view', 'documentation')
    window.history.pushState({}, '', url)
    setDocsOpen(true)
  }

  function closeDocumentation() {
    const url = new URL(window.location.href)
    url.searchParams.delete('view')
    window.history.pushState({}, '', url)
    setDocsOpen(false)
  }

  function openMoonAi() {
    setMoonAiMounted(true)
    setMoonAiOpen(true)
    setTimeOpen(false)
    setLinkOpen(false)
    setPowerOpen(false)
    setLunarMissionsOpen(false)
    if (window.innerWidth <= 1040) setLeftOpen(false)
  }

  function followMoonAction(action: MoonAction) {
    setMoonAiOpen(false)
    if (action.time !== undefined) setSimulationTime(action.time)
    const site = action.site
    if (site) {
      const { x, z } = latLonToPolar(site.latitude, site.longitude)
      const inPolar = site.latitude < 0 && Math.max(Math.abs(x), Math.abs(z)) < POLAR_HALF_EXTENT - 160
      selectSurface(site)
      setFocusCoordinates(site)
      setMode(inPolar ? 'south-pole' : 'global')
      if (inPolar) setPolarMounted(true)
    }
    switch (action.module) {
      case 'map': break
      case 'archive': setArchiveStart(site?.id); setArchiveOpen(true); break
      case 'optimize':
        if (site) setMissionView('optimize')
        else openMission('optimize')
        break
      case 'settings': openMission('configure'); break
      case 'simulation':
      case 'risk':
        if (action.landing) simulateArrival(action.landing.option, action.landing.profile, action.landing.search)
        else if (site) { setDescentArrival(null); setDescentView(action.module) }
        else openDescent(action.module)
        if (site) {
          setAgentDescent({ action, id: Date.now() })
          setDescentView(action.module)
        }
        break
      case 'ice': case 'thermal': case 'terrain':
        if (site) setAnalysis(action.module)
        else openAnalysis(action.module)
        break
      case 'power': openPower(); break
      case 'radio': openLink(); break
      case 'time': setTimeOpen(true); break
      case 'comparison':
        if (action.comparison) setComparison({ options: action.comparison.sites, selection: action.comparison.sites.map(item => item.id),
          time: action.time ?? simulationTime, hours: action.comparison.hours, height: missionProfile.mastHeight })
        else openComparison()
        break
      case 'reports': setReportsOpen(true); break
      case 'artemis': setArtemisOpen(true); break
      case 'missions': focusApollo(apollo); setLunarMissionsOpen(true); break
      case 'regional': setRegionalMounted(true); setRegionalOpen(true); break
      case 'documentation': openDocumentation(); break
    }
  }

  return (
    <div className="app-shell" ref={viewport}>
      <header className="topbar">
        <div className="brand">
          <button className="icon-button mobile-menu" onClick={() => setLeftOpen((value) => !value)} aria-label={t('Toggle navigation')}><Menu size={17} /></button>
          <img className="alpha-mark" src="/alpha-lunar.svg" alt="" />
          <div className="brand__type">
            <span>ALPHA</span><strong>LUNAR</strong>
            <small>{t('MISSION INTELLIGENCE')}</small>
          </div>
        </div>
        <div className="topbar__telemetry">
          <div className="telemetry-item"><span>{t('REFERENCE FRAME')}</span><strong>MOON / IAU</strong></div>
          <div className="telemetry-item"><span>{t('LATITUDE')}</span><strong>{formatLatitude(coordinates.latitude)}</strong></div>
          <div className="telemetry-item"><span>{t('LONGITUDE')}</span><strong>{formatLongitude(coordinates.longitude)}</strong></div>
          <div className="telemetry-item data-state"><span className="status-dot" />{t('NASA SURFACE ATLAS')}</div>
        </div>
        <div className="topbar__actions">
          <div className="language-switch" role="group" aria-label={language === 'tr' ? 'Arayüz dili' : 'Interface language'}>
            <button type="button" lang="tr" aria-label="Türkçe" aria-pressed={language === 'tr'} onClick={() => setLanguage('tr')}>TR</button>
            <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
          </div>
          <button className="icon-button" aria-label={t('Open time explorer')} title={t('SPICE Time Explorer')} onClick={toggleTime}><Sun size={17}/></button>
          <button className="icon-button docs-button" aria-label={t('Open documentation center')} title={t('Documentation')} onClick={openDocumentation}><BookOpen size={17} /></button>
          <a className="icon-button docs-button" href="/sunum" aria-label={language === 'tr' ? 'Proje sunumu' : 'Project presentation'} title={language === 'tr' ? 'Proje sunumu' : 'Project presentation'}><Presentation size={17} /></a>
          <button className="icon-button" aria-label={t('Open location search')} onClick={() => setSearchOpen(true)}><Search size={17} /></button>
          <button className="icon-button" aria-label={t('Open data status')} onClick={() => setDataOpen(true)}><Database size={17} /></button>
          <button className="icon-button" aria-label={t('Enter fullscreen')} onClick={toggleFullscreen}><Expand size={17} /></button>
        </div>
      </header>

      <aside className={`left-rail ${leftOpen ? '' : 'is-collapsed'}`} onClick={event => {
        const button = (event.target as Element).closest('.nav-module')
        if (button && !button.hasAttribute('data-moon-ai')) setMoonAiOpen(false)
      }}>
        <div className="rail-content">
          <div className="rail-section-label">{t('EXPLORATION')}</div>
          <button className={`nav-module ${mode === 'global' && !moonAiOpen ? 'is-active' : ''}`} onClick={() => enterMode('global')}>
            <span className="nav-module__icon"><Orbit size={17} /></span><span><strong>{t('Lunar Explorer')}</strong><small>{t('Global orbital view')}</small></span>
          </button>
          <button className={`nav-module ${moonAiOpen ? 'is-active' : ''}`} data-moon-ai onClick={openMoonAi}>
            <span className="nav-module__icon"><Sparkles size={17} /></span><span><strong>Moon AI</strong><small>{t('Mission chat and analysis')}</small></span>
          </button>
          <button className={`nav-module ${mode === 'south-pole' ? 'is-active' : ''}`} onClick={() => enterMode('south-pole')}>
            <span className="nav-module__icon"><Crosshair size={17} /></span><span><strong>{t('South Pole Command')}</strong><small>{t('Regional terrain view')}</small></span>
          </button>
          <button className="nav-module" onClick={() => { setRegionalMounted(true); setRegionalOpen(true); if (window.innerWidth <= 1040) setLeftOpen(false) }}>
            <span className="nav-module__icon"><Layers3 size={17}/></span><span><strong>{t('Regional Terrain Detail')}</strong><small>{t('Progressive LOLA terrain')}</small></span>
          </button>
          <button className="nav-module" onClick={() => { setArchiveOpen(true); if (window.innerWidth <= 1040) setLeftOpen(false) }}>
            <span className="nav-module__icon"><Library size={17}/></span><span><strong>{t('Landing Site Archive')}</strong><small>{t('Historical records and candidate regions')}</small></span>
          </button>
          <button className={`nav-module ${lunarMissionsOpen ? 'is-active' : ''}`} onClick={() => {
            setLunarMissionsOpen(true)
            setTimeOpen(false)
            setPowerOpen(false)
            setLinkOpen(false)
            focusApollo(apollo)
            if (window.innerWidth <= 1040) setLeftOpen(false)
          }}><span className="nav-module__icon"><Orbit size={17} /></span><span><strong>{t('Lunar Missions')}</strong><small>{t('Apollo sites and lunar orbiters')}</small></span></button>
          <div className="rail-section-label future-label">{t('MISSION SYSTEMS')}</div>
          <button className="nav-module" onClick={() => { setOverviewOpen(true); if (window.innerWidth <= 1040) setLeftOpen(false) }}>
            <span className="nav-module__icon"><CircleGauge size={17}/></span><span><strong>{t('Mission Overview')}</strong><small>{t('Profile and planning workflow')}</small></span>
          </button>
          <button className="nav-module" onClick={() => { setArtemisOpen(true); if (window.innerWidth <= 1040) setLeftOpen(false) }}>
            <span className="nav-module__icon"><Rocket size={17} /></span><span><strong>{t('Artemis Launch System')}</strong><small>{t('Mission plans and vehicle data')}</small></span>
          </button>
          <button className={`nav-module ${timeOpen?'is-active':''}`} onClick={toggleTime}><span className="nav-module__icon"><Sun size={17}/></span><span><strong>{t('Time Explorer')}</strong><small>{t('SPICE / Sun & Earth geometry')}</small></span></button>
          <button className={`nav-module ${linkOpen?'is-active':''}`} onClick={openLink}><span className="nav-module__icon"><Radio size={17}/></span><span><strong>{t('Earth Communication')}</strong><small>{t('Link margin and sample windows')}</small></span></button>
          <button className={`nav-module ${powerOpen?'is-active':''}`} onClick={() => openPower()}><span className="nav-module__icon"><Sun size={17}/></span><span><strong>{t('Surface Power')}</strong><small>{t('Solar output and battery endurance')}</small></span></button>
          <button className="nav-module" onClick={() => openComparison()}><span className="nav-module__icon"><Grid3X3 size={17}/></span><span><strong>{t('Site Comparison')}</strong><small>{t('Shared terrain, power and radio timeline')}</small></span></button>
          {(Object.keys(POLAR_ANALYSES) as PolarAnalysis[]).map(key => {
            const Icon = ANALYSIS_ICONS[key]
            return <button key={key} className={`nav-module ${analysis === key ? 'is-active' : ''}`} aria-pressed={analysis === key} onClick={() => openAnalysis(key)}>
              <span className="nav-module__icon"><Icon size={17}/></span><span><strong>{t(POLAR_ANALYSES[key].title)}</strong><small>{t(POLAR_ANALYSES[key].short)}</small></span>
            </button>
          })}
          <button className="nav-module" onClick={() => openMission('configure')}>
            <span className="nav-module__icon"><Settings2 size={17} /></span><span><strong>{t('Mission Configuration')}</strong><small>{missionProfile.artemis ? t('Artemis Mode active') : t('Mission & spacecraft profiles')}</small></span>
          </button>
          <button className="nav-module" onClick={() => openMission('optimize')}>
            <span className="nav-module__icon"><Rocket size={17} /></span><span><strong>{t('Landing Optimization')}</strong><small>{t('Compare South Pole arrivals')}</small></span>
          </button>
          <button className="nav-module" onClick={() => openDescent('simulation')}>
            <span className="nav-module__icon"><Navigation size={17} /></span><span><strong>{t('Landing Simulation')}</strong><small>{t('3D approach & touchdown')}</small></span>
          </button>
          <button className="nav-module" onClick={() => openDescent('risk')}>
            <span className="nav-module__icon"><ShieldAlert size={17} /></span><span><strong>{t('Risk Assessment')}</strong><small>{t('Monte Carlo & scenario comparison')}</small></span>
          </button>
          <button className="nav-module" onClick={() => {
            setReportsOpen(true)
            if (window.innerWidth <= 1040) setLeftOpen(false)
          }}><span className="nav-module__icon"><FileText size={17} /></span><span><strong>{t('Mission Reports')}</strong><small>{t('Review and export mission evidence')}</small></span></button>
        </div>
        <div className="rail-footer">
          <div><span className="status-dot" />{t('SYSTEM NOMINAL')}</div>
          <button className="collapse-button" onClick={() => setLeftOpen(false)}><PanelLeftClose size={15} /> {t('Collapse')}</button>
        </div>
      </aside>

      {!leftOpen && <button className="restore-panel restore-left" onClick={() => setLeftOpen(true)} aria-label={t('Open navigation')}><Menu size={16} /></button>}

      <main hidden={moonAiOpen} className={`viewport ${!leftOpen ? 'viewport--wide-left' : ''} ${!rightOpen && !analysis ? 'viewport--wide-right' : ''}`}>
        <SceneBoundary><div className={`viewport__scene scene-layer ${mode === 'global' ? 'is-active' : ''}`}>
            <MoonScene
              sunDirection={sunDirection}
              lightAngle={lightAngle} resetKey={resetKey} onReady={readyGlobal}
              active={!moonAiOpen && mode === 'global' && !missionView && !descentView && !reportsOpen && !regionalOpen && !overviewOpen && !archiveOpen}
              focusCoordinates={archiveSelection ? coordinates : focusCoordinates}
              missions={lunarMissionsOpen ? { apollo, orbiter, animate: animateOrbit, onApollo: focusApollo,
                onOrbiter: id => { setOrbiter(id); setOrbiterDetails(true) } } : undefined}
              selected={selected}
              coordinates={coordinates}
              surfaceStyle={surfaceStyle}
              labelsVisible={labelsVisible}
              gridVisible={gridVisible}
              onSelectFeature={chooseFeature}
              onSelectCoordinates={selectSurface}
            />
        </div>
        <div className={`viewport__scene scene-layer ${mode === 'south-pole' ? 'is-active' : ''}`}>
          {polarMounted && <Suspense fallback={null}><SouthPoleScene surfaceStyle={surfaceStyle} active={!moonAiOpen && mode === 'south-pole' && !missionView && !descentView && !reportsOpen && !regionalOpen && !overviewOpen && !archiveOpen} selected={selected} onSelect={chooseFeature} labelsVisible={labelsVisible} lightAngle={lightAngle} exaggeration={exaggeration} resetKey={resetKey} onReady={readyPolar} onSelectCoordinates={selectSurface} analysis={analysis} environment={environment} focusCoordinates={focusCoordinates} coordinates={coordinates} /></Suspense>}
        </div></SceneBoundary>
        {!(mode==='global'?globalReady:polarReady)&&<div className="scene-loading"><span className="loading-orbit"/><strong>{mode==='global'?t('Loading the lunar surface'):t('Loading South Pole elevation')}</strong><small>{t('NASA / LRO · verified raster assets')}</small></div>}

        <div className="scene-heading">
          <div className="eyebrow"><span /> {mode === 'global' ? t('GLOBAL LUNAR RECONNAISSANCE') : 'REGIONAL EXPLORATION MODE'}</div>
          <h1>{mode === 'global' ? t('Lunar Explorer') : 'Lunar South Pole'}</h1>
          <p>{mode === 'global' ? t('LROC color mosaic / LOLA surface relief') : t('LOLA elevation atlas / 85°S–90°S')}</p>
        </div>

        <div className="mode-switch" role="group" aria-label={t('Explorer mode')}>
          <button className={mode === 'global' ? 'is-active' : ''} onClick={() => enterMode('global')}><Moon size={15} /> {t('GLOBAL')}</button>
          <button className={mode === 'south-pole' ? 'is-active' : ''} onClick={() => enterMode('south-pole')}><Crosshair size={15} /> {t('SOUTH POLE')}</button>
        </div>

        {(
          <div className="scene-tools">
            <button className={!analysis && surfaceStyle === 'surface' ? 'is-active' : ''} onClick={() => {setSurfaceStyle('surface');setAnalysis(null)}} title={t('Realistic surface')}><Aperture size={16} /></button>
            {mode==='global'&&<button className={surfaceStyle === 'relief' ? 'is-active' : ''} onClick={() => setSurfaceStyle('relief')} title={t('Enhanced visual relief')}><Layers3 size={16} /></button>}
            <button className={!analysis && surfaceStyle === 'elevation' ? 'is-active' : ''} onClick={() => {setSurfaceStyle('elevation');setAnalysis(null)}} title={t('LOLA elevation colors')}><Map size={16}/></button>
            {mode === 'south-pole' && (Object.keys(POLAR_ANALYSES) as PolarAnalysis[]).map(key => {
              const Icon = ANALYSIS_ICONS[key]
              return <button key={key} className={analysis === key ? 'is-active' : ''} title={t(POLAR_ANALYSES[key].title)} aria-label={t(POLAR_ANALYSES[key].title)} aria-pressed={analysis === key} onClick={() => openAnalysis(key)}><Icon size={16}/></button>
            })}
            <div className="tool-divider" />
            <button className={labelsVisible ? 'is-active' : ''} onClick={() => setLabelsVisible((value) => !value)} title={t('Toggle labels')}><LocateFixed size={16} /></button>
            {mode==='global'&&<button className={gridVisible ? 'is-active' : ''} onClick={() => setGridVisible((value) => !value)} title={t('Toggle coordinate grid')}><Grid3X3 size={16} /></button>}
            <button onClick={()=>setResetKey(value=>value+1)} title={t('Reset camera')}><Orbit size={16}/></button>
          </div>
        )}

        <div className="interaction-hint">
          <span><i className="mouse-icon" />{t('DRAG TO ORBIT')}</span><span><ZoomIn size={13} />{t('SCROLL TO ZOOM')}</span><span><LocateFixed size={13} />{t('SELECT SURFACE')}</span>
        </div>

        <div className="surface-caption"><span>01 / {mode==='global'?t('ORBITAL PERSPECTIVE'):t('POLAR TERRAIN')}</span><strong>{mode==='global'?t('The Moon, in detail.'):t('A landscape at the edge of light.')}</strong><small>{mode==='global'?t('NASA LROC · 8K imagery · LOLA displacement'):t('NASA LOLA · 40 m source · 160 m resampled grid')}</small></div>
        {analysis ? <PolarAnalysisLegend analysis={analysis} /> : surfaceStyle==='elevation'&&<div className="elevation-legend"><span>{t('LOLA HEIGHT / km')}</span><i/><div><b>−10</b><b>0</b><b>+12</b></div><small>{t('Above the 1,737.4 km reference sphere')}</small></div>}
        <div className="view-controls">{!analysis && <label><span>{sunDirection&&mode==='global'?t('SPICE SUN / UTC'):t('INSPECTION LIGHT')}</span>{sunDirection&&mode==='global'?<output>{new Date(simulationTime).toISOString().slice(0,16).replace('T',' ')}</output>:<><input aria-label={t('Inspection light angle')} type="range" min="0" max="100" value={lightAngle} onChange={e=>setLightAngle(Number(e.target.value))}/><output>{lightAngle}°</output></>}</label>}
          {mode==='south-pole'&&<label><span>{t('VERTICAL SCALE')}</span><select aria-label={t('Vertical exaggeration')} value={exaggeration} onChange={e=>setExaggeration(Number(e.target.value))}><option value={1}>{t('1× actual scale')}</option><option value={2}>{t('2× relief')}</option><option value={3}>{t('3× relief')}</option></select></label>}
          <small>{analysis ? t('Scientific colors independent of inspection lighting') : sunDirection&&mode==='global'?t('Geometric solar direction · ambient fill for readability'):t('Lighting for surface inspection · not a time simulation')}</small>
        </div>
      </main>

      {moonAiMounted && <Suspense fallback={null}><MoonAi open={moonAiOpen} coordinates={coordinates} time={simulationTime} profile={missionProfile}
        onAction={followMoonAction} onClose={() => setMoonAiOpen(false)} /></Suspense>}
      {!moonAiOpen && (analysis ? <PolarAnalysisPanel analysis={analysis} coordinates={coordinates} raster={analysisRaster}
        environment={environment} failed={failedAnalysis === analysis} onClose={() => setAnalysis(null)}
        onRetry={() => setRetryAnalysis(value => value + 1)}
        onSelectImpact={() => { selectSurface(LCROSS_IMPACT); setFocusCoordinates({ ...LCROSS_IMPACT }) }}
      /> : <aside className={`right-panel ${rightOpen ? '' : 'is-collapsed'}`}>
        <div className="panel-topline"><span>{t('LOCATION INTELLIGENCE')}</span><button onClick={() => setRightOpen(false)} aria-label={t('Close detail panel')}><PanelRightClose size={16} /></button></div>
        {archiveSelection ? <div className="location-detail">
          <div className="location-index">{t('LANDING SITE ARCHIVE')}</div>
          <h2>{archiveSelection.name}</h2>
          <p className="location-summary">{formatLatitude(coordinates.latitude)} · {formatLongitude(coordinates.longitude)}</p>
          <p className="location-summary">{archiveSelection.coord_method}</p>
          <button className="analysis-action" onClick={() => setArchiveOpen(true)}>{t('Open landing site archive')}</button>
        </div> : selected ? (
          <div className="location-detail">
            <div className="location-index">{t('SELECTED FEATURE /')} {selected.id.toUpperCase().replaceAll('-', '_')}</div>
            <div className="location-title">
              <div><small>{selected.kind}</small><h2>{selected.name}</h2></div>
              <span className="feature-symbol"><Crosshair size={21} /></span>
            </div>
            <p className="location-summary">{selected.summary}</p>
            <div className="coordinate-block">
              <div><span>{t('LATITUDE')}</span><strong>{formatLatitude(selected.latitude)}</strong></div>
              <div><span>{t('LONGITUDE')}</span><strong>{formatLongitude(selected.longitude)}</strong></div>
              <div><span>{t('DIAMETER')}</span><strong>{selected.diameterKm ? `${selected.diameterKm.toLocaleString()} km` : '—'}</strong></div>
              <div><span>{t('CLASS')}</span><strong>{selected.kind.toUpperCase()}</strong></div>
            </div>
            <div className="provenance-card">
              <div className="provenance-card__head"><Database size={14} /><span>{t('REFERENCE PROVENANCE')}</span><i>{t('VERIFIED')}</i></div>
              <p>{t('Feature center and classification follow the IAU/USGS Gazetteer of Planetary Nomenclature.')}</p>
              <a href={selected.gazetteerUrl} target="_blank" rel="noreferrer">{t('OPEN GAZETTEER RECORD')} <span>↗</span></a>
            </div>
            {mode === 'south-pole' && (
              <div className="regional-list">
                <div className="panel-section-title"><span>{t('NEARBY LANDMARKS')}</span><small>{SOUTH_POLE_FEATURES.length} {t('INDEXED')}</small></div>
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
            <span>{mode==='global'?t('LUNAR RECONNAISSANCE'):t('SURFACE COORDINATE')}</span>
            <h2>{formatLatitude(coordinates.latitude)}</h2>
            <h2>{formatLongitude(coordinates.longitude)}</h2>
            <p>{t('Explore the surface. Select a landmark or search the lunar feature index to begin.')}</p>
            <button className="dialog-close" onClick={()=>setSearchOpen(true)}>{t('FIND A LUNAR LOCATION')}</button>
          </div>
        )}
        <div className="panel-disclaimer"><Sparkles size={13} /><span>{t('NASA surface visualization. Open Terrain Intelligence for regional screening.')}</span></div>
      </aside>)}

      {!moonAiOpen && !analysis && !rightOpen && <button className="restore-panel restore-right" onClick={() => setRightOpen(true)} aria-label={t('Open detail panel')}><Info size={16} /></button>}

      <footer className={`bottom-status ${!leftOpen ? 'bottom-status--wide-left' : ''} ${!rightOpen ? 'bottom-status--wide-right' : ''}`}>
        <div className="status-segment"><span>{t('RENDER PIPELINE')}</span><strong><i className="status-dot" /> {(mode==='global'?globalReady:polarReady)?t('SURFACE READY'):t('LOADING')}</strong></div>
        <div className="status-segment"><span>{t('SURFACE MODEL')}</span><strong>{mode === 'global' ? 'LROC / LOLA' : 'LOLA POLAR DEM'}</strong></div>
        <div className="status-segment"><span>{t('GAZETTEER')}</span><strong>{LUNAR_FEATURES.length} {t('FEATURES LOADED')}</strong></div>
        <div className="status-grow" />
        <button onClick={() => setDataOpen(true)}><Database size={13} /> {t('DATA INTEGRATION STATUS')} <ChevronDown size={13} /></button>
      </footer>

      {searchOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSearchOpen(false)}>
          <section className="search-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div className="search-input"><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('Search lunar features…')} /><kbd>ESC</kbd><button onClick={() => setSearchOpen(false)}><X size={17} /></button></div>
            <div className="search-meta"><span>{t('IAU FEATURE INDEX')}</span><small>{searchResults.length} {t('RESULTS')}</small></div>
            <div className="search-results">
              {searchResults.map((feature) => (
                <button key={feature.id} onClick={() => chooseFeature(feature)}>
                  <span className="search-result__icon"><Map size={16} /></span>
                  <span><strong>{feature.name}</strong><small>{feature.kind} · {formatLatitude(feature.latitude)} / {formatLongitude(feature.longitude)}</small></span>
                  <i>{t('GO TO ↗')}</i>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {dataOpen && (
        <div className="modal-backdrop" onMouseDown={() => setDataOpen(false)}>
          <section className="data-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-heading"><div><small>{t('PHASE 07 / MISSION REPORTING')}</small><h2>{t('Data Integration Status')}</h2></div><button aria-label={t('Close data status')} onClick={() => setDataOpen(false)}><X size={18} /></button></div>
            <div className="data-row is-ready"><span><Database size={17} /></span><div><strong>{t('IAU / USGS Gazetteer references')}</strong><small>{t('Feature centers, names, classifications, diameters')}</small></div><i>{t('READY')}</i></div>
            <div className="data-row is-ready"><span><Box size={17} /></span><div><strong>{t('LROC 8K color / global LOLA relief')}</strong><small>{t('NASA SVS CGI Moon Kit · 2019 visualization mosaic')}</small></div><i>{t('INTEGRATED')}</i></div>
            <div className="data-row is-ready"><span><Layers3 size={17}/></span><div><strong>{t('South Pole LOLA elevation · V2.0')}</strong><small>{t('40 m source → 160 m grid · ~474 m mesh · DE421')}</small></div><i>{t('INTEGRATED')}</i></div>
            <div className="data-row is-ready"><span><CircleGauge size={17} /></span><div><strong>{t('SPICE time geometry · DE421')}</strong><small>{t('2026–2028 · Sun/Earth centers · spherical horizon')}</small></div><i>{t('INTEGRATED')}</i></div>
            <div className="data-row is-ready"><span><Thermometer size={17} /></span><div><strong>{t('Diviner thermal model / LOLA permanent shadow')}</strong><small>{t('480 m browser grid · source sampling tracked by cell')}</small></div><i>{t('INTEGRATED')}</i></div>
            <div className="source-links"><a href={ENVIRONMENT_MANIFEST} target="_blank" rel="noreferrer">{t('Phase 4 data provenance ↗')}</a></div>
            <div className="integrity-note"><Info size={15} /><p><strong>{t('Source and rendering limits')}</strong>{t('Color is a NASA visualization mosaic with polar infill. Elevation is gridded and interpolated from LOLA observations; browser derivatives are resampled. Regional vertical scale is selectable. Light direction is illustrative.')}</p></div>
            <div className="source-links"><a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noreferrer">{t('NASA source ↗')}</a><a href="/lunar/ldem_85s_40m.lbl" target="_blank" rel="noreferrer">{t('PDS product label ↗')}</a><a href="/lunar/manifest.json" target="_blank" rel="noreferrer">{t('Provenance & checksums ↗')}</a></div>
            <button className="dialog-close" onClick={() => setDataOpen(false)}>{t('RETURN TO EXPLORER')}</button>
          </section>
        </div>
      )}
      <DocumentationCenter open={docsOpen} onClose={closeDocumentation} onExplore={enterMode} onMoonAi={openMoonAi} />
      {lunarMissionsOpen && mode === 'global' && !docsOpen && <LunarMissions apollo={apollo} orbiter={orbiter} animate={animateOrbit}
        onApollo={focusApollo} onOrbiter={id => { setOrbiter(id); setOrbiterDetails(true) }} showDetails={orbiterDetails}
        onDetails={() => setOrbiterDetails(value => !value)} onAnimate={setAnimateOrbit} onClose={() => setLunarMissionsOpen(false)} />}
      {artemisOpen && <Suspense fallback={<div className="scene-loading" role="status">{t('Loading Artemis Launch System…')}</div>}>
        <ArtemisLaunchSystem onClose={() => setArtemisOpen(false)} onStudy={openArtemisStudy}
          onTime={openArtemisTime} onReport={saveArtemisReport} />
      </Suspense>}
      <MissionPlanner view={missionView} profile={missionProfile} onProfile={setMissionProfile} onView={view => view ? openMission(view) : setMissionView(null)}
        coordinates={coordinates} locationName={archiveSelection?.name} time={simulationTime} onLocate={inspectArrival} onPower={inspectArrivalPower} onCompare={openComparison} onSimulate={simulateArrival} onReport={createReport} />
      {comparison && <SiteComparison seed={comparison} onClose={() => setComparison(null)}
        onReport={(settings, results) => { if (comparison.artemis) saveArtemisReport(comparison.artemis.mission, settings, results) }} />}
      <DescentLab key={agentDescent?.id ?? 'descent'} view={descentView} coordinates={agentDescent?.action.site ?? descentArrival?.option.site ?? coordinates}
        lightAngle={lightAngle}
        name={agentDescent?.action.site?.name ?? descentArrival?.option.site.name ?? selected?.name ?? 'Selected coordinate'}
        time={agentDescent?.action.time ?? descentArrival?.option.time ?? simulationTime} ephemeris={ephemeris} ephemerisError={ephemerisError}
        profile={agentDescent?.action.descent?.profile ?? descentArrival?.profile ?? missionProfile}
        seed={agentDescent?.action.descent} candidate={descentArrival?.option ?? null} search={descentArrival?.search} onReport={createReport} onView={setDescentView} />
      <MissionReports open={reportsOpen} reports={reports} activeId={reportId} onSelect={setReportId} message={reportMessage}
        onRemove={id => updateReports(reports.filter(report => report.id !== id))} onClose={() => setReportsOpen(false)} />
      <MissionOverview open={overviewOpen} profile={missionProfile} coordinates={coordinates} time={simulationTime} reports={reports}
        onClose={() => setOverviewOpen(false)} onNavigate={target => {
          setOverviewOpen(false)
          if (target === 'reports') setReportsOpen(true)
          else if (target === 'communication') openLink()
          else if (target === 'power') openPower()
          else if (target === 'compare') openComparison()
          else if (target === 'simulation') openDescent(target)
          else openMission(target)
        }} />
      {linkOpen && !docsOpen && <EarthCommunication data={ephemeris} error={t(ephemerisError)} coordinates={coordinates} time={simulationTime}
        initialHeight={missionProfile.mastHeight} onTime={setSimulationTime} onClose={() => setLinkOpen(false)} />}
      {powerOpen && !docsOpen && <SurfacePower data={ephemeris} error={t(ephemerisError)} coordinates={coordinates} time={simulationTime}
        initialHeight={powerStudy.height} initialHours={powerStudy.hours} onClose={() => setPowerOpen(false)} />}
      {regionalMounted && <Suspense fallback={<div className="scene-loading" role="status">{t('Loading regional viewer…')}</div>}><RegionalTerrain open={regionalOpen} onClose={() => setRegionalOpen(false)} /></Suspense>}
      <Suspense fallback={<div className="scene-loading" role="status">{t('Loading archive…')}</div>}>
        {(archiveOpen || archiveSelection) && <LandingSiteArchive open={archiveOpen} initialTime={simulationTime} initialSiteId={archiveStart}
          onClose={() => { setArchiveOpen(false); setArchiveStart(undefined) }} onLocate={locateArchiveSite} />}
      </Suspense>
      {timeOpen&&!docsOpen&&(ephemerisError?<section className="time-explorer"><p role="alert">{t(ephemerisError)}</p><button onClick={()=>setTimeOpen(false)}>{t('Close')}</button></section>:<TimeExplorer key={timeObserver.revision} initialMastHeight={timeObserver.height} data={ephemeris} time={simulationTime} onTime={setSimulationTime} coordinates={coordinates} onClose={()=>setTimeOpen(false)} polar={mode==='south-pole'}/>)}
    </div>
  )
}

export default App
