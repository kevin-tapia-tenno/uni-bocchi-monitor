import { Clock3, MapPin, Sparkles, UserRound } from 'lucide-react'
import { totalFree, urgencyClass } from '../lib/vacancy'

function prettyProfessor(value) {
  const name = (value || '').trim()
  if (!name) return 'Profesor no publicado'
  if (name !== name.toUpperCase()) return name
  return name.toLocaleLowerCase('es-PE').replace(/(^|[\s'-])\p{L}/gu, (m) => m.toLocaleUpperCase('es-PE'))
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))]
}

function SectionRow({ course, section, onRecommend, selectedTarget }) {
  const max = Number(section.vacantesMaximas || 0)
  const occupied = Number(section.vacantesOcupadas || 0)
  const free = Number(section.vacantesDisponibles || 0)
  const pct = max ? Math.min(100, Math.max(0, (occupied / max) * 100)) : 0
  const schedules = Array.isArray(section.horario) ? section.horario : []
  const professors = unique(schedules.map((h) => h.docente?.trim())).map(prettyProfessor)
  const professor = professors.length ? professors.join(' / ') : 'Profesor no publicado'
  const isSelected = selectedTarget?.type === 'section'
    && selectedTarget.codigo === course.codigo
    && selectedTarget.seccion === section.seccion

  return (
    <div className={`section-row ${isSelected ? 'bocchi-selected' : ''}`}>
      <div className="section-info">
        <div className="section-mainline">
          <span className="section-badge">{section.seccion}</span>
          <span className="professor" title={professor}>
            <UserRound size={14} /> {professor}
          </span>
          <button
            type="button"
            className={`bocchi-recommend-btn section-recommend ${isSelected ? 'active' : ''}`}
            onClick={() => onRecommend?.({ type: 'section', codigo: course.codigo, seccion: section.seccion })}
            title={`Pedir recomendación de Bocchi sobre ${course.codigo} sección ${section.seccion}`}
          >
            <Sparkles size={13} /> Bocchi
          </button>
        </div>

        <div className="schedule-list">
          {schedules.length ? schedules.map((h, idx) => (
            <span className="schedule-chip" key={`${section.seccion}-${idx}`}>
              <Clock3 size={12} />
              {h.dia || 'Día'} {h.horaInicio || ''}–{h.horaFin || ''}
              {h.aula ? <><span className="dot">·</span><MapPin size={11} />{h.aula}</> : null}
              {h.concepto ? <><span className="dot">·</span>{h.concepto}</> : null}
            </span>
          )) : <span className="schedule-chip muted">Horario no publicado</span>}
        </div>
      </div>

      <div className="vacancy-info">
        <div className="vacancy-topline">
          <span><strong>{occupied}/{max}</strong> ocupadas</span>
          <span className={`free-pill ${urgencyClass(free)}`}>{free <= 0 ? 'LLENO' : `${free} libres`}</span>
        </div>
        <div className="vacancy-bar" aria-label={`${Math.round(pct)}% ocupado`}>
          <div className="vacancy-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="vacancy-foot"><span>{Math.round(pct)}% ocupado</span><span>{Math.max(0, 100 - Math.round(pct))}% libre</span></div>
      </div>
    </div>
  )
}

export default function CourseCard({ course, onRecommend, selectedTarget }) {
  const total = totalFree(course)
  const isSelected = selectedTarget?.type === 'course' && selectedTarget.codigo === course.codigo

  return (
    <article className={`course-card ${isSelected ? 'bocchi-course-selected' : ''}`}>
      <header className="course-header">
        <div className="course-title-wrap">
          <span className="course-code">{course.codigo}</span>
          <h3>{course.nombre}</h3>
          <button
            type="button"
            className={`bocchi-recommend-btn course-recommend ${isSelected ? 'active' : ''}`}
            onClick={() => onRecommend?.({ type: 'course', codigo: course.codigo })}
            title={`Pedir recomendación de Bocchi sobre ${course.codigo}`}
          >
            <Sparkles size={13} /> Bocchi
          </button>
        </div>
        <div className="course-meta">
          <span>Ciclo {course.ciclo || '—'}</span>
          <span>{course.creditos || '—'} cr.</span>
          <span>{total} libres total</span>
        </div>
      </header>

      {course.error ? (
        <div className="course-message error">No se pudo actualizar este curso: {course.error}</div>
      ) : course.secciones?.length ? (
        course.secciones.map((section) => (
          <SectionRow
            key={`${course.codigo}-${section.seccion}`}
            course={course}
            section={section}
            onRecommend={onRecommend}
            selectedTarget={selectedTarget}
          />
        ))
      ) : (
        <div className="course-message">Curso aperturado, pero todavía no hay secciones publicadas.</div>
      )}
    </article>
  )
}
