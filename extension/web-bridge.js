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

    const typeMap = {
      SYNC: 'WEB_SYNC',
      TURN: 'WEB_TURN',
      OPEN_UNI: 'WEB_OPEN_UNI',
    }

    const runtimeType = typeMap[msg.type]
    if (!runtimeType) return

    chrome.runtime.sendMessage({ type: runtimeType, payload: msg.payload || {} }, (response) => {
      const runtimeError = chrome.runtime.lastError
      if (runtimeError) {
        reply(msg.requestId, false, null, runtimeError.message)
        return
      }
      reply(msg.requestId, Boolean(response?.ok), response?.data, response?.error)
    })
  })
})()
