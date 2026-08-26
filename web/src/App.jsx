import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CircleHelp,
  Clock3,
  ExternalLink,
  Pause,
  Play,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react'
import CourseCard from './components/CourseCard'
import { openUni, pingBridge, syncUni } from './lib/uniBridge'
import { playEffect, playRandomUiSound, setBgm, setBgmVolume } from './lib/audio'
import { bocchiTip, minFree, randomRecommendationTarget, safeRefreshSeconds } from './lib/vacancy'

const CACHE_KEY = 'uni-bocchi-monitor-cache-v1'
const SETTINGS_KEY = 'uni-bocchi-monitor-settings-v2'

const FLOAT_DECOR = [
  '/assets/bocchi/floating/float-01.png',
  '/assets/bocchi/floating/float-02.png',
  '/assets/bocchi/floating/float-03.png',
  '/assets/bocchi/floating/float-04.png',
  '/assets/bocchi/floating/float-05.png',
  '/assets/bocchi/floating/float-06.png',
  '/assets/bocchi/floating/float-07.png',
  '/assets/bocchi/floating/float-08.png',
  '/assets/bocchi/floating/float-09.png',
  '/assets/bocchi/floating/float-10.png',
  '/assets/bocchi/floating/float-11.png',
  '/assets/bocchi/floating/float-12.png',
]

