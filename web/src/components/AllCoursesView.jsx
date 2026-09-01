import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Clock3, Search, ShieldCheck } from 'lucide-react'
import { getAllCourseVacancies } from '../lib/uniBridge'
import { ALL_COURSES_CATALOG } from '../data/allCoursesCatalog'

const CACHE_KEY = 'uni-bocchi-all-courses-cache-v1'
const REFRESH_MS = 5 * 60 * 1000
const BATCH_SIZE = 10

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

function courseMeta(course, career) {
  if (career !== 'all') return course.careerMeta?.[career] || null
  const values = Object.values(course.careerMeta || {})
  const core = values.filter((item) => item?.category === 'core' && Number.isFinite(item?.cycle))
  if (core.length) return { category: 'core', cycle: Math.min(...core.map((item) => item.cycle)) }
  if (values.some((item) => item?.category === 'complementary')) return { category: 'complementary', cycle: null }
  if (values.length) return { category: 'elective', cycle: null }
  return null
}

function courseMatchesCareer(course, career) {
  return career === 'all' || Boolean(course.careerMeta?.[career])
}

function cycleLabel(meta) {
  if (!meta || meta.category !== 'core' || !meta.cycle) return 'Electivo / complementario'
  return `Ciclo ${meta.cycle}`
}

