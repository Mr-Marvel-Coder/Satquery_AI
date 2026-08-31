import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Speech in and out using the browser's built-in engines. Chrome's Web Speech
 * API already handles the Indian languages the PS audience cares about, at zero
 * cost and zero latency budget — which is the honest reason to reach for it
 * before Bhashini. When Bhashini goes in, it replaces the bodies of `listen`
 * and `speak` and nothing above this file changes.
 */
export const LANGUAGES = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'മലയാളം' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
]

const SR = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

export const speechSupported = !!SR

export function useSpeech(lang = 'en-IN') {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)
  const recRef = useRef(null)
  const finalRef = useRef('')
  const onFinalRef = useRef(null)

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch {}
    setListening(false)
  }, [])

  const listen = useCallback((onFinal) => {
    if (!SR) { setError('This browser has no speech recognition. Use Chrome, or type the query.'); return }
    setError(null)
    finalRef.current = ''
    onFinalRef.current = onFinal

    const rec = new SR()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) finalRef.current += chunk
        else live += chunk
      }
      setInterim(live)
    }
    rec.onerror = (e) => {
      setError(e.error === 'not-allowed'
        ? 'Microphone blocked. Allow access in the address bar and try again.'
        : `Speech recognition stopped — ${e.error}.`)
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
      const text = finalRef.current.trim()
      if (text) onFinalRef.current?.(text)
    }

    recRef.current = rec
    setListening(true)
    rec.start()
  }, [lang])

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 1.02
    window.speechSynthesis.speak(u)
  }, [lang])

  const hush = useCallback(() => window.speechSynthesis?.cancel(), [])

  useEffect(() => () => { try { recRef.current?.abort() } catch {}; window.speechSynthesis?.cancel() }, [])

  return { listening, interim, error, listen, stop, speak, hush }
}
