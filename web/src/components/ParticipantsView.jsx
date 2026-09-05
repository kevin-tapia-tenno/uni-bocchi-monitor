import { useMemo, useState } from 'react'
import { ExternalLink, LoaderCircle, Search, UsersRound } from 'lucide-react'
import { ALL_COURSES_CATALOG } from '../data/allCoursesCatalog'
import { CURRENT_MOODLE_COURSE_MAP, getCurrentMoodleRoom } from '../data/currentMoodleMap'
import { getCourseParticipants } from '../lib/uniBridge'
import './ParticipantsView.css'

const CAREERS = [
  { id: 'all', label: 'Todas las carreras' },
  { id: 'industrial', label: 'Ingeniería Industrial' },
  { id: 'systems', label: 'Ingeniería de Sistemas' },
  { id: 'software', label: 'Ingeniería de Software' },
  { id: 'ai', label: 'Inteligencia Artificial' },
]

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

const CYCLE_OPTIONS = [
  { id: 'all', label: 'Todos los ciclos' },
  ...Array.from({ length: 10 }, (_, index) => ({ id: String(index + 1), label: `Ciclo ${index + 1}` })),
  { id: 'elective', label: 'Electivos' },
  { id: 'complementary', label: 'Complementarios' },
]

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

function matchesFilters(course, career, plan, cycle, query) {
  if (career !== 'all' && !course.curricula?.[career]) return false
  if (career !== 'all' && plan !== 'all' && !course.curricula?.[career]?.[plan]) return false

  if (cycle !== 'all') {
    const entries = careerPlanEntries(course, career, plan)
    if (cycle === 'elective' && !entries.some((item) => item.category === 'elective')) return false
    if (cycle === 'complementary' && !entries.some((item) => item.category === 'complementary')) return false
    if (!['elective', 'complementary'].includes(cycle)
      && !entries.some((item) => item.category === 'core' && Number(item.cycle) === Number(cycle))) return false
  }

  const q = query.trim().toLocaleLowerCase('es-PE')
  return !q || `${course.code} ${course.name}`.toLocaleLowerCase('es-PE').includes(q)
}

function errorMessage(code = '') {
  if (/MOODLE_SESSION_REQUIRED/.test(code)) return 'Inicia sesión en UniVirtual y vuelve a consultar.'
  if (/MOODLE_ACCESS_DENIED/.test(code)) return 'UniVirtual no permite ver los participantes de esta aula con tu sesión actual.'
  if (/MOODLE_PARTICIPANTS_NOT_VISIBLE/.test(code)) return 'La página del curso abrió, pero la lista de participantes no está visible para tu cuenta.'
  if (/MOODLE_COURSE_PAGE_REQUIRED/.test(code)) return 'UniVirtual redirigió la consulta a otra página.'
  if (/EXTENSION_NOT_FOUND|BRIDGE_TIMEOUT/.test(code)) return 'No se detectó la extensión UNI Bocchi Bridge.'
  return `No se pudo consultar participantes: ${code || 'error desconocido'}`
}

