import { useState } from 'react'
import { Mic } from 'lucide-react'

type Recognition = {
  lang: string
  interimResults: boolean
  onstart: () => void
  onend: () => void
  onerror: () => void
  onresult: (event: { results: { 0: { 0: { transcript: string } } } }) => void
  start: () => void
}

type SpeechWindow = typeof window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}

export function VoiceField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  multiline?: boolean
}) {
  const [listening, setListening] = useState(false)
  const SpeechRecognition = (window as SpeechWindow).SpeechRecognition
    || (window as SpeechWindow).webkitSpeechRecognition

  const listen = () => {
    if (!SpeechRecognition) return
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (event) => onChange(event.results[0][0].transcript)
    recognition.start()
  }

  return (
    <label className="field wide">
      <span>{label}</span>
      <span className="voice-input">
        {multiline ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        )}
        <button
          type="button"
          className={listening ? 'mic-button listening' : 'mic-button'}
          onClick={listen}
          disabled={!SpeechRecognition}
          aria-label={SpeechRecognition ? `Speak ${label}` : 'Voice input unavailable'}
          title={SpeechRecognition ? 'Voice input' : 'Voice input unavailable'}
        >
          <Mic size={22} />
        </button>
      </span>
    </label>
  )
}
