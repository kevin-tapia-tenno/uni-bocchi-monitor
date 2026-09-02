import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Clock3, Pause, Play, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { getAllCourseVacancies } from '../lib/uniBridge'
import { ALL_COURSES_CATALOG } from '../data/allCoursesCatalog'

const CACHE_KEY = 'uni-bocchi-all-courses-cache-v1'
const AUTO_REFRESH_MS = 10 * 60 * 1000
const BATCH_SIZE = 10
const RATE_LIMIT_PAUSE_MS = 20 * 1000
const LOW_RATE_PAUSE_MS = 12 * 1000
const MAX_RATE_RETRIES = 2

const CAREERS = [
  { id: 'all', label: 'Todas las carreras' },
  { id: 'industrial', label: 'Ingeniería Industrial' },
  { id: 'systems', label: 'Ingeniería de Sistemas' },
  { id: 'software', label: 'Ingeniería de Software' },
  { id: 'ai', label: 'Inteligencia Artificial' },
]

const CAREER_ORDER = ['common', 'industrial', 'systems', 'software', 'ai']
const CAREER_LABEL = {
  common: 'Base común FIIS',
  industrial: 'Ingeniería Industrial',
  systems: 'Ingeniería de Sistemas',
  software: 'Ingeniería de Software',
  ai: 'Inteligencia Artificial',
}

const PLAN_OPTIONS = {
  all: [{ id: 'all', label: 'Todas las mallas' }],
  systems: [
    { id: 'all', label: 'Todas las mallas' },
    { id: 'old', label: 'Malla antigua · 2018-II' },
    { id: 'new', label: 'Malla nueva · 2026-II' },
  ],
  industrial: [
    { id: 'all', label: 'Todas las mallas' },
    { id: 'old', label: 'Malla antigua · 2018' },
    { id: 'new', label: 'Malla nueva · 2026' },
  ],
  software: [{ id: 'current', label: 'Malla de Ingeniería de Software' }],
  ai: [{ id: 'current', label: 'Malla de Inteligencia Artificial · 2025-II' }],
}

const PLAN_SHORT_LABEL = {
  old: 'antigua',
  new: 'nueva',
  current: 'vigente',
}

const DAY_LABEL = {
  LU: 'Lun', MA: 'Mar', MI: 'Mié', JU: 'Jue', VI: 'Vie', SA: 'Sáb', DO: 'Dom',
  Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié', Miercoles: 'Mié', Jueves: 'Jue', Viernes: 'Vie', Sábado: 'Sáb', Sabado: 'Sáb', Domingo: 'Dom',
}

function readCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return Number.NaN
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function prettyProfessor(value = '') {
  const name = String(value || '').trim().replace(/\s+/g, ' ')
  if (!name || /^NN$/i.test(name)) return 'Profesor por publicar'
  if (name !== name.toUpperCase()) return name
  return name.toLocaleLowerCase('es-PE').replace(/(^|[\s'-])\p{L}/gu, (m) => m.toLocaleUpperCase('es-PE'))
}

function cleanTime(value = '') {
  const text = String(value || '').trim()
  return text.length >= 5 ? text.slice(0, 5) : text
}

function scheduleText(item) {
  const day = DAY_LABEL[item?.dia] || DAY_LABEL[item?.day] || item?.dia || item?.day || '—'
  const start = cleanTime(item?.horaInicio ?? item?.start)
  const end = cleanTime(item?.horaFin ?? item?.end)
  const room = item?.aula || item?.room || ''
  const type = item?.concepto || item?.type || ''
  return `${day} ${start || '—'}–${end || '—'}${room ? ` · ${room}` : ''}${type ? ` · ${type}` : ''}`
}

function liveProfessor(section, fallback) {
  const fromLive = (section?.horario || []).find((item) => item?.docente)?.docente
  return prettyProfessor(fromLive || fallback?.professor || '')
}

function careerPlanEntries(course, career, plan = 'all') {
  if (!career || career === 'all') {
    return Object.entries(course.curricula || {}).flatMap(([careerId, plans]) =>
      Object.entries(plans || {}).map(([planId, meta]) => ({ career: careerId, plan: planId, ...meta })),
    )
  }

  const plans = course.curricula?.[career] || {}
  if (plan === 'all') return Object.entries(plans).map(([planId, meta]) => ({ career, plan: planId, ...meta }))
  const meta = plans?.[plan]
  return meta ? [{ career, plan, ...meta }] : []
}

function courseMatchesCareer(course, career) {
  if (career === 'all') return true
  return Boolean(course.curricula?.[career]) || course.primaryCareer === career
}

function courseMatchesPlan(course, career, plan) {
  if (career === 'all') return true
  if (plan === 'all') return courseMatchesCareer(course, career)
  return Boolean(course.curricula?.[career]?.[plan])
}

function courseMatchesCycle(course, career, plan, cycle) {
  if (cycle === 'all') return true
  const entries = careerPlanEntries(course, career, plan)

  if (cycle === 'elective') return entries.some((item) => item.category === 'elective')
  if (cycle === 'complementary') return entries.some((item) => item.category === 'complementary')
  return entries.some((item) => item.category === 'core' && Number(item.cycle) === Number(cycle))
}

function primaryMeta(course, career, plan) {
  const entries = careerPlanEntries(course, career, plan)
  const core = entries.filter((item) => item.category === 'core' && Number.isFinite(Number(item.cycle)))
  if (core.length) return core.sort((a, b) => Number(a.cycle) - Number(b.cycle))[0]
  if (entries.some((item) => item.category === 'elective')) return { category: 'elective', cycle: null }
  if (entries.some((item) => item.category === 'complementary')) return { category: 'complementary', cycle: null }
  return null
}

function categoryLabel(meta) {
  if (!meta) return 'Aperturado · sin coincidencia en la malla elegida'
  if (meta.category === 'core' && meta.cycle) return `Ciclo ${meta.cycle}`
  if (meta.category === 'elective') return 'Electivos'
  if (meta.category === 'complementary') return 'Complementarios / extracurriculares'
  return 'Otros'
}

function detailedMetaLabel(course, career, plan) {
  if (career === 'all') return categoryLabel(primaryMeta(course, career, plan))
  const entries = careerPlanEntries(course, career, plan)
  if (!entries.length) return 'Aperturado · sin coincidencia en la malla suministrada'

  if (plan !== 'all' || entries.length === 1) return categoryLabel(entries[0])

  return entries
    .map((item) => `${PLAN_SHORT_LABEL[item.plan] || item.plan}: ${categoryLabel(item).replace(/^Ciclo /, 'ciclo ')}`)
    .join(' · ')
}

function entrySort(a, b, career, plan) {
  const ma = primaryMeta(a, career, plan)
  const mb = primaryMeta(b, career, plan)
  const rank = (meta) => {
    if (meta?.category === 'core') return Number(meta.cycle || 90)
    if (meta?.category === 'elective') return 91
    if (meta?.category === 'complementary') return 92
    return 99
  }
  return rank(ma) - rank(mb) || a.code.localeCompare(b.code, 'es')
}

function mergeLiveSections(course, live) {
  const liveSections = Array.isArray(live?.secciones) ? live.secciones : []
  const fallbackBySection = new Map((course.fallbackSections || []).map((item) => [item.section, item]))

  if (!liveSections.length) {
    return (course.fallbackSections || []).map((fallback) => ({
      seccion: fallback.section,
      vacantesMaximas: fallback.capacity,
      vacantesOcupadas: null,
      vacantesDisponibles: null,
      horario: fallback.schedule,
      _fallback: fallback,
    }))
  }

  return liveSections.map((section) => ({
    ...section,
    _fallback: fallbackBySection.get(section.seccion),
  }))
}

function VacancyBar({ section }) {
  const max = finiteNumber(section?.vacantesMaximas)
  const occupied = finiteNumber(section?.vacantesOcupadas)
  const reportedFree = finiteNumber(section?.vacantesDisponibles)

  // La API UNI a veces devuelve 0/0 temporalmente para campos que todavía no
  // están consistentes. Si tenemos aforo y matriculados, la resta es la fuente
  // más coherente para no mostrar falsos “Lleno”.
  const derivedFree = Number.isFinite(max) && Number.isFinite(occupied)
    ? Math.max(0, max - occupied)
    : Number.NaN
  const free = Number.isFinite(derivedFree) ? derivedFree : reportedFree
  const hasLive = Number.isFinite(max) && Number.isFinite(occupied) && Number.isFinite(free)
  const pct = hasLive && max > 0 ? Math.min(100, Math.max(0, (occupied / max) * 100)) : 0
  const isFull = hasLive && max > 0 && occupied >= max && free <= 0

  return (
    <div className="all-vacancy-side">
      <div className="all-vacancy-numbers">
        <strong>{hasLive ? `${occupied}/${max}` : `—/${Number.isFinite(max) ? max : '—'}`}</strong>
        <span>{hasLive ? 'matriculados' : 'esperando consulta'}</span>
        <b className={isFull ? 'full' : ''}>{hasLive ? (isFull ? 'Lleno' : `${free} libres`) : 'Sin dato'}</b>
      </div>
      <div className="all-vacancy-track"><span style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function AllCourseCard({ course, live, career, plan, onRetry, retrying, refreshBlocked }) {
  const sections = mergeLiveSections(course, live)
  const hasLiveData = Array.isArray(live?.secciones) && live.secciones.length > 0
  const hasError = Boolean(live?.error)

  return (
    <article className="all-course-card">
      <div className="all-course-head">
        <div className="all-course-title">
          <span>{course.code}</span>
          <strong>{course.name}</strong>
        </div>
        <div className="all-course-meta-wrap">
          <div className="all-course-meta">{detailedMetaLabel(course, career, plan)}</div>
          {!hasLiveData ? (
            <div className="all-course-retry-wrap">
              <span className={`all-live-state ${hasError ? 'warn' : ''}`}>{hasError ? 'Reintento pendiente' : 'Pendiente de consulta'}</span>
              <button
                type="button"
                className={`all-course-retry ${retrying ? 'busy' : ''}`}
                onClick={() => onRetry?.(course.code)}
                disabled={refreshBlocked || retrying}
                title={`Reintentar solo ${course.code}`}
                aria-label={`Reintentar consulta de ${course.code}`}
              >
                <RefreshCw size={13} className={retrying ? 'spin' : ''}/>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="all-course-sections">
        {sections.map((section) => {
          const fallback = section._fallback
          const schedule = (section.horario?.length ? section.horario : fallback?.schedule) || []
          return (
            <div className="all-section-row" key={`${course.code}-${section.seccion}`}>
              <div className="all-section-info">
                <span className="all-section-chip">{section.seccion}</span>
                <div className="all-section-text">
                  <strong>{liveProfessor(section, fallback)}</strong>
                  <div className="all-schedule-list">
                    {schedule.length ? schedule.map((item, index) => <span key={`${course.code}-${section.seccion}-${index}`}>{scheduleText(item)}</span>) : <span>Horario por publicar</span>}
                  </div>
                </div>
              </div>
              <VacancyBar section={section} />
            </div>
          )
        })}
      </div>
    </article>
  )
}

export default function AllCoursesView({ bridge }) {
  const [career, setCareer] = useState('all')
  const [plan, setPlan] = useState('all')
  const [cycle, setCycle] = useState('all')
  const [query, setQuery] = useState('')
  const [cache, setCache] = useState(() => readCache())
  const [progress, setProgress] = useState({ running: false, done: 0, total: 0, reason: '' })
  const [message, setMessage] = useState('Al abrir esta vista se hace una sola consulta inicial. El automático empieza desactivado.')
  const [autoEnabled, setAutoEnabled] = useState(false)
  const [autoCycle, setAutoCycle] = useState(0)
  const [nextAutoAt, setNextAutoAt] = useState(null)
  const [singleRefreshCode, setSingleRefreshCode] = useState('')

  const runningRef = useRef(false)
  const mountedRef = useRef(true)
  const refreshGenerationRef = useRef(0)
  const initialRefreshStartedRef = useRef(false)

  useEffect(() => () => {
    mountedRef.current = false
    refreshGenerationRef.current += 1
  }, [])

  const planOptions = PLAN_OPTIONS[career] || PLAN_OPTIONS.all
  const allCodes = useMemo(() => ALL_COURSES_CATALOG.map((course) => course.code), [])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es-PE')
    return ALL_COURSES_CATALOG
      .filter((course) => courseMatchesCareer(course, career))
      .filter((course) => courseMatchesPlan(course, career, plan))
      .filter((course) => courseMatchesCycle(course, career, plan, cycle))
      .filter((course) => {
        if (!q) return true
        const professors = (course.fallbackSections || []).map((s) => s.professor || '').join(' ')
        return `${course.code} ${course.name} ${professors}`.toLocaleLowerCase('es-PE').includes(q)
      })
      .sort((a, b) => entrySort(a, b, career, plan))
  }, [career, plan, cycle, query])

  const groups = useMemo(() => {
    if (career !== 'all') {
      const grouped = new Map()
      for (const course of filtered) {
        const key = categoryLabel(primaryMeta(course, career, plan))
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key).push(course)
      }
      return [...grouped.entries()].map(([label, courses]) => ({ key: label, label, courses }))
    }

    return CAREER_ORDER.map((key) => ({
      key,
      label: CAREER_LABEL[key],
      courses: filtered.filter((course) => course.primaryCareer === key),
    })).filter((group) => group.courses.length)
  }, [career, plan, filtered])

  const refreshCodes = useMemo(() => filtered.map((course) => course.code), [filtered])

  const runRefresh = useCallback(async (codes, { reason = 'manual' } = {}) => {
    if (runningRef.current || bridge !== 'ready' || !codes?.length) return false

    const needed = [...new Set(codes.map((code) => String(code || '').trim().toUpperCase()).filter(Boolean))]
    if (!needed.length) return false

    const generation = refreshGenerationRef.current
    runningRef.current = true

    if (mountedRef.current) {
      setProgress({ running: true, done: 0, total: needed.length, reason })
      if (reason === 'initial') setMessage(`Carga inicial · consultando ${needed.length} curso(s) aperturados.`)
      else if (reason === 'auto') setMessage(`Actualización automática · consultando ${needed.length} curso(s) visibles.`)
      else if (reason === 'single') setMessage(`Reintentando solo ${needed[0]}…`)
      else setMessage(`Actualización manual · consultando ${needed.length} curso(s) visibles.`)
    }

    let working = { ...readCache() }
    let queue = needed.map((code) => ({ code, retries: 0 }))
    const finished = new Set()

    try {
      while (queue.length) {
        if (!mountedRef.current || generation !== refreshGenerationRef.current) return false

        const batchEntries = queue.splice(0, BATCH_SIZE)
        const batch = batchEntries.map((item) => item.code)
        const response = await getAllCourseVacancies(batch)

        if (!mountedRef.current || generation !== refreshGenerationRef.current) return false

        const returned = Array.isArray(response?.courses) ? response.courses : []
        const returnedByCode = new Map(returned.map((item) => [String(item?.codigo || '').toUpperCase(), item]))
        const retryLater = []
        let hitRateLimit = false

        for (const entry of batchEntries) {
          const code = entry.code
          const result = returnedByCode.get(code)
          const errorCode = String(result?.error || '')
          const rateLimited = /HTTP_?429|DEFERRED_RATE_LIMIT/i.test(errorCode)

          if (Array.isArray(result?.secciones) && result.secciones.length > 0) {
            working[code] = {
              secciones: result.secciones,
              updatedAt: response?.updatedAt || new Date().toISOString(),
              lastAttemptAt: new Date().toISOString(),
              error: '',
            }
            finished.add(code)
            continue
          }

          if (rateLimited) {
            hitRateLimit = true
            if (entry.retries < MAX_RATE_RETRIES) {
              retryLater.push({ code, retries: entry.retries + 1 })
              continue
            }
          }

          const previous = working[code] || {}
          working[code] = {
            ...previous,
            lastAttemptAt: new Date().toISOString(),
            error: errorCode || 'SIN_DATOS_EN_RESPUESTA',
          }
          finished.add(code)
        }

        queue.push(...retryLater)
        localStorage.setItem(CACHE_KEY, JSON.stringify(working))

        if (mountedRef.current) {
          setCache({ ...working })
          setProgress({ running: true, done: finished.size, total: needed.length, reason })
        }

        if (hitRateLimit) {
          if (mountedRef.current) setMessage(`La UNI limitó temporalmente las consultas. Pausa de ${Math.round(RATE_LIMIT_PAUSE_MS / 1000)} s y reintento automático de los pendientes.`)
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_PAUSE_MS))
        } else if (response?.rateRemaining !== null && Number(response?.rateRemaining) <= 5 && queue.length) {
          if (mountedRef.current) setMessage(`Quedan pocas consultas disponibles. Pausa corta para evitar HTTP 429 · ${finished.size}/${needed.length}.`)
          await new Promise((resolve) => setTimeout(resolve, LOW_RATE_PAUSE_MS))
        } else if (queue.length) {
          if (mountedRef.current) {
            const prefix = reason === 'initial' ? 'Carga inicial' : reason === 'auto' ? 'Automático' : reason === 'single' ? `Reintento ${needed[0]}` : 'Manual'
            setMessage(`${prefix} · ${finished.size}/${needed.length} curso(s) listos.`)
          }
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      if (mountedRef.current) {
        if (reason === 'single') {
          const code = needed[0]
          const refreshed = working?.[code]
          const ok = Array.isArray(refreshed?.secciones) && refreshed.secciones.length > 0
          setMessage(ok
            ? `${code} actualizado correctamente.`
            : `${code} todavía no devolvió vacantes. Puedes volver a usar ↻ en ese curso.`)
        } else {
          const withData = needed.filter((code) => Array.isArray(working?.[code]?.secciones) && working[code].secciones.length > 0).length
          const pending = Math.max(0, needed.length - withData)
          const suffix = autoEnabled ? ' Automático activo: próxima revisión en 10 min.' : ' Automático desactivado.'
          setMessage(`Consulta terminada · ${finished.size}/${needed.length} intentados · ${withData} con datos${pending ? ` · ${pending} pendientes` : ''}.${suffix}`)
        }
      }
      return true
    } catch (error) {
      if (mountedRef.current) {
        const code = error?.message || String(error)
        setMessage(code.includes('SESSION_REQUIRED') ? 'Inicia sesión en Matrícula UNI para consultar vacantes.' : `No se pudo completar la consulta: ${code}`)
      }
      return false
    } finally {
      runningRef.current = false
      if (mountedRef.current) setProgress((current) => ({ ...current, running: false }))
    }
  }, [autoEnabled, bridge])

  // ÚNICA consulta automática al entrar a “Todos los cursos”. Al salir de la vista
  // el componente se desmonta y no se inicia ninguna consulta desde otras secciones.
  useEffect(() => {
    if (bridge !== 'ready' || initialRefreshStartedRef.current) return
    initialRefreshStartedRef.current = true
    runRefresh(allCodes, { reason: 'initial' })
  }, [allCodes, bridge, runRefresh])

  // El automático SIEMPRE nace apagado. Solo se programa después de que el usuario
  // lo habilita explícitamente, y la primera ejecución ocurre 10 minutos después.
  useEffect(() => {
    if (!autoEnabled || bridge !== 'ready') {
      setNextAutoAt(null)
      return undefined
    }

    const target = Date.now() + AUTO_REFRESH_MS
    setNextAutoAt(target)

    const timer = window.setTimeout(async () => {
      await runRefresh(refreshCodes, { reason: 'auto' })
      if (mountedRef.current) setAutoCycle((value) => value + 1)
    }, AUTO_REFRESH_MS)

    return () => window.clearTimeout(timer)
  }, [autoCycle, autoEnabled, bridge, refreshCodes, runRefresh])

  const latest = useMemo(() => {
    const stamps = Object.values(cache || {})
      .map((item) => new Date(item?.updatedAt || 0).getTime())
      .filter((value) => Number.isFinite(value) && value > 0)
    if (!stamps.length) return 'Sin datos aún'
    return new Date(Math.max(...stamps)).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }, [cache])

  function changeCareer(nextCareer) {
    const nextOptions = PLAN_OPTIONS[nextCareer] || PLAN_OPTIONS.all
    setCareer(nextCareer)
    setPlan(nextOptions.some((item) => item.id === 'all') ? 'all' : nextOptions[0].id)
    setCycle('all')
  }

  async function manualRefresh() {
    const completed = await runRefresh(refreshCodes, { reason: 'manual' })
    if (completed && autoEnabled && mountedRef.current) setAutoCycle((value) => value + 1)
  }

  async function retrySingleCourse(code) {
    if (!code || runningRef.current || bridge !== 'ready') return
    setSingleRefreshCode(code)
    try {
      await runRefresh([code], { reason: 'single' })
    } finally {
      if (mountedRef.current) setSingleRefreshCode('')
    }
  }

  function toggleAuto() {
    setAutoEnabled((current) => {
      const next = !current
      setMessage(next
        ? 'Automático activado. La próxima consulta será en 10 minutos; puedes usar “Actualizar ahora” cuando quieras.'
        : 'Automático desactivado. No habrá más consultas periódicas en esta vista.')
      return next
    })
  }

  const nextAutoLabel = autoEnabled && nextAutoAt
    ? `Próxima automática aprox. ${new Date(nextAutoAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`
    : 'Sin actualización periódica'

  return (
    <section className="all-courses-view">
      <div className="all-courses-intro">
        <div>
          <div className="all-courses-kicker"><BookOpen size={15}/> TODOS LOS CURSOS APERTURADOS</div>
          <h2>Vacantes FIIS 2026-2</h2>
          <p>Solo aparecen cursos presentes en la Carga Horaria Oficial 2026-2. Esta vista consulta vacantes únicamente mientras está abierta.</p>
        </div>
        <div className="all-courses-refresh-note">
          <Clock3 size={15}/>
          <div><strong>{autoEnabled ? 'Automático activo · cada 10 min' : 'Automático desactivado'}</strong><span>{nextAutoLabel}</span></div>
        </div>
      </div>

      <div className="all-courses-stats">
        <div><span>Aperturados en carga</span><strong>{ALL_COURSES_CATALOG.length} cursos</strong></div>
        <div><span>Mostrando</span><strong>{filtered.length}</strong></div>
        <div><span>Último dato</span><strong>{latest}</strong></div>
        <div><span>Sesión</span><strong className={bridge === 'ready' ? 'ok' : ''}><ShieldCheck size={13}/>{bridge === 'ready' ? 'Puente listo' : 'Revisar puente'}</strong></div>
      </div>

      <div className="all-refresh-toolbar">
        <div className="all-refresh-status">
          <span className={progress.running ? 'busy' : ''}>{progress.running ? `${progress.done}/${progress.total}` : 'Listo'}</span>
          <p>{message}</p>
        </div>
        <div className="all-refresh-actions">
          <button
            type="button"
            className="all-manual-refresh"
            onClick={manualRefresh}
            disabled={progress.running || bridge !== 'ready' || !refreshCodes.length}
            title="Actualización manual de los cursos visibles con los filtros actuales."
          >
            <span className="all-manual-refresh-icon"><RefreshCw size={15} className={progress.running ? 'spin' : ''}/></span>
            <span className="all-manual-refresh-copy">
              <strong>{progress.running ? 'Consultando…' : 'Actualizar ahora'}</strong>
              <small>{progress.running ? `${progress.done}/${progress.total} cursos` : 'actualización manual'}</small>
            </span>
          </button>
          <button
            type="button"
            className={`btn all-auto-refresh ${autoEnabled ? 'active' : ''}`}
            onClick={toggleAuto}
            disabled={bridge !== 'ready'}
            title="Activa o desactiva una consulta automática cada 10 minutos. Siempre inicia desactivada al abrir esta vista."
          >
            {autoEnabled ? <Pause size={15}/> : <Play size={15}/>}
            {autoEnabled ? 'Auto · 10 min' : 'Auto desactivado'}
          </button>
        </div>
      </div>

      <div className="all-courses-filters">
        <label className="search-box all-search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, curso o profesor…"/></label>
        <select value={career} onChange={(e) => changeCareer(e.target.value)}>
          {CAREERS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setCycle('all') }}>
          {planOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>
        <select value={cycle} onChange={(e) => setCycle(e.target.value)}>
          <option value="all">Todos los ciclos</option>
          {Array.from({ length: 10 }, (_, index) => <option value={String(index + 1)} key={index + 1}>Ciclo {index + 1}</option>)}
          <option value="elective">Electivos</option>
          <option value="complementary">Complementarios / extracurriculares</option>
        </select>
      </div>

      {progress.running ? (
        <div className="all-sync-progress"><span style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}/></div>
      ) : null}

      <div className="all-groups">
        {groups.length ? groups.map((group) => (
          <section className="all-career-group" key={group.key}>
            <div className="all-group-heading"><h3>{group.label}</h3><span>{group.courses.length}</span></div>
            <div className="all-group-courses">
              {group.courses.map((course) => (
                <AllCourseCard
                  course={course}
                  live={cache?.[course.code]}
                  career={career}
                  plan={plan}
                  onRetry={retrySingleCourse}
                  retrying={singleRefreshCode === course.code}
                  refreshBlocked={progress.running || bridge !== 'ready'}
                  key={`${group.key}-${course.code}`}
                />
              ))}
            </div>
          </section>
        )) : (
          <div className="all-courses-empty"><BookOpen size={26}/><strong>No hay cursos aperturados con estos filtros.</strong><span>Prueba con otra carrera, malla, ciclo o búsqueda.</span></div>
        )}
      </div>

      <div className="all-courses-footnote">
        “Todos los cursos” no vigila, no recomienda y no intenta matricular. Al entrar hace una carga inicial; después no vuelve a consultar por sí sola salvo que actives “Auto · 10 min”. “Actualizar ahora” refresca los cursos visibles y ↻ reintenta únicamente el curso que no pudo cargar.
      </div>
    </section>
  )
}
