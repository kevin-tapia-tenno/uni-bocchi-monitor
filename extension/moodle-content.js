(() => {
  'use strict'

  const MOODLE_ORIGIN = 'https://univirtual.uni.pe'
  const MAX_PAGES = 10

  function normalizeText(value = '') {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  }

  function sameMoodleOrigin(url = '') {
    try { return new URL(url, location.href).origin === MOODLE_ORIGIN } catch { return false }
  }

  function courseIdFromUrl(url = location.href) {
    try {
      const parsed = new URL(url, location.href)
      const id = Number(parsed.searchParams.get('id'))
      return Number.isInteger(id) && id > 0 ? id : null
    } catch {
      return null
    }
  }

  function profileIdFromHref(href = '') {
    try {
      const parsed = new URL(href, location.href)
      if (parsed.origin !== MOODLE_ORIGIN || !/\/user\/view\.php$/i.test(parsed.pathname)) return null
      const id = Number(parsed.searchParams.get('id'))
      return Number.isInteger(id) && id > 0 ? id : null
    } catch {
      return null
    }
  }

  function roleColumnIndex(table) {
    const headers = [...table.querySelectorAll('thead th')]
    return headers.findIndex((cell) => /\broles?\b|\brol(?:es)?\b/i.test(normalizeText(cell.textContent)))
  }

  function parseParticipants(doc) {
    const table = doc.querySelector('table#participants')
      || doc.querySelector('table[data-region="participants"]')
      || [...doc.querySelectorAll('table')].find((item) => item.querySelector('a[href*="/user/view.php?id="]'))

    if (!table) return []

    const roleIndex = roleColumnIndex(table)
    const rows = [...table.querySelectorAll('tbody tr')]
    const participants = []

    for (const row of rows) {
      const profile = row.querySelector('a[href*="/user/view.php?id="]')
      if (!profile) continue

      const id = profileIdFromHref(profile.href)
      const name = normalizeText(profile.textContent || profile.getAttribute('aria-label') || '')
      if (!id || !name) continue

      const cells = [...row.querySelectorAll('th, td')]
      const role = roleIndex >= 0 ? normalizeText(cells[roleIndex]?.textContent || '') : ''

      // Cuando Moodle expone la columna Roles, devolvemos únicamente estudiantes.
      // Si la columna no existe, conservamos el registro como participante visible.
      if (role && !/estudiante|student/i.test(role)) continue

      participants.push({ id, name, role: role || 'Estudiante' })
    }

    return participants
  }

  function pageUrls(doc, courseId) {
    const urls = new Set([`${MOODLE_ORIGIN}/user/index.php?id=${courseId}`])
    for (const anchor of doc.querySelectorAll('a[href]')) {
      const href = anchor.getAttribute('href') || ''
      if (!sameMoodleOrigin(href)) continue
      try {
        const url = new URL(href, location.href)
        if (!/\/user\/index\.php$/i.test(url.pathname)) continue
        if (Number(url.searchParams.get('id')) !== Number(courseId)) continue
        if (!url.searchParams.has('page')) continue
        urls.add(url.toString())
      } catch {}
    }

    return [...urls]
      .sort((a, b) => {
        const pa = Number(new URL(a).searchParams.get('page') || 0)
        const pb = Number(new URL(b).searchParams.get('page') || 0)
        return pa - pb
      })
      .slice(0, MAX_PAGES)
  }

  function detectPageError(doc = document) {
    const path = location.pathname
    const bodyText = normalizeText(doc.body?.innerText || '')

    if (/\/login\//i.test(path) || /iniciar\s+sesi[oó]n|log\s*in/i.test(bodyText) && !doc.querySelector('table#participants')) {
      return 'MOODLE_SESSION_REQUIRED'
    }

    if (/\/enrol\/index\.php/i.test(path)
      || /no\s+tiene\s+permiso|no\s+puede\s+acceder|you\s+cannot\s+access|not\s+enrolled/i.test(bodyText)) {
      return 'MOODLE_ACCESS_DENIED'
    }

    return ''
  }

  async function fetchPage(url) {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    })

    if (!response.ok) throw new Error(`MOODLE_HTTP_${response.status}`)

    const html = await response.text()
    const doc = new DOMParser().parseFromString(html, 'text/html')
    return { doc, finalUrl: response.url || url }
  }

  async function collectParticipants(expectedCourseId) {
    const currentId = courseIdFromUrl()
    if (!currentId || Number(currentId) !== Number(expectedCourseId)) throw new Error('MOODLE_COURSE_PAGE_REQUIRED')

    const pageError = detectPageError(document)
    if (pageError) throw new Error(pageError)

    const firstParticipants = parseParticipants(document)
    const urls = pageUrls(document, currentId)
    const found = new Map(firstParticipants.map((item) => [item.id, item]))

    for (const url of urls.slice(1)) {
      const { doc, finalUrl } = await fetchPage(url)
      if (!sameMoodleOrigin(finalUrl)) throw new Error('MOODLE_SESSION_REQUIRED')
      for (const item of parseParticipants(doc)) found.set(item.id, item)
    }

    if (!found.size) {
      const bodyText = normalizeText(document.body?.innerText || '')
      if (/0\s+participantes?\s+encontrados|no\s+participants?/i.test(bodyText)) {
        return { participants: [], total: 0 }
      }
      throw new Error('MOODLE_PARTICIPANTS_NOT_VISIBLE')
    }

    const participants = [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
    const heading = normalizeText(document.querySelector('h1')?.textContent || document.title || '')

    return {
      courseId: currentId,
      courseTitle: heading,
      participants,
      total: participants.length,
      sourceUrl: location.href,
      collectedAt: new Date().toISOString(),
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'MOODLE_COLLECT_PARTICIPANTS') return

    collectParticipants(message?.courseId)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))

    return true
  })
})()
