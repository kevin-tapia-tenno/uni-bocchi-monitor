const UNI_BASE = 'https://matricula-alumno.uni.edu.pe'
const COURSES_URL = `${UNI_BASE}/cursos-disponibles`
const ENROLLMENT_URL = `${UNI_BASE}/matricula`

const WORKER_TAB_KEY = 'uniBocchiWorkerTabId'
const TURN_CACHE_KEY = 'uniBocchiTurnCache'
const TURN_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

let workerTabId = null
let workerPromise = null

function isAllowedWebUrl(url = '') {
  try {
    const u = new URL(url)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true
    return u.origin === 'https://uni-bocchi-monitor.vercel.app'
  } catch {
    return false
  }
}

function isUniUrl(url = '') {
  try {
    return new URL(url).origin === UNI_BASE
  } catch {
    return false
  }
}

function hasPath(url = '', pathname = '') {
  try {
    return new URL(url).origin === UNI_BASE && new URL(url).pathname === pathname
  } catch {
    return false
  }
}

async function storageGet(key) {
  const result = await chrome.storage.local.get(key)
  return result?.[key]
}

async function storageSet(key, value) {
  await chrome.storage.local.set({ [key]: value })
}

async function storageRemove(key) {
  await chrome.storage.local.remove(key)
}

function waitTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      reject(new Error('UNI_LOAD_TIMEOUT'))
    }, timeoutMs)

    function listener(id, info, tab) {
      if (id !== tabId || info.status !== 'complete') return
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve(tab)
    }

    chrome.tabs.onUpdated.addListener(listener)
  })
}

async function queryUniTabs() {
  return chrome.tabs.query({ url: `${UNI_BASE}/*` })
}

async function findExistingPathTab(pathname) {
  const tabs = await queryUniTabs()
  return tabs.find((tab) => hasPath(tab.url, pathname)) || null
}

async function resolveSavedWorker() {
  const savedId = workerTabId ?? await storageGet(WORKER_TAB_KEY)
  if (!Number.isInteger(savedId)) return null

  try {
    const tab = await chrome.tabs.get(savedId)
    workerTabId = savedId

    // Si nuestra pestaña de trabajo sigue existiendo pero fue redirigida,
    // NO creamos otra. Así evitamos la acumulación infinita de pestañas.
    if (!hasPath(tab?.url, '/cursos-disponibles')) {
      if (isUniUrl(tab?.url)) {
        throw new Error('SESSION_REQUIRED')
      }
      throw new Error('COURSES_PAGE_REQUIRED')
    }

    return tab
  } catch (error) {
    if (error?.message === 'SESSION_REQUIRED' || error?.message === 'COURSES_PAGE_REQUIRED') throw error
    workerTabId = null
    await storageRemove(WORKER_TAB_KEY).catch(() => {})
    return null
  }
}

async function acquireWorkerTab() {
  const saved = await resolveSavedWorker()
  if (saved) return saved

  // Si el usuario ya tiene Cursos disponibles abierto, lo reutilizamos.
  const existing = await findExistingPathTab('/cursos-disponibles')
  if (existing?.id) return existing

  // Segunda comprobación justo antes de crear, útil si hay dos monitores abiertos.
  const raceCheck = await findExistingPathTab('/cursos-disponibles')
  if (raceCheck?.id) return raceCheck

  // Se crea como máximo UNA pestaña de trabajo automática.
  const tab = await chrome.tabs.create({ url: COURSES_URL, active: false })
  workerTabId = tab.id
  await storageSet(WORKER_TAB_KEY, tab.id)

  const loaded = await waitTabComplete(tab.id)

  if (!hasPath(loaded?.url, '/cursos-disponibles')) {
    // Conservamos el ID para impedir que el siguiente ciclo cree otra pestaña.
    if (isUniUrl(loaded?.url)) {
      await chrome.tabs.update(tab.id, { active: true }).catch(() => {})
      throw new Error('SESSION_REQUIRED')
    }
    throw new Error('COURSES_PAGE_REQUIRED')
  }

  return loaded
}

async function getValidWorkerTab() {
  // Lock global: varias peticiones WEB_SYNC simultáneas comparten la misma creación.
  if (workerPromise) return workerPromise

  workerPromise = acquireWorkerTab()
    .finally(() => { workerPromise = null })

  return workerPromise
}

async function sendToUniTab(tabId, message, attempts = 30) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, message)
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw lastError || new Error('UNI_CONTENT_NOT_READY')
}

async function reloadAndSend(tabId, message) {
  await chrome.tabs.reload(tabId)
  await waitTabComplete(tabId)
  return sendToUniTab(tabId, message)
}

