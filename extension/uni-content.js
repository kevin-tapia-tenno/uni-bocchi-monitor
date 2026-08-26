(() => {
  'use strict'

  const CONFIG = {
    concurrency: 4,
    tableTimeoutMs: 18000,
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  function getAccessToken() {
    const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]+)/)
    if (!match) return null
    try { return decodeURIComponent(match[1]) } catch { return match[1] }
  }

  async function waitForCoursesTable() {
    const started = Date.now()
    while (Date.now() - started < CONFIG.tableTimeoutMs) {
      if (document.querySelectorAll('table tbody tr').length) return
      await sleep(250)
    }
    throw new Error('COURSES_TABLE_NOT_FOUND')
  }

  function collectOpenCourses() {
    const rows = [...document.querySelectorAll('table tbody tr')]
    const courses = []

    rows.forEach((row, index) => {
      const cells = [...row.querySelectorAll('td')]
      if (cells.length < 2) return

      const code = (cells[0].textContent || '').trim().replace(/\s+/g, '').toUpperCase()
      if (!/^[A-Z]{2}\d{3}$/.test(code)) return

      const rowText = (row.innerText || '').replace(/\s+/g, ' ').trim()
      if (/no\s+aperturado/i.test(rowText)) return

      courses.push({
        codigo: code,
        nombre: (cells[1].textContent || '').trim().replace(/\s+/g, ' '),
        ciclo: (cells[2]?.textContent || '').trim(),
        creditos: (cells[3]?.textContent || '').trim(),
        orden: index,
      })
    })

    return courses
  }

  async function fetchCourse(course, token) {
    const response = await fetch(`/api/matricula/cursos/${encodeURIComponent(course.codigo)}/horarios`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const remaining = response.headers.get('X-Ratelimit-Remaining')
    const limit = response.headers.get('X-Ratelimit-Limit')

    if (!response.ok) {
      const error = new Error(`HTTP_${response.status}`)
      error.status = response.status
      throw error
    }

    const json = await response.json()
    return {
      ...course,
      secciones: Array.isArray(json?.secciones) ? json.secciones : [],
      _rateRemaining: remaining === null ? null : Number(remaining),
      _rateLimit: limit === null ? null : Number(limit),
    }
  }

  async function collect() {
    if (!location.pathname.includes('/cursos-disponibles')) {
      throw new Error('COURSES_PAGE_REQUIRED')
    }

    await waitForCoursesTable()
    const token = getAccessToken()
    if (!token) throw new Error('SESSION_REQUIRED')

    const courses = collectOpenCourses()
    if (!courses.length) throw new Error('NO_OPEN_COURSES')

    const started = performance.now()
    const queue = [...courses]
    const results = []
    const remainingValues = []
    const limitValues = []

    async function worker() {
      while (queue.length) {
        const course = queue.shift()
        if (!course) break

        try {
          const result = await fetchCourse(course, token)
          if (Number.isFinite(result._rateRemaining)) remainingValues.push(result._rateRemaining)
          if (Number.isFinite(result._rateLimit)) limitValues.push(result._rateLimit)
          delete result._rateRemaining
          delete result._rateLimit
          results.push(result)
        } catch (error) {
          results.push({ ...course, secciones: [], error: error.message || String(error) })
        }
      }
    }

    const workers = Math.min(CONFIG.concurrency, courses.length)
    await Promise.all(Array.from({ length: workers }, worker))
    results.sort((a, b) => a.orden - b.orden)

    return {
      courses: results,
      totalCourses: results.length,
      rateRemaining: remainingValues.length ? Math.min(...remainingValues) : null,
      rateLimit: limitValues.length ? Math.max(...limitValues) : null,
      updatedAt: new Date().toISOString(),
      elapsedMs: Math.round(performance.now() - started),
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'UNI_COLLECT') return

    collect()
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))

    return true
  })
})()
