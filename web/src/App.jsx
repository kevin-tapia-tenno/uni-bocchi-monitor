import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellRing,
  CalendarClock,
  CheckCircle2,
  CircleHelp,
  Clock3,
  ExternalLink,
  ListChecks,
  LibraryBig,
  Pause,
  Play,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import CourseCard from './components/CourseCard'
import AllCoursesView from './components/AllCoursesView'
import { getEnrollmentTurn, openEnrollment, openUni, pingBridge, syncUni } from './lib/uniBridge'
import { playEffect, playRandomUiSound, setBgm, setBgmVolume } from './lib/audio'
import { bocchiTip, minFree, randomRecommendationTarget, safeRefreshSeconds, totalFree } from './lib/vacancy'

const CACHE_KEY = 'uni-bocchi-monitor-cache-v1'
const SETTINGS_KEY = 'uni-bocchi-monitor-settings-v2'
const WATCH_KEY = 'uni-bocchi-monitor-watchlist-v1'
const ALERT_KEY = 'uni-bocchi-monitor-alerts-v1'

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

function targetKey(target) {
  if (!target) return ''
  return target.type === 'section'
    ? `section:${target.codigo}:${target.seccion}`
    : `course:${target.codigo}`
}

function isSameTarget(a, b) {
  return targetKey(a) === targetKey(b)
}

function formatTurnDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function turnPhase(turn, nowMs) {
  if (!turn?.detected || !turn.startAt || !turn.endAt) return 'unknown'
  const start = new Date(turn.startAt).getTime()
  const end = new Date(turn.endAt).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'unknown'
  if (nowMs < start) return 'before'
  if (nowMs <= end) return 'live'
  return 'ended'
}