const TIP_VISUALS = {
  idle: '/assets/bocchi/status/status-idle.png',
  good: '/assets/bocchi/status/status-good.png',
  half: '/assets/bocchi/status/status-half.png',
  warning: '/assets/bocchi/status/status-warning.png',
  danger: '/assets/bocchi/status/status-danger.png',
  full: '/assets/bocchi/status/status-full.png',
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

function mergeWithPrevious(previous, incoming) {
  if (!previous?.courses?.length) return incoming
  const previousByCode = new Map(previous.courses.map((course) => [course.codigo, course]))

  return {
    ...incoming,
    courses: (incoming.courses || []).map((course) => {
      if (!course.error) return course
      const oldCourse = previousByCode.get(course.codigo)
      if (!oldCourse?.secciones?.length) return course
      return {
        ...oldCourse,
        orden: course.orden,
        nombre: course.nombre || oldCourse.nombre,
        ciclo: course.ciclo || oldCourse.ciclo,
        creditos: course.creditos || oldCourse.creditos,
        stale: true,
        lastError: course.error,
      }
    }),
  }
}

function App() {
  const [bridge, setBridge] = useState('checking')
  const [status, setStatus] = useState('Cargando tus cursos…')
  const [data, setData] = useState(() => readJson(CACHE_KEY, null))
  const [syncing, setSyncing] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('original')
  const [auto, setAuto] = useState(() => readJson(SETTINGS_KEY, { auto: true }).auto ?? true)
  const [sound, setSound] = useState(() => readJson(SETTINGS_KEY, { sound: true }).sound ?? true)
  const [bgm, setBgmEnabled] = useState(false)
  const [volume, setVolume] = useState(() => readJson(SETTINGS_KEY, { volume: 0.10 }).volume ?? 0.10)
  const [recommendationTarget, setRecommendationTarget] = useState(null)

  const timerRef = useRef(null)
  const syncingRef = useRef(false)
  const syncFnRef = useRef(null)
  const lastCriticalRef = useRef(new Set())
  const initialStatusSetRef = useRef(false)
  const recommendationChosenRef = useRef(false)

  const courses = data?.courses || []
  const tip = useMemo(() => bocchiTip(courses, recommendationTarget), [courses, recommendationTarget])
  const tipImage = TIP_VISUALS[tip.state] || TIP_VISUALS.good

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ auto, sound, bgm, volume }))
  }, [auto, sound, bgm, volume])

  useEffect(() => {
    if (!courses.length || recommendationChosenRef.current) return
    const target = randomRecommendationTarget(courses)
    if (target) {
      recommendationChosenRef.current = true
      setRecommendationTarget(target)
    }
  }, [courses])

  useEffect(() => {
    setBgmVolume(volume)
  }, [volume])

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const scheduleNext = useCallback((seconds) => {
    clearTimer()
    if (!auto) return

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      syncFnRef.current?.(false)
    }, Math.max(1, seconds) * 1000)
  }, [auto, clearTimer])

  const notifyChanges = useCallback(async (result) => {
    if (!sound) return
    const nowCritical = new Set()
    for (const course of result.courses || []) {
      for (const section of course.secciones || []) {
        const free = Number(section.vacantesDisponibles || 0)
        const key = `${course.codigo}-${section.seccion}`
        if (free > 0 && free <= 5) nowCritical.add(key)
      }
    }
    const newlyCritical = [...nowCritical].some((key) => !lastCriticalRef.current.has(key))
    lastCriticalRef.current = nowCritical
    if (newlyCritical) await playEffect('alert', volume)
  }, [sound, volume])

  const doSync = useCallback(async (manual = false) => {
    if (syncingRef.current) return
    syncingRef.current = true
    setSyncing(true)

    if (sound && manual) playRandomUiSound(Math.min(volume, 0.14))
    const started = Date.now()

    try {
      const rawResult = await syncUni()
      const result = mergeWithPrevious(data, rawResult)
      const has429 = (rawResult.courses || []).some((course) => /HTTP_?429/i.test(course.error || ''))

      setBridge('ready')
      setData(result)
      localStorage.setItem(CACHE_KEY, JSON.stringify(result))

      if (!initialStatusSetRef.current) {
        const loadedAt = new Date(rawResult.updatedAt || Date.now()).toLocaleTimeString('es-PE')
        setStatus(has429
          ? `Sesión conectada · usando datos disponibles al cargar ${loadedAt}`
          : `Sesión conectada · datos cargados ${loadedAt}`)
        initialStatusSetRef.current = true
      }

      await notifyChanges(result)

      const desired = safeRefreshSeconds(rawResult.totalCourses || rawResult.courses?.length || 0)
      const elapsed = Math.ceil((Date.now() - started) / 1000)
      let wait = Math.max(1, desired - elapsed)

      if (has429) {
        wait = Math.max(wait, 60)
      } else if (
        Number.isFinite(rawResult.rateRemaining)
        && rawResult.rateRemaining < Math.max(5, rawResult.totalCourses || 0)
      ) {
        wait = Math.max(wait, 35)
      }

      scheduleNext(wait)
    } catch (error) {
      const code = error.message || String(error)

      if (!initialStatusSetRef.current) {
        if (code.includes('SESSION_REQUIRED') || code.includes('COURSES_PAGE_REQUIRED')) {
          setStatus('Necesitas iniciar sesión en Matrícula UNI.')
          setBridge('session')
        } else if (code.includes('EXTENSION_NOT_FOUND') || code.includes('BRIDGE_TIMEOUT')) {
          setStatus('No se detectó UNI Bocchi Bridge.')
          setBridge('missing')
        } else {
          setStatus(`No se pudo cargar: ${code}`)
        }
      }

      if (auto) scheduleNext(code.includes('429') ? 60 : 30)
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [auto, data, notifyChanges, scheduleNext, sound, volume])

  useEffect(() => {
    syncFnRef.current = doSync
  }, [doSync])

  useEffect(() => {
    if (!auto) {
      clearTimer()
      return
    }

    if (bridge === 'ready' && data && !syncingRef.current && !timerRef.current) {
      scheduleNext(1)
    }
  }, [auto, bridge, clearTimer, scheduleNext, data])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await pingBridge()
        if (cancelled) return
        setBridge('ready')
        syncFnRef.current?.(false)
      } catch {
        if (cancelled) return
        setBridge('missing')
        setStatus('Instala o recarga la extensión UNI Bocchi Bridge.')
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => () => {
    clearTimer()
  }, [clearTimer])

  const visibleCourses = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es-PE')
    let filtered = courses.filter((course) => {
      if (!q) return true
      const professors = (course.secciones || []).flatMap((s) => (s.horario || []).map((h) => h.docente || '')).join(' ')
      const sections = (course.secciones || []).map((s) => s.seccion).join(' ')
      return `${course.codigo} ${course.nombre} ${professors} ${sections}`.toLocaleLowerCase('es-PE').includes(q)
    })

    if (sort === 'urgent') {
      filtered = [...filtered].sort((a, b) => minFree(a) - minFree(b) || a.orden - b.orden)
    } else {
      filtered = [...filtered].sort((a, b) => a.orden - b.orden)
    }
    return filtered
  }, [courses, query, sort])

  async function toggleBgm() {
    const next = !bgm
    if (sound) playEffect('click', Math.min(volume, 0.10))

    const result = await setBgm(next, volume)
    if (next && !result.ok) {
      setBgmEnabled(false)
      return
    }

    setBgmEnabled(next)
  }

  async function handleOpenUni() {
    try { await openUni() } catch {}
  }

  function toggleAuto() {
    setAuto((value) => !value)
  }

  const criticalCount = courses.reduce(
    (count, c) => count + (c.secciones || []).filter((s) => Number(s.vacantesDisponibles) > 0 && Number(s.vacantesDisponibles) <= 5).length,
    0,
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <button
            type="button"
            className="brand-mascot-button"
            onClick={() => sound && playRandomUiSound(Math.min(volume, 0.14))}
            title="Bocchi dice algo aleatorio"
            aria-label="Reproducir sonido aleatorio de Bocchi"
          >
            <img src="/assets/bocchi/mascot.png" alt="Bocchi decorativa" className="brand-mascot" />
          </button>
          <div><strong>UNI Bocchi</strong><span>Vacancy Monitor</span></div>
        </div>

        <nav className="nav-block">
          <button className="nav-item active"><Sparkles size={17}/> Monitor</button>
          <button className="nav-item" onClick={() => setSort('urgent')}><BellRing size={17}/> Prioridad</button>
          <button className="nav-item" onClick={() => document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth' })}><SlidersHorizontal size={17}/> Preferencias</button>
        </nav>

        <div className="privacy-card">
          <ShieldCheck size={20}/>
          <div><strong>Sesión local</strong><span>Tu contraseña y token UNI no se envían a esta web.</span></div>
        </div>
      </aside>

      <main className="main-panel">
        <div className="bocchi-float-layer" aria-hidden="true">
          {FLOAT_DECOR.map((src, index) => (
            <img src={src} alt="" key={src} className={`bocchi-float bocchi-float-${index + 1}`} />
          ))}
        </div>

        <header className="topbar">
          <div>
            <div className="eyebrow">MATRÍCULA · 2026-2</div>
            <h1>Monitor de Vacantes UNI</h1>
            <p>Secciones, profesores, horarios y vacantes en una sola vista. El monitoreo se actualiza solo en segundo plano.</p>
          </div>

          <div className="top-actions">
            <button className={`connection ${bridge}`} onClick={bridge === 'session' ? handleOpenUni : undefined}>
              {bridge === 'ready' ? <CheckCircle2 size={15}/> : bridge === 'missing' ? <CircleHelp size={15}/> : <Clock3 size={15}/>}
              {bridge === 'ready' ? 'Puente activo' : bridge === 'session' ? 'Iniciar sesión UNI' : bridge === 'missing' ? 'Extensión no detectada' : 'Comprobando'}
            </button>
            <button className="icon-btn" onClick={() => setSound((v) => !v)} title="Sonidos">
              {sound ? <Volume2 size={18}/> : <VolumeX size={18}/>}
            </button>
            <button
              className={`music-mascot-btn ${bgm ? 'playing' : ''}`}
              onClick={toggleBgm}
              title={bgm ? 'Pausar música de fondo' : 'Reproducir música aleatoria'}
              aria-pressed={bgm}
            >
              <img
                src={bgm ? '/assets/bocchi/music-on.gif' : '/assets/bocchi/music-off.png'}
                alt={bgm ? 'Bocchi escuchando música' : 'Activar música con Bocchi'}
              />
              <span>{bgm ? '♫ ON' : '♫'}</span>
            </button>
          </div>
        </header>

        <section className={`bocchi-tip ${tip.tone}`}>
          <img src={tipImage} alt="Bocchi" />
          <div>
            <span>{tip.label || 'Bocchi recomienda'}</span>
            <strong>{tip.text}</strong>
          </div>
          {criticalCount ? <div className="critical-badge"><AlertTriangle size={15}/>{criticalCount} crítica{criticalCount === 1 ? '' : 's'}</div> : null}
        </section>

        {bridge === 'missing' ? (
          <section className="setup-card">
            <div className="setup-icon"><ExternalLink/></div>
            <div><h2>Falta la extensión puente</h2><p>Carga la carpeta <code>extension</code> desde <strong>brave://extensions</strong> usando “Cargar descomprimida”, y luego recarga esta página.</p></div>
          </section>
        ) : null}

        {bridge === 'session' ? (
          <section className="setup-card warning-card">
            <div className="setup-icon"><ShieldCheck/></div>
            <div><h2>Inicia sesión en Matrícula UNI</h2><p>No escribas tus credenciales aquí. Inicia sesión en la web oficial de la UNI y luego regresa; el monitor volverá a intentar la conexión.</p><button className="small-primary" onClick={handleOpenUni}>Abrir Matrícula UNI</button></div>
          </section>
        ) : null}

        <section className="hud-row">
          <div className="hud-stat"><span>Estado</span><strong>{status}</strong></div>
          <div className="hud-stat"><span>Cursos aperturados</span><strong>{courses.length || '—'}</strong></div>
          <div className="hud-stat"><span>Datos</span><strong>Vacantes en vivo</strong></div>
        </section>

        <section className="controls">
          <label className="search-box"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar curso, sección o profesor…"/></label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="original">Orden UNI</option>
            <option value="urgent">Menos vacantes primero</option>
          </select>
          <button className={`auto-btn ${auto ? 'on' : ''}`} onClick={toggleAuto}>{auto ? <Pause size={16}/> : <Play size={16}/>} Auto {auto ? 'activo' : 'pausado'}</button>
        </section>

        <section className="course-list">
          <div className="list-title"><div><h2>Cursos aperturados</h2><p>Los cursos “No aperturado” se ignoran por completo y no consumen consultas.</p></div><span>{visibleCourses.length}/{courses.length || 0}</span></div>
          {visibleCourses.length ? visibleCourses.map((course) => (
            <CourseCard
              course={course}
              key={course.codigo}
              onRecommend={setRecommendationTarget}
              selectedTarget={recommendationTarget}
            />
          )) : (
            <div className="empty-state"><img src="/assets/bocchi/status/status-idle.png" alt="Bocchi"/><h3>{courses.length ? 'No hay coincidencias' : 'Esperando tus cursos'}</h3><p>{courses.length ? 'Prueba con otra búsqueda.' : 'Conecta la extensión y mantén una sesión UNI iniciada.'}</p></div>
          )}
        </section>

        <section className="settings-panel" id="settings">
          <div><h2>Preferencias Bocchi</h2><p>El monitor trabaja solo en segundo plano. Al hacer F5, Bocchi vuelve a escoger al azar un curso o sección para comentar; también puedes elegir uno con los botones “Bocchi” de cada tarjeta.</p></div>
          <div className="setting-grid">
            <label><span>Volumen</span><input type="range" min="0" max="0.6" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))}/><b>{Math.round(volume * 100)}%</b></label>
            <label><span>Monitoreo automático</span><button onClick={toggleAuto}>{auto ? 'Activada' : 'Pausada'}</button></label>
            <label><span>Efectos</span><button onClick={() => setSound((v) => !v)}>{sound ? 'Activados' : 'Silenciados'}</button></label>
            <label><span>Música Bocchi</span><button onClick={toggleBgm}>{bgm ? 'Reproduciendo' : 'Desactivada'}</button></label>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
