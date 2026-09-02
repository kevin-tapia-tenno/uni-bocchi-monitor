(() => {
  'use strict'

  const CONFIG = {
    concurrency: 4,
    tableTimeoutMs: 18000,
    turnTimeoutMs: 15000,
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  // Serializa las operaciones del mismo tab trabajador para que el monitor normal
  // y “Todos los cursos” no disparen lotes simultáneos contra la API UNI.
  let operationQueue = Promise.resolve()
  function enqueueOperation(task) {
    const run = operationQueue.catch(() => {}).then(task)
    operationQueue = run.catch(() => {})
    return run
  }

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

  function normalizeCourseCodeForApi(value = '') {
    // La carga horaria publica algunos cursos de Software como SW-603, SW-608
    // y SW-609, pero el endpoint de Matrícula usa el código canónico sin guion.
    // Conservamos course.codigo original para la UI/caché y normalizamos solo la URL.
    return String(value || '').trim().toUpperCase().replace(/-/g, '')
  }

  async function fetchCourse(course, token) {
    const apiCode = normalizeCourseCodeForApi(course.codigo)
    const response = await fetch(`/api/matricula/cursos/${encodeURIComponent(apiCode)}/horarios`, {
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


  async function collectCodes(rawCodes = []) {
    if (!location.pathname.includes('/cursos-disponibles')) {
      throw new Error('COURSES_PAGE_REQUIRED')
    }

    const token = getAccessToken()
    if (!token) throw new Error('SESSION_REQUIRED')

    const codes = [...new Set((Array.isArray(rawCodes) ? rawCodes : [])
      .map((value) => String(value || '').trim().toUpperCase())
      .filter((value) => /^[A-Z]{2}-?\d{3}$/.test(value)))]
      .slice(0, 12)

    if (!codes.length) {
      return { courses: [], totalCourses: 0, rateRemaining: null, rateLimit: null, updatedAt: new Date().toISOString() }
    }

    const started = performance.now()
    const results = []
    const remainingValues = []
    const limitValues = []

    for (let index = 0; index < codes.length; index += 1) {
      const codigo = codes[index]
      if (index > 0) await sleep(1350)

      try {
        const result = await fetchCourse({ codigo, nombre: '', ciclo: '', creditos: '', orden: index }, token)
        if (Number.isFinite(result._rateRemaining)) remainingValues.push(result._rateRemaining)
        if (Number.isFinite(result._rateLimit)) limitValues.push(result._rateLimit)
        delete result._rateRemaining
        delete result._rateLimit
        results.push(result)
      } catch (error) {
        results.push({ codigo, secciones: [], error: error.message || String(error) })

        // Ante 429 paramos el lote. La web conserva la caché y reintentará después.
        if (Number(error?.status) === 429 || /HTTP_?429/i.test(error?.message || '')) {
          for (const deferred of codes.slice(index + 1)) {
            results.push({ codigo: deferred, secciones: [], error: 'DEFERRED_RATE_LIMIT' })
          }
          break
        }
      }
    }

    return {
      courses: results,
      totalCourses: results.length,
      rateRemaining: remainingValues.length ? Math.min(...remainingValues) : null,
      rateLimit: limitValues.length ? Math.max(...limitValues) : null,
      updatedAt: new Date().toISOString(),
      elapsedMs: Math.round(performance.now() - started),
    }
  }

  function normalizeText(value = '') {
    return value
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\r/g, '')
      .trim()
  }

  function monthIndex(name = '') {
    const key = name
      .toLocaleLowerCase('es-PE')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\./g, '')
      .slice(0, 3)

    const months = {
      ene: 0,
      feb: 1,
      mar: 2,
      abr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      ago: 7,
      sep: 8,
      set: 8,
      oct: 9,
      nov: 10,
      dic: 11,
    }

    return Object.prototype.hasOwnProperty.call(months, key) ? months[key] : null
  }

  function parseSpanishDate(match) {
    if (!match) return null
    const day = Number(match[1])
    const month = monthIndex(match[2])
    const year = Number(match[3])
    let hour = Number(match[4])
    const minute = Number(match[5])
    const meridiem = String(match[6] || '').toLocaleLowerCase('es-PE')

    if (month === null || !Number.isFinite(day) || !Number.isFinite(year) || !Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null
    }

    if (meridiem === 'a' && hour === 12) hour = 0
    if (meridiem === 'p' && hour !== 12) hour += 12

    const date = new Date(year, month, day, hour, minute, 0, 0)
    return Number.isNaN(date.getTime()) ? null : date
  }

  function dateMatches(text) {
    const regex = /(\d{1,2})\s+([a-záéíóúñ.]+)\s+(\d{4}),\s*(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/gi
    return [...text.matchAll(regex)]
  }

  async function waitForTurnContent() {
    const started = Date.now()
    while (Date.now() - started < CONFIG.turnTimeoutMs) {
      const text = normalizeText(document.body?.innerText || '')
      if (/grupo\s+de\s+matr[ií]cula/i.test(text) && /\b\d{4}\b/.test(text)) return text
      await sleep(250)
    }
    return normalizeText(document.body?.innerText || '')
  }

  function collectTurnFromText(text) {
    const lines = text.split('\n').map((line) => normalizeText(line)).filter(Boolean)
    const fullText = lines.join('\n')

    const groupMatch = fullText.match(/\b(\d{4})\s*[—–-]\s*([^\n]+)/i)
    if (!groupMatch) {
      return {
        detected: false,
        pageMessage: /todav[ií]a\s+no\s+puedes\s+matricularte/i.test(fullText)
          ? 'Todavía no puedes matricularte'
          : '',
      }
    }

    const groupCode = groupMatch[1]
    const groupName = normalizeText(groupMatch[2]).replace(/\s{2,}.*/, '')
    const groupIndex = fullText.indexOf(groupMatch[0])
    const nearby = fullText.slice(Math.max(0, groupIndex - 220), groupIndex + 700)
    const matches = dateMatches(nearby)
    const parsed = matches.map(parseSpanishDate).filter(Boolean)

    const start = parsed[0] || null
    const end = parsed[1] || null
    const pageSaysCanEnroll = /ya\s+puedes\s+matricularte|puedes\s+matricularte|matr[ií]cula\s+disponible/i.test(nearby)
      && !/todav[ií]a\s+no\s+puedes\s+matricularte/i.test(nearby)
    const blockedByTime = /todav[ií]a\s+no\s+puedes\s+matricularte|a[uú]n\s+no\s+es\s+tu\s+horario/i.test(nearby)

    return {
      detected: true,
      groupCode,
      groupName,
      startAt: start?.toISOString() || null,
      endAt: end?.toISOString() || null,
      pageSaysCanEnroll,
      blockedByTime,
      pageMessage: blockedByTime
        ? 'Aún no es tu horario de matrícula.'
        : pageSaysCanEnroll
          ? 'Tu horario de matrícula está disponible.'
          : '',
    }
  }

  async function collectTurn() {
    if (!location.pathname.includes('/matricula')) {
      throw new Error('TURN_PAGE_REQUIRED')
    }

    if (!getAccessToken()) throw new Error('SESSION_REQUIRED')

    const text = await waitForTurnContent()
    const turn = collectTurnFromText(text)

    return {
      ...turn,
      collectedAt: new Date().toISOString(),
      sourcePath: location.pathname,
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'UNI_COLLECT') {
      enqueueOperation(() => collect())
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
      return true
    }

    if (message?.type === 'UNI_COLLECT_CODES') {
      enqueueOperation(() => collectCodes(message?.codes || message?.payload?.codes || []))
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
      return true
    }

    if (message?.type === 'UNI_COLLECT_TURN') {
      collectTurn()
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
      return true
    }
  })
})()
