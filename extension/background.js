const UNI_URL = 'https://matricula-alumno.uni.edu.pe/cursos-disponibles'
let workerTabId = null

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
    url: 'https://matricula-alumno.uni.edu.pe/cursos-disponibles*',
  })

  if (existing.length) {
    workerTabId = existing[0].id
    return existing[0]
  }

  const tab = await chrome.tabs.create({ url: UNI_URL, active: false })
  workerTabId = tab.id
  const loaded = await waitTabComplete(tab.id)

  if (!loaded.url?.includes('matricula-alumno.uni.edu.pe/cursos-disponibles')) {
    await chrome.tabs.update(tab.id, { active: true })
    throw new Error('SESSION_REQUIRED')
  }

  return loaded
}

async function sendToUniTab(tabId, attempts = 30) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: 'UNI_COLLECT' })
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw lastError || new Error('UNI_CONTENT_NOT_READY')
}

async function sync() {
  const tab = await getValidWorkerTab()
  let response

  try {
    response = await sendToUniTab(tab.id)
  } catch (error) {
    const current = await chrome.tabs.get(tab.id).catch(() => null)
    if (!current?.url?.includes('matricula-alumno.uni.edu.pe/cursos-disponibles')) {
      if (current?.id) await chrome.tabs.update(current.id, { active: true }).catch(() => {})
      return { ok: false, error: 'SESSION_REQUIRED' }
    }
    throw error
  }

  if (!response?.ok) {
    if (response?.error === 'SESSION_REQUIRED' || response?.error === 'COURSES_PAGE_REQUIRED') {
      await chrome.tabs.update(tab.id, { active: true })
    }
    return response
  }

  return response
}

async function openUni() {
  const existing = await chrome.tabs.query({ url: 'https://matricula-alumno.uni.edu.pe/*' })
  if (existing.length) {
    await chrome.tabs.update(existing[0].id, { active: true })
    return { ok: true }
  }
  await chrome.tabs.create({ url: UNI_URL, active: true })
  return { ok: true }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === workerTabId) workerTabId = null
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab || !isAllowedWebUrl(sender.tab.url || '')) {
    sendResponse({ ok: false, error: 'WEB_ORIGIN_NOT_ALLOWED' })
    return
  }

  if (message?.type === 'WEB_OPEN_UNI') {
    openUni().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
    return true
  }

  if (message?.type !== 'WEB_SYNC') return

  sync()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))

  return true
})
