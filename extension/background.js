const UNI_BASE = 'https://matricula-alumno.uni.edu.pe'
const COURSES_URL = `${UNI_BASE}/cursos-disponibles`
const ENROLLMENT_URL = `${UNI_BASE}/matricula`

let workerTabId = null
let turnTabId = null

function isAllowedWebUrl(url = '') {
  try {
    const u = new URL(url)
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true
    return u.origin === 'https://uni-bocchi-monitor.vercel.app'
  } catch {
    return false
  }
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

async function getValidWorkerTab() {
  if (workerTabId !== null) {
    try {
      const tab = await chrome.tabs.get(workerTabId)
      if (tab?.url?.includes('matricula-alumno.uni.edu.pe/cursos-disponibles')) return tab
    } catch {}
    workerTabId = null
  }

  const existing = await chrome.tabs.query({
    url: `${COURSES_URL}*`,
  })

  if (existing.length) {
    workerTabId = existing[0].id
    return existing[0]
  }

  const tab = await chrome.tabs.create({ url: COURSES_URL, active: false })
  workerTabId = tab.id
  const loaded = await waitTabComplete(tab.id)

  if (!loaded.url?.includes('matricula-alumno.uni.edu.pe/cursos-disponibles')) {
    await chrome.tabs.update(tab.id, { active: true })
    throw new Error('SESSION_REQUIRED')
  }

  return loaded
}

async function getTurnTab() {
  if (turnTabId !== null) {
    try {
      const tab = await chrome.tabs.get(turnTabId)
      if (tab?.url?.includes('matricula-alumno.uni.edu.pe/matricula')) return tab
    } catch {}
    turnTabId = null
  }

  const existing = await chrome.tabs.query({
    url: `${ENROLLMENT_URL}*`,
  })

  if (existing.length) {
    turnTabId = existing[0].id
    return existing[0]
  }

  const tab = await chrome.tabs.create({ url: ENROLLMENT_URL, active: false })
  turnTabId = tab.id
  const loaded = await waitTabComplete(tab.id)

  if (!loaded.url?.includes('matricula-alumno.uni.edu.pe/matricula')) {
    await chrome.tabs.update(tab.id, { active: true }).catch(() => {})
    throw new Error('SESSION_REQUIRED')
  }

  return loaded
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
  const tab = await getValidWorkerTab()
  let response

  try {
    response = await sendToUniTab(tab.id, { type: 'UNI_COLLECT' })
  } catch (error) {
    const current = await chrome.tabs.get(tab.id).catch(() => null)
    if (!current?.url?.includes('matricula-alumno.uni.edu.pe/cursos-disponibles')) {
      if (current?.id) await chrome.tabs.update(current.id, { active: true }).catch(() => {})
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

async function collectTurn() {
  const tab = await getTurnTab()
  let response

  try {
    response = await sendToUniTab(tab.id, { type: 'UNI_COLLECT_TURN' })
  } catch (error) {
    const current = await chrome.tabs.get(tab.id).catch(() => null)
    if (!current?.url?.includes('matricula-alumno.uni.edu.pe/matricula')) {
      if (current?.id) await chrome.tabs.update(current.id, { active: true }).catch(() => {})
      return { ok: false, error: 'SESSION_REQUIRED' }
    }
    response = await reloadAndSend(tab.id, { type: 'UNI_COLLECT_TURN' })
  }

  if (!response?.ok && response?.error === 'SESSION_REQUIRED') {
    await chrome.tabs.update(tab.id, { active: true }).catch(() => {})
  }

  return response
}

function safeUniPath(path = '') {
  if (path === '/matricula' || path.startsWith('/matricula?')) return '/matricula'
  if (path === '/cursos-disponibles' || path.startsWith('/cursos-disponibles?')) return '/cursos-disponibles'
  return '/matricula'
}

async function openUni(path = '/cursos-disponibles') {
  const finalPath = safeUniPath(path)
  const finalUrl = `${UNI_BASE}${finalPath}`
  const existing = await chrome.tabs.query({ url: `${UNI_BASE}/*` })

  const exact = existing.find((tab) => {
    try { return new URL(tab.url).pathname === finalPath } catch { return false }
  })

  if (exact?.id) {
    await chrome.tabs.update(exact.id, { active: true })
    return { ok: true }
  }

  await chrome.tabs.create({ url: finalUrl, active: true })
  return { ok: true }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === workerTabId) workerTabId = null
  if (tabId === turnTabId) turnTabId = null
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