function entrySort(a, b, career) {
  const ma = courseMeta(a, career)
  const mb = courseMeta(b, career)
  const ca = ma?.category === 'core' ? (ma.cycle || 99) : 99
  const cb = mb?.category === 'core' ? (mb.cycle || 99) : 99
  return ca - cb || a.code.localeCompare(b.code, 'es')
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
  const max = Number(section?.vacantesMaximas)
  const occupied = Number(section?.vacantesOcupadas)
  const free = Number(section?.vacantesDisponibles)
  const hasLive = Number.isFinite(max) && Number.isFinite(occupied) && Number.isFinite(free)
  const pct = hasLive && max > 0 ? Math.min(100, Math.max(0, (occupied / max) * 100)) : 0

  return (
    <div className="all-vacancy-side">
      <div className="all-vacancy-numbers">
        <strong>{hasLive ? `${occupied}/${max}` : `—/${Number.isFinite(max) ? max : '—'}`}</strong>
        <span>{hasLive ? 'matriculados' : 'esperando datos'}</span>
        <b className={hasLive && free <= 0 ? 'full' : ''}>{hasLive ? (free > 0 ? `${free} libres` : 'Lleno') : '—'}</b>
      </div>
      <div className="all-vacancy-track"><span style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function AllCourseCard({ course, live, career }) {
  const meta = courseMeta(course, career)
  const sections = mergeLiveSections(course, live)

  return (
    <article className="all-course-card">
      <div className="all-course-head">
        <div className="all-course-title">
          <span>{course.code}</span>
          <strong>{course.name}</strong>
        </div>
        <div className="all-course-meta">{cycleLabel(meta)}</div>
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
  const [cycle, setCycle] = useState('all')
  const [query, setQuery] = useState('')
  const [cache, setCache] = useState(() => readCache())
  const [progress, setProgress] = useState({ running: false, done: 0, total: 0 })
  const [message, setMessage] = useState('Los últimos datos guardados aparecen de inmediato.')
  const runningRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => () => { mountedRef.current = false }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es-PE')
    return ALL_COURSES_CATALOG
      .filter((course) => courseMatchesCareer(course, career))
      .filter((course) => {
        const meta = courseMeta(course, career)
        if (cycle === 'all') return true
        if (career === 'all') {
          const metas = Object.values(course.careerMeta || {})
          if (cycle === 'elective') return metas.some((item) => item?.category !== 'core')
          return metas.some((item) => item?.category === 'core' && Number(item?.cycle) === Number(cycle))
        }
        if (cycle === 'elective') return meta?.category !== 'core'
        return meta?.category === 'core' && Number(meta?.cycle) === Number(cycle)
      })
      .filter((course) => {
        if (!q) return true
        const professors = (course.fallbackSections || []).map((s) => s.professor || '').join(' ')
        return `${course.code} ${course.name} ${professors}`.toLocaleLowerCase('es-PE').includes(q)
      })
      .sort((a, b) => entrySort(a, b, career))
  }, [career, cycle, query])

  const groups = useMemo(() => {
    if (career !== 'all') {
      const grouped = new Map()
      for (const course of filtered) {
        const key = cycleLabel(courseMeta(course, career))
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
  }, [career, filtered])

  const refreshCodes = useMemo(() => filtered.map((course) => course.code), [filtered])

  const runRefresh = useCallback(async (codes, force = false) => {
    if (runningRef.current || bridge !== 'ready' || !codes?.length) return

    const snapshot = readCache()
    const now = Date.now()
    const needed = [...new Set(codes)].filter((code) => {
      if (force) return true
      const stamp = new Date(snapshot?.[code]?.updatedAt || 0).getTime()
      return !Number.isFinite(stamp) || now - stamp >= REFRESH_MS
    })

    if (!needed.length) {
      setMessage('Datos recientes · actualización automática cada 5 min.')
      return
    }

    runningRef.current = true
    if (mountedRef.current) setProgress({ running: true, done: 0, total: needed.length })
    let working = { ...snapshot }
    let processed = 0

    try {
      for (let index = 0; index < needed.length; index += BATCH_SIZE) {
        const batch = needed.slice(index, index + BATCH_SIZE)
        const response = await getAllCourseVacancies(batch)
        const returned = Array.isArray(response?.courses) ? response.courses : []
        const returnedByCode = new Map(returned.map((item) => [item.codigo, item]))
        const hitRateLimit = returned.some((item) => /HTTP_?429|DEFERRED_RATE_LIMIT/i.test(item?.error || ''))

        for (const code of batch) {
          const result = returnedByCode.get(code)
          if (result?.secciones?.length) {
            working[code] = {
              secciones: result.secciones,
              updatedAt: response?.updatedAt || new Date().toISOString(),
              error: '',
            }
          } else if (!working[code]) {
            working[code] = {
              secciones: [],
              updatedAt: response?.updatedAt || new Date().toISOString(),
              error: result?.error || 'SIN_DATOS',
            }
          } else if (result?.error) {
            working[code] = { ...working[code], error: result.error }
          }
        }

        processed += batch.length
        localStorage.setItem(CACHE_KEY, JSON.stringify(working))
        if (mountedRef.current) {
          setCache({ ...working })
          setProgress({ running: true, done: processed, total: needed.length })
          setMessage(`Sincronización escalonada ${processed}/${needed.length} · sin saturar la UNI.`)
        }

        if (hitRateLimit || (response?.rateRemaining !== null && Number(response?.rateRemaining) <= 5)) {
          if (mountedRef.current) setMessage('Pausa preventiva por límite de consultas. Los datos guardados siguen visibles.')
          break
        }

        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      if (mountedRef.current) setMessage('Datos al día · próxima revisión automática en ~5 min.')
    } catch (error) {
      if (mountedRef.current) {
        const code = error?.message || String(error)
        setMessage(code.includes('SESSION_REQUIRED') ? 'Inicia sesión en Matrícula UNI para consultar vacantes.' : `No se pudo completar la sincronización: ${code}`)
      }
    } finally {
      runningRef.current = false
      if (mountedRef.current) setProgress((current) => ({ ...current, running: false }))
    }
  }, [bridge])

  useEffect(() => {
    runRefresh(refreshCodes)
  }, [refreshCodes, runRefresh])

  useEffect(() => {
    const timer = window.setInterval(() => runRefresh(refreshCodes), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [refreshCodes, runRefresh])

  const latest = useMemo(() => {
    const stamps = Object.values(cache || {}).map((item) => new Date(item?.updatedAt || 0).getTime()).filter(Number.isFinite)
    if (!stamps.length) return 'Sin datos aún'
    return new Date(Math.max(...stamps)).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  }, [cache])

  return (
    <section className="all-courses-view">
      <div className="all-courses-intro">
        <div>
          <div className="all-courses-kicker"><BookOpen size={15}/> TODOS LOS CURSOS APERTURADOS</div>
          <h2>Vacantes FIIS 2026-2</h2>
          <p>Vista simple por carrera y ciclo. Se consulta únicamente la lista oficial de cursos aperturados y se reutiliza la caché local.</p>
        </div>
        <div className="all-courses-refresh-note">
          <Clock3 size={15}/>
          <div><strong>Actualización suave · 5 min</strong><span>{message}</span></div>
        </div>
      </div>

      <div className="all-courses-stats">
        <div><span>Catálogo oficial</span><strong>{ALL_COURSES_CATALOG.length} cursos</strong></div>
        <div><span>Mostrando</span><strong>{filtered.length}</strong></div>
        <div><span>Último dato</span><strong>{latest}</strong></div>
        <div><span>Sesión</span><strong className={bridge === 'ready' ? 'ok' : ''}><ShieldCheck size={13}/>{bridge === 'ready' ? 'Puente listo' : 'Revisar puente'}</strong></div>
      </div>

      <div className="all-courses-filters">
        <label className="search-box all-search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar código, curso o profesor…"/></label>
        <select value={career} onChange={(e) => { setCareer(e.target.value); setCycle('all') }}>
          {CAREERS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>
        <select value={cycle} onChange={(e) => setCycle(e.target.value)}>
          <option value="all">Todos los ciclos</option>
          {Array.from({ length: 10 }, (_, index) => <option value={String(index + 1)} key={index + 1}>Ciclo {index + 1}</option>)}
          <option value="elective">Electivos / complementarios</option>
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
              {group.courses.map((course) => <AllCourseCard course={course} live={cache?.[course.code]} career={career} key={`${group.key}-${course.code}`} />)}
            </div>
          </section>
        )) : (
          <div className="all-courses-empty"><BookOpen size={26}/><strong>No hay cursos con estos filtros.</strong><span>Prueba con otra carrera, ciclo o búsqueda.</span></div>
        )}
      </div>

      <div className="all-courses-footnote">
        La vista “Todos los cursos” no vigila, no recomienda y no intenta matricular. Solo consulta vacantes mientras esta pestaña esté abierta.
      </div>
    </section>
  )
}
