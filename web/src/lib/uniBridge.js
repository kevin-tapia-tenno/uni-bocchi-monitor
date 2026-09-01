const SOURCE_WEB = 'UNI_BOCCHI_WEB'
const SOURCE_EXTENSION = 'UNI_BOCCHI_EXTENSION'

function request(type, payload = {}, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()

    const timer = window.setTimeout(() => {
      window.removeEventListener('message', onMessage)
      reject(new Error(type === 'PING' ? 'EXTENSION_NOT_FOUND' : 'BRIDGE_TIMEOUT'))
    }, timeoutMs)

    function onMessage(event) {
      if (event.source !== window || event.origin !== window.location.origin) return
      const msg = event.data
      if (!msg || msg.source !== SOURCE_EXTENSION || msg.requestId !== requestId) return

      window.clearTimeout(timer)
      window.removeEventListener('message', onMessage)

      if (msg.ok) resolve(msg.data ?? true)
      else reject(new Error(msg.error || 'BRIDGE_ERROR'))
    }

    window.addEventListener('message', onMessage)
    window.postMessage({ source: SOURCE_WEB, type, requestId, payload }, window.location.origin)
  })
}

export async function pingBridge() {
  return request('PING', {}, 1500)
}

export async function syncUni() {
  return request('SYNC', {}, 60000)
}

export async function getEnrollmentTurn() {
  return request('TURN', {}, 30000)
}

export async function openUni() {
  return request('OPEN_UNI', { path: '/cursos-disponibles' }, 5000)
}

export async function openEnrollment() {
  return request('OPEN_UNI', { path: '/matricula' }, 5000)
}

export async function getAllCourseVacancies(codes) {
  return request('ALL_COURSES', { codes }, 90000)
}