export default function ParticipantsView({ bridge }) {
  const [career, setCareer] = useState('all')
  const [plan, setPlan] = useState('all')
  const [cycle, setCycle] = useState('all')
  const [query, setQuery] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [section, setSection] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const planOptions = PLAN_OPTIONS[career] || PLAN_OPTIONS.all

  const courses = useMemo(() => ALL_COURSES_CATALOG
    .filter((course) => Object.values(CURRENT_MOODLE_COURSE_MAP[course.code]?.sections || {}).some((room) => room?.mapped))
    .filter((course) => matchesFilters(course, career, plan, cycle, query))
    .sort((a, b) => a.code.localeCompare(b.code, 'es')),
  [career, plan, cycle, query])

  const selectedCourse = useMemo(
    () => ALL_COURSES_CATALOG.find((course) => course.code === courseCode) || null,
    [courseCode],
  )

  const sections = useMemo(() => {
    if (!selectedCourse) return []
    return (selectedCourse.fallbackSections || [])
      .map((item) => ({
        section: item.section,
        room: getCurrentMoodleRoom(selectedCourse.code, item.section),
      }))
      .filter((item) => item.room)
      .sort((a, b) => a.section.localeCompare(b.section, 'es'))
  }, [selectedCourse])

  const selectedRoom = selectedCourse && section
    ? getCurrentMoodleRoom(selectedCourse.code, section)
    : null

  function resetSelection(next = {}) {
    if ('career' in next) setCareer(next.career)
    if ('plan' in next) setPlan(next.plan)
    if ('cycle' in next) setCycle(next.cycle)
    setCourseCode('')
    setSection('')
    setResult(null)
    setError('')
  }

  async function consult() {
    if (!selectedCourse || !selectedRoom || loading) return
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const data = await getCourseParticipants({
        courseId: selectedRoom.moodleId,
        courseCode: selectedCourse.code,
        section,
      })
      setResult(data)
    } catch (err) {
      setError(errorMessage(err?.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="participants-view">
      <div className="participants-toolbar">
        <label className="participants-search">
          <Search size={16}/>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setCourseCode(''); setSection(''); setResult(null); setError('') }} placeholder="Buscar código o curso…" />
        </label>

        <select value={career} onChange={(event) => resetSelection({ career: event.target.value, plan: 'all' })}>
          {CAREERS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>

        <select value={plan} onChange={(event) => resetSelection({ plan: event.target.value })} disabled={career === 'all'}>
          {planOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>

        <select value={cycle} onChange={(event) => resetSelection({ cycle: event.target.value })}>
          {CYCLE_OPTIONS.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>
      </div>

      <div className="participants-selector-card">
        <div className="participants-field wide">
          <span>Curso actual de la carga 2026-2</span>
          <select value={courseCode} onChange={(event) => { setCourseCode(event.target.value); setSection(''); setResult(null); setError('') }}>
            <option value="">Selecciona un curso…</option>
            {courses.map((course) => <option value={course.code} key={course.code}>{course.code} · {course.name}</option>)}
          </select>
        </div>

        <div className="participants-field">
          <span>Sección</span>
          <select value={section} onChange={(event) => { setSection(event.target.value); setResult(null); setError('') }} disabled={!selectedCourse}>
            <option value="">Selecciona…</option>
            {sections.map((item) => <option value={item.section} key={item.section}>{item.section}</option>)}
          </select>
        </div>

        <button className="participants-consult" type="button" onClick={consult} disabled={!selectedRoom || loading || bridge === 'missing'}>
          {loading ? <LoaderCircle size={17} className="spin"/> : <UsersRound size={17}/>}
          {loading ? 'Consultando…' : 'Consultar participantes'}
        </button>

        <div className="participants-room-meta">
          {selectedRoom ? <><strong>UniVirtual · {selectedRoom.moodleCode}</strong><span>ID {selectedRoom.moodleId}</span></> : <span>La consulta solo se ejecuta al pulsar el botón.</span>}
        </div>
      </div>

      {error ? (
        <div className="participants-message error">
          <strong>No se pudo obtener la lista</strong>
          <span>{error}</span>
          {/UniVirtual/.test(error) ? <a href="https://univirtual.uni.pe/" target="_blank" rel="noreferrer"><ExternalLink size={14}/> Abrir UniVirtual</a> : null}
        </div>
      ) : null}

      {result ? (
        <div className="participants-result">
          <div className="participants-result-head">
            <div>
              <span>{selectedCourse?.code}{section ? ` · Sección ${section}` : ''}</span>
              <h2>{selectedCourse?.name}</h2>
            </div>
            <div className="participants-count"><strong>{result.total ?? result.participants?.length ?? 0}</strong><span>alumnos</span></div>
          </div>

          {result.participants?.length ? (
            <div className="participants-list">
              {result.participants.map((participant, index) => (
                <div className="participant-row" key={participant.id || `${participant.name}-${index}`}>
                  <span className="participant-number">{index + 1}</span>
                  <strong>{participant.name}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="participants-empty">No se encontraron estudiantes visibles en esta aula.</div>
          )}
        </div>
      ) : (
        <div className="participants-empty-state">
          <UsersRound size={26}/>
          <strong>Selecciona curso y sección</strong>
          <span>No se consulta UniVirtual automáticamente. Solo se hace una consulta cuando pulsas “Consultar participantes”.</span>
        </div>
      )}
    </section>
  )
}
