export function minFree(course) {
  const values = (course.secciones || []).map((s) => Number(s.vacantesDisponibles ?? 0))
  return values.length ? Math.min(...values) : Number.POSITIVE_INFINITY
}

export function totalFree(course) {
  return (course.secciones || []).reduce((sum, s) => sum + Number(s.vacantesDisponibles ?? 0), 0)
}

export function safeRefreshSeconds(courseCount) {
  if (!courseCount) return 60
  return Math.max(20, Math.ceil((courseCount * 60) / 48))
}

export function urgencyClass(free) {
  if (free <= 0) return 'full'
  if (free <= 5) return 'danger'
  if (free <= 10) return 'warning'
  return 'good'
}

function metricsFromSection(course, section) {
  const free = Number(section.vacantesDisponibles ?? 0)
  const occupied = Number(section.vacantesOcupadas ?? 0)
  const total = Number(section.vacantesMaximas ?? 0)
  const ratio = total > 0 ? occupied / total : 0
  return { course, section, free, occupied, total, ratio }
}

function metricsFromCourse(course) {
  const sections = (course.secciones || []).map((section) => metricsFromSection(course, section))
  const total = sections.reduce((sum, item) => sum + item.total, 0)
  const occupied = sections.reduce((sum, item) => sum + item.occupied, 0)
  const free = sections.reduce((sum, item) => sum + item.free, 0)
  const ratio = total > 0 ? occupied / total : 0
  const fullSections = sections.filter((item) => item.free <= 0).length
  const criticalSections = sections.filter((item) => item.free > 0 && item.free <= 3).length
  return { course, sections, total, occupied, free, ratio, fullSections, criticalSections }
}

function sectionRecommendation(metric) {
  const { course, section, free, ratio } = metric
  const id = `${course.codigo} sección ${section.seccion}`

  if (free <= 0) {
    return {
      tone: 'full',
      state: 'full',
      label: 'Ya se llenó F',
      text: `${id} ya se llenó. F por esa sección.`,
    }
  }

  if (free <= 3 || ratio >= 0.88) {
    return {
      tone: 'danger',
      state: 'danger',
      label: 'A punto de llenarse',
      text: `${id} está por llenarse: quedan ${free} vacante${free === 1 ? '' : 's'}.`,
    }
  }

  if (free <= 8 || ratio >= 0.68) {
    return {
      tone: 'warning',
      state: 'warning',
      label: 'Se está moviendo',
      text: `${id} ya está bastante avanzada (${Math.round(ratio * 100)}% ocupado). Quedan ${free} vacantes.`,
    }
  }

  if (ratio >= 0.45) {
    return {
      tone: 'half',
      state: 'half',
      label: 'Va por la mitad',
      text: `${id} está casi a la mitad: ${Math.round(ratio * 100)}% de sus vacantes ya están ocupadas.`,
    }
  }

  return {
    tone: 'good',
    state: 'good',
    label: 'Todo chill',
    text: `${id} sigue tranquila por ahora: quedan ${free} vacantes libres.`,
  }
}

function courseRecommendation(metric) {
  const { course, free, ratio, fullSections, criticalSections, sections } = metric
  const code = `${course.codigo} · ${course.nombre}`

  if (!sections.length) {
    return {
      tone: 'idle',
      state: 'idle',
      label: 'Bocchi espera',
      text: `${code} todavía no tiene secciones publicadas.`,
    }
  }

  if (fullSections === sections.length) {
    return {
      tone: 'full',
      state: 'full',
      label: 'Curso lleno F',
      text: `${code} ya tiene todas sus secciones llenas. F.`,
    }
  }

  if (criticalSections > 0) {
    return {
      tone: 'danger',
      state: 'danger',
      label: 'Curso en riesgo',
      text: `${code} tiene ${criticalSections} sección${criticalSections === 1 ? '' : 'es'} a punto de llenarse. Quedan ${free} vacantes sumando todas sus secciones.`,
    }
  }

  if (ratio >= 0.68) {
    return {
      tone: 'warning',
      state: 'warning',
      label: 'Curso movido',
      text: `${code} ya está bastante ocupado: ${Math.round(ratio * 100)}% de sus vacantes totales están tomadas.`,
    }
  }

  if (ratio >= 0.45) {
    return {
      tone: 'half',
      state: 'half',
      label: 'Curso a media capacidad',
      text: `${code} ya está casi a la mitad: ${Math.round(ratio * 100)}% de sus vacantes totales están ocupadas.`,
    }
  }

  return {
    tone: 'good',
    state: 'good',
    label: 'Todo chill',
    text: `${code} se ve tranquilo por ahora. Quedan ${free} vacantes sumando sus secciones.`,
  }
}

export function randomRecommendationTarget(courses) {
  const validCourses = (courses || []).filter((course) => Array.isArray(course.secciones))
  if (!validCourses.length) return null

  const course = validCourses[Math.floor(Math.random() * validCourses.length)]
  const sections = course.secciones || []

  // En cada F5 se elige al azar un curso; si tiene secciones, a veces Bocchi
  // comenta una sección concreta y a veces el curso completo.
  if (sections.length && Math.random() < 0.65) {
    const section = sections[Math.floor(Math.random() * sections.length)]
    return { type: 'section', codigo: course.codigo, seccion: section.seccion }
  }

  return { type: 'course', codigo: course.codigo }
}

export function bocchiTip(courses, target = null) {
  if (!courses?.length) {
    return {
      tone: 'idle',
      state: 'idle',
      label: 'Bocchi espera',
      text: 'Bocchi está esperando tus cursos disponibles…',
    }
  }

  if (target?.type === 'section') {
    const course = courses.find((item) => item.codigo === target.codigo)
    const section = course?.secciones?.find((item) => item.seccion === target.seccion)
    if (course && section) return sectionRecommendation(metricsFromSection(course, section))
  }

  if (target?.type === 'course') {
    const course = courses.find((item) => item.codigo === target.codigo)
    if (course) return courseRecommendation(metricsFromCourse(course))
  }

  // Respaldo: si no existe el objetivo, Bocchi usa un curso aleatorio.
  const fallback = randomRecommendationTarget(courses)
  if (fallback?.type === 'section') {
    const course = courses.find((item) => item.codigo === fallback.codigo)
    const section = course?.secciones?.find((item) => item.seccion === fallback.seccion)
    if (course && section) return sectionRecommendation(metricsFromSection(course, section))
  }
  const course = courses.find((item) => item.codigo === fallback?.codigo) || courses[0]
  return courseRecommendation(metricsFromCourse(course))
}
