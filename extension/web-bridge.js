(() => {
  'use strict'

  const SOURCE_WEB = 'UNI_BOCCHI_WEB'
  const SOURCE_EXTENSION = 'UNI_BOCCHI_EXTENSION'

  function reply(requestId, ok, data, error) {
    window.postMessage({
      source: SOURCE_EXTENSION,
      requestId,
      ok,
      data,
      error,
    }, window.location.origin)
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return
    const msg = event.data
    if (!msg || msg.source !== SOURCE_WEB || !msg.requestId) return

    if (msg.type === 'PING') {
      reply(msg.requestId, true, { version: chrome.runtime.getManifest().version })
      return
    }

    if (msg.type !== 'SYNC' && msg.type !== 'OPEN_UNI') return

    chrome.runtime.sendMessage({ type: msg.type === 'SYNC' ? 'WEB_SYNC' : 'WEB_OPEN_UNI' }, (response) => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        reply(msg.requestId, false, null, runtimeError.message)
        return
      }
      reply(msg.requestId, Boolean(response?.ok), response?.data, response?.error)
    })
  })
})()
