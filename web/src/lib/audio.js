const EFFECT_FILES = {
  click: '/audio/click.mp3',
  refresh: '/audio/refresh.mp3',
  alert: '/audio/alert.mp3',
  success: '/audio/success.mp3',
}

const RANDOM_UI_SOUND_FILES = Array.from({ length: 7 }, (_, index) =>
  `/audio/ui/sound-${String(index + 1).padStart(2, '0')}.mp3`,
)

const BGM_PLAYLIST = Array.from({ length: 10 }, (_, index) =>
  `/audio/bgm/track-${String(index + 1).padStart(2, '0')}.mp3`,
)

let ctx = null
let bgm = null
let bgmEnabled = false
let bgmVolume = 0.10
let currentTrackIndex = -1

let uiAudio = null
let uiStopTimer = null
let lastUiSoundIndex = -1
const MAX_UI_SOUND_MS = 4500

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

function clampVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0))
}

function fallbackBeep(kind = 'click', volume = 0.10) {
  try {
    const ac = getCtx()
    const oscillator = ac.createOscillator()
    const gain = ac.createGain()
    const now = ac.currentTime
    const frequency = kind === 'alert' ? 680 : kind === 'success' ? 520 : 420

    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.type = 'sine'
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11)
    oscillator.connect(gain).connect(ac.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.12)
  } catch {}
}

export async function playEffect(kind, volume = 0.10) {
  const src = EFFECT_FILES[kind]
  if (!src) return

  try {
    const audio = new Audio(src)
    audio.volume = clampVolume(volume)
    await audio.play()
  } catch {
    fallbackBeep(kind, clampVolume(volume) * 0.6)
  }
}

function randomUiSoundIndex() {
  if (RANDOM_UI_SOUND_FILES.length <= 1) return 0
  let next = Math.floor(Math.random() * RANDOM_UI_SOUND_FILES.length)
  while (next === lastUiSoundIndex) {
    next = Math.floor(Math.random() * RANDOM_UI_SOUND_FILES.length)
  }
  return next
}

function stopCurrentUiSound() {
  if (uiStopTimer) {
    window.clearTimeout(uiStopTimer)
    uiStopTimer = null
  }

  if (uiAudio) {
    try {
      uiAudio.pause()
      uiAudio.currentTime = 0
    } catch {}
    uiAudio = null
  }
}

export async function playRandomUiSound(volume = 0.10) {
  stopCurrentUiSound()

  const index = randomUiSoundIndex()
  lastUiSoundIndex = index

  try {
    const audio = new Audio(RANDOM_UI_SOUND_FILES[index])
    uiAudio = audio
    audio.preload = 'auto'
    audio.volume = clampVolume(volume)

    const cleanup = () => {
      if (uiAudio === audio) uiAudio = null
      if (uiStopTimer) {
        window.clearTimeout(uiStopTimer)
        uiStopTimer = null
      }
    }

    audio.addEventListener('ended', cleanup, { once: true })
    audio.addEventListener('error', cleanup, { once: true })

    await audio.play()

    // Uno de los clips enviados es bastante más largo que los demás.
    // Como estos son sonidos de botón, limitamos cualquier clip a 4.5 s
    // para que no invada la interfaz ni se superponga con la música.
    uiStopTimer = window.setTimeout(() => {
      if (uiAudio === audio) {
        try {
          audio.pause()
          audio.currentTime = 0
        } catch {}
        uiAudio = null
      }
      uiStopTimer = null
    }, MAX_UI_SOUND_MS)

    return {
      ok: true,
      sound: index + 1,
      total: RANDOM_UI_SOUND_FILES.length,
    }
  } catch (error) {
    stopCurrentUiSound()
    fallbackBeep('click', clampVolume(volume) * 0.5)
    return {
      ok: false,
      error: error?.message || String(error),
    }
  }
}

function randomTrackIndex() {
  if (BGM_PLAYLIST.length <= 1) return 0
  let next = Math.floor(Math.random() * BGM_PLAYLIST.length)
  while (next === currentTrackIndex) {
    next = Math.floor(Math.random() * BGM_PLAYLIST.length)
  }
  return next
}

async function playRandomTrack() {
  if (!bgmEnabled) return { ok: true }

  if (!bgm) {
    bgm = new Audio()
    bgm.preload = 'metadata'
    bgm.addEventListener('ended', () => {
      if (bgmEnabled) playRandomTrack().catch(() => {})
    })
  }

  currentTrackIndex = randomTrackIndex()
  bgm.src = BGM_PLAYLIST[currentTrackIndex]
  bgm.volume = bgmVolume
  bgm.currentTime = 0
  await bgm.play()

  return {
    ok: true,
    track: currentTrackIndex + 1,
    total: BGM_PLAYLIST.length,
  }
}

export async function setBgm(enabled, volume = 0.10) {
  bgmVolume = clampVolume(volume)
  bgmEnabled = Boolean(enabled)

  if (!bgmEnabled) {
    if (bgm) {
      bgm.pause()
      bgm.currentTime = 0
      bgm.removeAttribute('src')
      bgm.load()
    }
    currentTrackIndex = -1
    return { ok: true, enabled: false }
  }

  try {
    return await playRandomTrack()
  } catch (error) {
    bgmEnabled = false
    return {
      ok: false,
      enabled: false,
      error: error?.message || String(error),
    }
  }
}

export function setBgmVolume(volume) {
  bgmVolume = clampVolume(volume)
  if (bgm) bgm.volume = bgmVolume
}

export function getBgmState() {
  return {
    enabled: bgmEnabled,
    volume: bgmVolume,
    track: currentTrackIndex >= 0 ? currentTrackIndex + 1 : null,
    total: BGM_PLAYLIST.length,
  }
}