function prettyProfessor(value) {
  const name = (value || '').trim()
  if (!name) return 'Profesor no publicado'
  if (name !== name.toUpperCase()) return name
  return name.toLocaleLowerCase('es-PE').replace(/(^|[\s'-])\p{L}/gu, (m) => m.toLocaleUpperCase('es-PE'))
}

function watchItemsFromCourses(courses, watchlist) {
  const items = []
  for (const target of watchlist || []) {
    const course = courses.find((item) => item.codigo === target.codigo)
    if (!course) continue

    if (target.type === 'section') {
      const section = course.secciones?.find((item) => item.seccion === target.seccion)
      if (!section) continue
      const professor = prettyProfessor(section.horario?.find((h) => h.docente)?.docente)
      items.push({
        target,
        course,
        section,
        free: Number(section.vacantesDisponibles || 0),
        professor,
      })
      continue
    }

    items.push({
      target,
      course,
      section: null,
      free: totalFree(course),
      professor: '',
    })
  }
  return items
}

function browserNotify(title, body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/assets/bocchi/icon-192.png' })
    }
  } catch {}
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
  const [watchlist, setWatchlist] = useState(() => readJson(WATCH_KEY, []))
  const [watchEvents, setWatchEvents] = useState([])
  const [alertsArmed, setAlertsArmed] = useState(() => readJson(ALERT_KEY, { armed: false }).armed ?? false)
  const [turnInfo, setTurnInfo] = useState(null)
  const [turnError, setTurnError] = useState('')
  const [turnLoading, setTurnLoading] = useState(false)
  const [nowMs, setNowMs] = useState(Date.now())
  const [activeView, setActiveView] = useState('monitor')

  const timerRef = useRef(null)
  const syncingRef = useRef(false)
  const syncFnRef = useRef(null)
  const lastCriticalRef = useRef(new Set())
  const lastVacanciesRef = useRef(new Map())
  const initialStatusSetRef = useRef(false)
  const recommendationChosenRef = useRef(false)

  const courses = data?.courses || []
  const tip = useMemo(() => bocchiTip(courses, recommendationTarget), [courses, recommendationTarget])
  const tipImage = TIP_VISUALS[tip.state] || TIP_VISUALS.good
  const watchedItems = useMemo(() => watchItemsFromCourses(courses, watchlist), [courses, watchlist])
  const phase = useMemo(() => turnPhase(turnInfo, nowMs), [turnInfo, nowMs])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ auto, sound, bgm, volume }))
  }, [auto, sound, bgm, volume])

  useEffect(() => {
    localStorage.setItem(WATCH_KEY, JSON.stringify(watchlist))
  }, [watchlist])

  useEffect(() => {
    localStorage.setItem(ALERT_KEY, JSON.stringify({ armed: alertsArmed }))
  }, [alertsArmed])

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

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const scheduleNext = useCallback((seconds) => {
    clearTimer()
    if (!auto || activeView !== 'monitor') return

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      syncFnRef.current?.(false)
    }, Math.max(1, seconds) * 1000)
  }, [activeView, auto, clearTimer])

  const pushWatchEvent = useCallback((message, tone = 'info') => {
    setWatchEvents((current) => [
      { id: `${Date.now()}-${Math.random()}`, message, tone, at: new Date().toLocaleTimeString('es-PE') },
      ...current,
    ].slice(0, 5))
  }, [])

  const notifyChanges = useCallback(async (result) => {
    const nowCritical = new Set()
    const currentVacancies = new Map()
    const watchedSections = new Set()

    for (const target of watchlist) {
      if (target.type === 'section') {
        watchedSections.add(`${target.codigo}-${target.seccion}`)
      } else {
        const course = result.courses?.find((item) => item.codigo === target.codigo)
        for (const section of course?.secciones || []) watchedSections.add(`${target.codigo}-${section.seccion}`)
      }
    }

    let watchedAlert = false

    for (const course of result.courses || []) {
      for (const section of course.secciones || []) {
        const free = Number(section.vacantesDisponibles || 0)
        const key = `${course.codigo}-${section.seccion}`
        currentVacancies.set(key, free)
        if (free > 0 && free <= 5) nowCritical.add(key)

        const previous = lastVacanciesRef.current.get(key)
        if (previous === undefined || !watchedSections.has(key) || previous === free) continue

        if (previous <= 0 && free > 0) {
          const message = `¡Apareció vacante! ${course.codigo} sección ${section.seccion}: ahora hay ${free} libre${free === 1 ? '' : 's'}.`
          pushWatchEvent(message, 'success')
          if (alertsArmed) browserNotify('UNI Bocchi · apareció una vacante', message)
          watchedAlert = true
        } else if (free <= 0 && previous > 0) {
          const message = `${course.codigo} sección ${section.seccion} acaba de llenarse.`
          pushWatchEvent(message, 'danger')
          if (alertsArmed) browserNotify('UNI Bocchi · sección llena', message)
          watchedAlert = true
        } else if (free < previous && free <= 5) {
          const message = `${course.codigo} sección ${section.seccion} bajó de ${previous} a ${free} vacantes.`
          pushWatchEvent(message, 'warning')
          if (alertsArmed) browserNotify('UNI Bocchi · pocas vacantes', message)
          watchedAlert = true
        }
      }
    }

    const newlyCritical = [...nowCritical].some((key) => !lastCriticalRef.current.has(key))
    lastCriticalRef.current = nowCritical
    lastVacanciesRef.current = currentVacancies

    if (sound && (watchedAlert || newlyCritical)) {
      await playEffect('alert', Math.max(volume, watchedAlert ? 0.28 : volume))
    }
  }, [alertsArmed, pushWatchEvent, sound, volume, watchlist])

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

  const loadTurnInfo = useCallback(async () => {
    if (turnLoading) return
    setTurnLoading(true)
    setTurnError('')
    try {
      const info = await getEnrollmentTurn()
      setTurnInfo(info)
      if (!info?.detected) setTurnError('No pude detectar automáticamente el grupo y horario de tu turno.')
    } catch (error) {
      setTurnError(error.message || String(error))
    } finally {
      setTurnLoading(false)
    }
  }, [turnLoading])

  useEffect(() => {
    syncFnRef.current = doSync
  }, [doSync])

  useEffect(() => {
    if (!auto || activeView !== 'monitor') {
      clearTimer()
      return
    }

    if (bridge === 'ready' && data && !syncingRef.current && !timerRef.current) {
      scheduleNext(1)
    }
  }, [activeView, auto, bridge, clearTimer, scheduleNext, data])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await pingBridge()
        if (cancelled) return
        setBridge('ready')
        syncFnRef.current?.(false)
        window.setTimeout(() => {
          if (!cancelled) loadTurnInfo()
        }, 700)
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

  useEffect(() => {
    if (!alertsArmed || !turnInfo?.startAt || !turnInfo?.endAt) return

    const startMs = new Date(turnInfo.startAt).getTime()
    const endMs = new Date(turnInfo.endAt).getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return

    const msToStart = startMs - nowMs
    const preKey = `uni-bocchi-prealert:${turnInfo.groupCode}:${turnInfo.startAt}`
    const liveKey = `uni-bocchi-livealert:${turnInfo.groupCode}:${turnInfo.startAt}`

    if (msToStart > 0 && msToStart <= 10 * 60 * 1000 && !localStorage.getItem(preKey)) {
      localStorage.setItem(preKey, '1')
      const message = `Faltan ${Math.max(1, Math.ceil(msToStart / 60000))} minutos para tu turno ${turnInfo.groupName || turnInfo.groupCode}. Verifica que tu sesión UNI siga abierta.`
      pushWatchEvent(message, 'warning')
      browserNotify('UNI Bocchi · tu turno se acerca', message)
      if (sound) playEffect('alert', Math.max(volume, 0.24))
    }

    if (nowMs >= startMs && nowMs <= endMs && !localStorage.getItem(liveKey)) {
      localStorage.setItem(liveKey, '1')
      const message = `¡Tu turno ${turnInfo.groupName || turnInfo.groupCode} comenzó! Ya puedes abrir Matrícula UNI.`
      pushWatchEvent(message, 'success')
      browserNotify('¡TU TURNO DE MATRÍCULA COMENZÓ!', message)
      document.title = '🔔 ¡TU TURNO! · UNI Bocchi'
      if (sound) {
        playRandomUiSound(Math.max(volume, 0.38))
        window.setTimeout(() => playEffect('alert', 0.45), 900)
      }
    }
  }, [alertsArmed, nowMs, pushWatchEvent, sound, turnInfo, volume])

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

  async function handleOpenEnrollment() {
    try { await openEnrollment() } catch {}
  }

  function toggleAuto() {
    setAuto((value) => !value)
  }

  function toggleWatch(target) {
    setWatchlist((current) => {
      const exists = current.some((item) => isSameTarget(item, target))
      return exists ? current.filter((item) => !isSameTarget(item, target)) : [...current, target]
    })
  }

  async function armAlerts() {
    if (sound) await playEffect('click', Math.max(volume, 0.12))
    if ('Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission() } catch {}
    }
    setAlertsArmed(true)
  }

  const criticalCount = courses.reduce(
    (count, c) => count + (c.secciones || []).filter((s) => Number(s.vacantesDisponibles) > 0 && Number(s.vacantesDisponibles) <= 5).length,
    0,
  )

  const turnStart = turnInfo?.startAt ? new Date(turnInfo.startAt).getTime() : null
  const turnEnd = turnInfo?.endAt ? new Date(turnInfo.endAt).getTime() : null
  const turnCountdown = phase === 'before' && Number.isFinite(turnStart) ? formatCountdown(turnStart - nowMs) : null
  const turnRemaining = phase === 'live' && Number.isFinite(turnEnd) ? formatCountdown(turnEnd - nowMs) : null

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
          <button className={`nav-item ${activeView === 'monitor' ? 'active' : ''}`} onClick={() => setActiveView('monitor')}><Sparkles size={17}/> Monitor</button>
          <button className={`nav-item ${activeView === 'all' ? 'active' : ''}`} onClick={() => setActiveView('all')}><LibraryBig size={17}/> Todos los cursos</button>
          <button className="nav-item" onClick={() => { setActiveView('monitor'); window.setTimeout(() => document.getElementById('turn-panel')?.scrollIntoView({ behavior: 'smooth' }), 50) }}><CalendarClock size={17}/> Mi turno</button>
          <button className="nav-item" onClick={() => { setActiveView('monitor'); window.setTimeout(() => document.getElementById('plan-panel')?.scrollIntoView({ behavior: 'smooth' }), 50) }}><ListChecks size={17}/> Mi plan</button>
          <button className="nav-item" onClick={() => { setActiveView('monitor'); setSort('urgent') }}><BellRing size={17}/> Prioridad</button>
          <button className="nav-item" onClick={() => { setActiveView('monitor'); window.setTimeout(() => document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth' }), 50) }}><SlidersHorizontal size={17}/> Preferencias</button>
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
            <h1>{activeView === 'all' ? 'Todos los Cursos FIIS' : 'Monitor de Vacantes UNI'}</h1>
            <p>{activeView === 'all' ? 'Cursos aperturados por carrera y ciclo, con vacantes actualizadas de forma escalonada.' : 'Vacantes en vivo, plan de matrícula y alerta de tu turno en una sola vista.'}</p>
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

        {activeView === 'all' ? (
          <AllCoursesView bridge={bridge} />
        ) : (
          <>
        <section id="turn-panel" className={`turn-panel ${phase}`}>
          <div className="turn-visual">
            <img
              src={phase === 'live' ? TIP_VISUALS.danger : phase === 'before' ? TIP_VISUALS.warning : TIP_VISUALS.good}
              alt="Bocchi esperando el turno"
            />
          </div>
          <div className="turn-main">
            <div className="turn-kicker"><CalendarClock size={15}/> MI TURNO DE MATRÍCULA</div>
            {turnLoading ? (
              <><h2>Detectando tu grupo…</h2><p>Bocchi está leyendo el horario desde tu sesión UNI.</p></>
            ) : turnInfo?.detected ? (
              <>
                <h2>{turnInfo.groupCode} · {turnInfo.groupName}</h2>
                <p>{formatTurnDate(turnInfo.startAt)} → {formatTurnDate(turnInfo.endAt)}</p>
                {phase === 'before' ? <div className="turn-countdown"><span>Empieza en</span><strong>{turnCountdown}</strong></div> : null}
                {phase === 'live' ? <div className="turn-countdown live"><span>¡TU TURNO ESTÁ ACTIVO!</span><strong>{turnRemaining}</strong></div> : null}
                {phase === 'ended' ? <div className="turn-countdown ended"><span>Turno finalizado</span><strong>00:00</strong></div> : null}
              </>
            ) : (
              <>
                <h2>No pude detectar tu turno</h2>
                <p>{turnError || 'Abre Matrícula UNI una vez y vuelve a intentarlo.'}</p>
              </>
            )}
          </div>
          <div className="turn-actions">
            <button className={`alert-arm-btn ${alertsArmed ? 'armed' : ''}`} onClick={alertsArmed ? () => setAlertsArmed(false) : armAlerts}>
              <Bell size={16}/>{alertsArmed ? 'Alertas activas' : 'Activar alertas'}
            </button>
            <button className="enroll-open-btn" onClick={handleOpenEnrollment}><ArrowUpRight size={16}/> Abrir Matrícula</button>
            <button className="turn-retry-btn" onClick={loadTurnInfo} disabled={turnLoading}>{turnLoading ? 'Leyendo…' : 'Releer turno'}</button>
          </div>
          <div className="turn-foot">
            <span className={bridge === 'ready' ? 'ok' : ''}><ShieldCheck size={13}/> {bridge === 'ready' ? 'Sesión puente lista' : 'Revisa la sesión UNI'}</span>
            <span>La alerta funciona mientras esta web esté abierta; no intenta matricularte automáticamente.</span>
          </div>
        </section>

        <section className={`bocchi-tip ${tip.tone}`}>
          <img src={tipImage} alt="Bocchi" />
          <div>
            <span>{tip.label || 'Bocchi recomienda'}</span>
            <strong>{tip.text}</strong>
          </div>
          {criticalCount ? <div className="critical-badge"><AlertTriangle size={15}/>{criticalCount} crítica{criticalCount === 1 ? '' : 's'}</div> : null}
          <div className="bocchi-tip-bg" aria-hidden="true">
            <img src="/assets/bocchi/floating/float-11.png" alt="" />
          </div>
        </section>

        {bridge === 'missing' ? (
          <section className="setup-card">
            <div className="setup-icon"><ExternalLink/></div>
            <div><h2>Falta la extensión puente</h2><p>Recarga la nueva versión de <strong>UNI Bocchi Bridge</strong> y luego recarga esta página.</p></div>
          </section>
        ) : null}

        {bridge === 'session' ? (
          <section className="setup-card warning-card">
            <div className="setup-icon"><ShieldCheck/></div>
            <div><h2>Inicia sesión en Matrícula UNI</h2><p>No escribas tus credenciales aquí. Inicia sesión en la web oficial y regresa.</p><button className="small-primary" onClick={handleOpenUni}>Abrir Matrícula UNI</button></div>
          </section>
        ) : null}

        <section className="hud-row">
          <div className="hud-stat"><span>Estado</span><strong>{status}</strong></div>
          <div className="hud-stat"><span>Cursos aperturados</span><strong>{courses.length || '—'}</strong></div>
          <div className="hud-stat"><span>Mi plan</span><strong>{watchlist.length} vigilado{watchlist.length === 1 ? '' : 's'}</strong></div>
          <div className="hud-stat"><span>Datos</span><strong>{syncing ? 'Sincronizando en silencio' : 'Vacantes en vivo'}</strong></div>
        </section>

        <section className="controls">
          <label className="search-box"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar curso, sección o profesor…"/></label>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="original">Orden UNI</option>
            <option value="urgent">Menos vacantes primero</option>
          </select>
          <button className={`auto-btn ${auto ? 'on' : ''}`} onClick={toggleAuto}>{auto ? <Pause size={16}/> : <Play size={16}/>} Auto {auto ? 'activo' : 'pausado'}</button>
        </section>

        <section id="plan-panel" className="plan-panel">
          <div className="plan-heading">
            <div><div className="plan-kicker"><Star size={15}/> MI PLAN DE MATRÍCULA</div><h2>Secciones que quieres vigilar</h2><p>Marca “Vigilar” en un curso completo o en una sección. Las alertas priorizan estos objetivos.</p></div>
            <button className="enroll-open-btn compact" onClick={handleOpenEnrollment}><ArrowUpRight size={15}/> Ir a Matrícula</button>
          </div>

          {watchedItems.length ? (
            <div className="watch-grid">
              {watchedItems.map((item) => (
                <div className="watch-card" key={targetKey(item.target)}>
                  <div className="watch-card-main">
                    <span className="watch-code">{item.course.codigo}{item.section ? ` · ${item.section.seccion}` : ''}</span>
                    <strong>{item.course.nombre}</strong>
                    <small>{item.section ? item.professor : 'Todas las secciones del curso'}</small>
                  </div>
                  <div className="watch-card-free"><strong>{item.free}</strong><span>libres</span></div>
                  <div className="watch-card-actions">
                    <button onClick={() => setRecommendationTarget(item.target)} title="Que Bocchi analice este objetivo"><Sparkles size={14}/></button>
                    <button onClick={() => toggleWatch(item.target)} title="Quitar del plan"><X size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="plan-empty"><Star size={18}/><span>Aún no has marcado cursos. Usa <strong>Vigilar</strong> en las tarjetas de abajo.</span></div>
          )}

          {watchEvents.length ? (
            <div className="watch-events">
              {watchEvents.map((event) => <div className={`watch-event ${event.tone}`} key={event.id}><span>{event.at}</span><strong>{event.message}</strong></div>)}
            </div>
          ) : null}
        </section>

        <section className="course-list">
          <div className="list-title"><div><h2>Cursos aperturados</h2><p>Los cursos “No aperturado” se ignoran por completo y no consumen consultas.</p></div><span>{visibleCourses.length}/{courses.length || 0}</span></div>
          {visibleCourses.length ? visibleCourses.map((course) => (
            <CourseCard
              course={course}
              key={course.codigo}
              onRecommend={setRecommendationTarget}
              selectedTarget={recommendationTarget}
              watchlist={watchlist}
              onToggleWatch={toggleWatch}
            />
          )) : (
            <div className="empty-state"><img src="/assets/bocchi/status/status-idle.png" alt="Bocchi"/><h3>{courses.length ? 'No hay coincidencias' : 'Esperando tus cursos'}</h3><p>{courses.length ? 'Prueba con otra búsqueda.' : 'Conecta la extensión y mantén una sesión UNI iniciada.'}</p></div>
          )}
        </section>

        <section className="settings-panel" id="settings">
          <div><h2>Preferencias Bocchi</h2><p>El monitor sigue actualizando vacantes automáticamente. El turno se lee al cargar la página o al pulsar “Releer turno”.</p></div>
          <div className="setting-grid">
            <label><span>Volumen</span><input type="range" min="0" max="0.6" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))}/><b>{Math.round(volume * 100)}%</b></label>
            <label><span>Monitoreo automático</span><button onClick={toggleAuto}>{auto ? 'Activada' : 'Pausada'}</button></label>
            <label><span>Efectos</span><button onClick={() => setSound((v) => !v)}>{sound ? 'Activados' : 'Silenciados'}</button></label>
            <label><span>Música Bocchi</span><button onClick={toggleBgm}>{bgm ? 'Reproduciendo' : 'Desactivada'}</button></label>
          </div>
        </section>
          </>
        )}
      </main>
    </div>
  )
}

export default App
