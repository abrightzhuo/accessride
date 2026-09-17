import { useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { VoiceField } from './VoiceField'
import type { Trip, TripType } from './types'

export function TripForm({ editing, language, riderName, onCancel, onSave }: {
  editing: Trip | null
  language: 'en' | 'zh'
  riderName: string
  onCancel: () => void
  onSave: (trip: Trip) => Promise<void>
}) {
  const [type, setType] = useState<TripType>(editing?.type ?? 'round-trip')
  const [pickup, setPickup] = useState(editing?.pickup ?? '')
  const [destination, setDestination] = useState(editing?.destination ?? '')
  const [date, setDate] = useState(editing?.date ?? new Date().toISOString().slice(0, 10))
  const [pickupTime, setPickupTime] = useState(editing?.pickupTime ?? '')
  const [returnTime, setReturnTime] = useState(editing?.returnTime ?? '')
  const [mobility, setMobility] = useState(editing?.mobility ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!pickup || !destination || !date || !pickupTime || (type === 'round-trip' && !returnTime)) {
      setError(language === 'en' ? 'Please complete all required fields.' : '请完成所有必填项。')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: editing?.id ?? `AR-${Math.floor(1050 + Math.random() * 900)}`,
        rider: riderName,
        pickup,
        destination,
        date,
        pickupTime,
        returnTime: type === 'round-trip' ? returnTime : undefined,
        type,
        status: editing?.status ?? 'Requested',
        mobility,
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to send ride request.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="form-page">
      <div className="form-header">
        <button className="icon-button" onClick={onCancel} aria-label="Go back"><ArrowLeft /></button>
        <div>
          <h1>{editing ? (language === 'en' ? 'Change ride' : '修改行程') : (language === 'en' ? 'Request a ride' : '预约接送')}</h1>
          <p>{language === 'en' ? 'Fields marked * are required.' : '标有 * 的项目为必填项。'}</p>
        </div>
      </div>
      <div className="segmented" aria-label="Trip type">
        <button className={type === 'one-way' ? 'active' : ''} onClick={() => setType('one-way')}>{language === 'en' ? 'One way' : '单程'}</button>
        <button className={type === 'round-trip' ? 'active' : ''} onClick={() => setType('round-trip')}>{language === 'en' ? 'Round trip' : '往返'}</button>
      </div>
      <div className="form-grid">
        <VoiceField label={language === 'en' ? 'Pickup location *' : '出发地点 *'} value={pickup} onChange={setPickup} placeholder="Street address or landmark" />
        <VoiceField label={language === 'en' ? 'Destination *' : '目的地 *'} value={destination} onChange={setDestination} placeholder="Street address or agency" />
        <label className="field"><span>{language === 'en' ? 'Travel date *' : '出发日期 *'}</span><input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="field"><span>{language === 'en' ? 'Pickup time *' : '出发时间 *'}</span><input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} /></label>
        {type === 'round-trip' && <label className="field"><span>{language === 'en' ? 'Return pickup time *' : '回程出发时间 *'}</span><input type="time" value={returnTime} onChange={(e) => setReturnTime(e.target.value)} /></label>}
        <VoiceField label={language === 'en' ? 'Accessibility needs' : '无障碍需求'} value={mobility} onChange={setMobility} placeholder="Wheelchair, walker, service animal..." multiline />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button className="secondary-button" onClick={onCancel}>{language === 'en' ? 'Cancel' : '取消'}</button>
        <button className="primary-button" onClick={() => void save()} disabled={saving}><Check size={21} />{saving ? (language === 'en' ? 'Sending…' : '正在发送…') : editing ? (language === 'en' ? 'Save changes' : '保存修改') : (language === 'en' ? 'Send request' : '发送申请')}</button>
      </div>
    </section>
  )
}
