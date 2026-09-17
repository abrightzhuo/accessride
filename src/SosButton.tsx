import { useRef, useState, type PointerEvent } from 'react'
import { Phone, ShieldAlert } from 'lucide-react'
import { sendSos } from './sosStore'
import type { RiderProfile, SosEvent } from './types'

export function SosButton({ language, profile, onSent }: {
  language: 'en' | 'zh'
  profile: RiderProfile
  onSent: (alert: SosEvent) => void
}) {
  const timer = useRef<number | null>(null)
  const [holding, setHolding] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const deliver = async (latitude: number | null, longitude: number | null, accuracy: number | null) => {
    setHolding(false)
    setSending(true)
    setError('')
    try {
      const alert = await sendSos(profile, { latitude, longitude, accuracy })
      onSent(alert)
      setSent(true)
    } catch (reason) {
      setSent(false)
      setError(reason instanceof Error ? reason.message : 'SOS could not be sent.')
    } finally {
      setSending(false)
    }
  }

  const trigger = () => {
    if (!navigator.geolocation) {
      void deliver(null, null, null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => void deliver(position.coords.latitude, position.coords.longitude, position.coords.accuracy),
      () => void deliver(null, null, null),
      { enableHighAccuracy: true, timeout: 5000 },
    )
  }

  const start = (event?: PointerEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    if (event) {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setError('')
    setHolding(true)
    timer.current = window.setTimeout(trigger, 1500)
  }
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }

  return (
    <div className="sos-panel">
      <div>
        <span className="eyebrow"><ShieldAlert size={17} /> {language === 'en' ? 'Emergency' : '紧急情况'}</span>
        <h2>
          {error
            ? (language === 'en' ? 'SOS was not sent' : 'SOS 未发送')
            : sending
              ? (language === 'en' ? 'Sending SOS…' : '正在发送 SOS…')
              : sent
                ? (language === 'en' ? 'SOS received by dispatch' : '调度中心已收到 SOS')
                : (language === 'en' ? 'Need help now?' : '现在需要帮助？')}
        </h2>
        <p className={error ? 'sos-error' : ''}>
          {error || (sent
            ? (language === 'en' ? 'Your location was shared. Call 911 for immediate danger.' : '您的位置已共享。如有即时危险，请拨打 911。')
            : (language === 'en' ? 'Press and hold the SOS button.' : '长按 SOS 按钮发送求助。'))}
        </p>
        {(sent || error) && <a className="call-911" href="tel:911"><Phone size={18} /> {language === 'en' ? 'Call 911' : '拨打 911'}</a>}
      </div>
      <button
        className={`sos-button ${holding ? 'holding' : ''}`}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onContextMenu={(event) => event.preventDefault()}
        onDragStart={(event) => event.preventDefault()}
        onKeyDown={(e) => e.key === 'Enter' && start()}
        onKeyUp={(e) => e.key === 'Enter' && stop()}
        aria-label="Press and hold to send SOS"
        draggable={false}
        disabled={sending}
      >
        SOS<small>{sending ? 'Sending' : holding ? 'Hold…' : 'Hold'}</small>
      </button>
    </div>
  )
}