async function sync() {
  let tab
  try {
    tab = await getValidWorkerTab()
  } catch (error) {
    return { ok: false, error: error.message || String(error) }
  }

  let response

  try {
    response = await sendToUniTab(tab.id, { type: 'UNI_COLLECT' })
  } catch (error) {
    const current = await chrome.tabs.get(tab.id).catch(() => null)
    if (!current || !hasPath(current.url, '/cursos-disponibles')) {
      if (current?.id && isUniUrl(current?.url)) {
        await chrome.tabs.update(current.id, { active: true }).catch(() => {})
      }
      return { ok: false, error: 'SESSION_REQUIRED' }
    }
    response = await reloadAndSend(tab.id, { type: 'UNI_COLLECT' })
  }

  if (!response?.ok) {
    if (response?.error === 'SESSION_REQUIRED' || response?.error === 'COURSES_PAGE_REQUIRED') {
      await chrome.tabs.update(tab.id, { active: true }).catch(() => {})
    }
    return response
  }

  return response
}

function isUsableTurnCache(cache) {
  if (!cache || typeof cache !== 'object' || !cache.detected) return false

  const collectedMs = cache.collectedAt ? new Date(cache.collectedAt).getTime() : NaN
  if (Number.isFinite(collectedMs) && Date.now() - collectedMs > TURN_CACHE_MAX_AGE_MS) return false

  // Si conocemos el fin del turno, no reutilizamos un turno de hace varios días.
  const endMs = cache.endAt ? new Date(cache.endAt).getTime() : NaN
  if (Number.isFinite(endMs) && endMs < Date.now() - 24 * 60 * 60 * 1000) return false

  return true
}

async function cacheTurn(data) {
  if (data?.detected) {
    await storageSet(TURN_CACHE_KEY, data).catch(() => {})
  }
}

async function collectTurn() {
  // IMPORTANTE: consultar el turno ya NO crea una pestaña /matricula.
  // Primero buscamos una pestaña que el propio usuario ya tenga abierta.
  const existing = await findExistingPathTab('/matricula')

  if (existing?.id) {
    try {
      const response = await sendToUniTab(existing.id, { type: 'UNI_COLLECT_TURN' })
      if (response?.ok) await cacheTurn(response.data)
      return response
    } catch (error) {
      const current = await chrome.tabs.get(existing.id).catch(() => null)
      if (!current || !hasPath(current.url, '/matricula')) {
        return { ok: false, error: 'SESSION_REQUIRED' }
      }

      try {
        const response = await reloadAndSend(existing.id, { type: 'UNI_COLLECT_TURN' })
        if (response?.ok) await cacheTurn(response.data)
        return response
      } catch (retryError) {
        return { ok: false, error: retryError.message || String(retryError) }
      }
    }
  }

  // Si ya lo leímos antes, el monitor puede usarlo sin abrir nada.
  const cached = await storageGet(TURN_CACHE_KEY).catch(() => null)
  if (isUsableTurnCache(cached)) {
    return { ok: true, data: cached }
  }

  // Sin pestaña abierta y sin caché: informamos al monitor, pero NO abrimos pestañas.
  return {
    ok: true,
    data: {
      detected: false,
      needsMatriculaPage: true,
      pageMessage: 'Abre Matrícula UNI una vez y pulsa “Releer turno”.',
      collectedAt: new Date().toISOString(),
    },
  }
}

function safeUniPath(path = '') {
  if (path === '/matricula' || path.startsWith('/matricula?')) return '/matricula'
  if (path === '/cursos-disponibles' || path.startsWith('/cursos-disponibles?')) return '/cursos-disponibles'
  return '/matricula'
}

async function openUni(path = '/cursos-disponibles') {
  const finalPath = safeUniPath(path)
  const finalUrl = `${UNI_BASE}${finalPath}`
  const existing = await queryUniTabs()

  const exact = existing.find((tab) => hasPath(tab.url, finalPath))

  if (exact?.id) {
    await chrome.tabs.update(exact.id, { active: true })
    return { ok: true }
  }

  // Esta creación SOLO ocurre por clic explícito del usuario.
  await chrome.tabs.create({ url: finalUrl, active: true })
  return { ok: true }
}

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId !== workerTabId && tabId !== await storageGet(WORKER_TAB_KEY).catch(() => null)) return
  workerTabId = null
  await storageRemove(WORKER_TAB_KEY).catch(() => {})
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab || !isAllowedWebUrl(sender.tab.url || '')) {
    sendResponse({ ok: false, error: 'WEB_ORIGIN_NOT_ALLOWED' })
    return
  }

  if (message?.type === 'WEB_OPEN_UNI') {
    openUni(message?.payload?.path)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
    return true
  }

  if (message?.type === 'WEB_TURN') {
    collectTurn()
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
    return true
  }

  if (message?.type !== 'WEB_SYNC') return

  sync()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))

  return true
})
