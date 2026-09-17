import { useEffect, useState, type FormEvent } from 'react'
import {
  Building2,
  Bus,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react'
import {
  createRider,
  isCloudConfigured,
  listRiders,
  loginAgency,
  logout,
  resetRiderPassword,
  updateRiderStatus,
} from './accountStore'
import { AgencyApp } from './AgencyApp'
import { initialTrips } from './data'
import { LoginScreen } from './LoginScreen'
import { acknowledgeSos, listActiveSos, subscribeToSos } from './sosStore'
import { listAgencyTrips, subscribeToTrips, updateTripStatus } from './tripStore'
import type { RiderProfile, SessionUser, SosEvent, Trip } from './types'

type AgencyView = 'dispatch' | 'riders'

const emptyForm = {
  username: '',
  password: '',
  fullName: '',
  dateOfBirth: '',
  phone: '',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  mobilityNeeds: '',
  communicationPreference: 'text' as RiderProfile['communicationPreference'],
}

export function AgencyPortal() {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [view, setView] = useState<AgencyView>('dispatch')
  const [trips, setTrips] = useState<Trip[]>(isCloudConfigured() ? [] : initialTrips)
  const [alerts, setAlerts] = useState<SosEvent[]>([])

  useEffect(() => {
    if (!session) return
    let mounted = true
    const refreshAlerts = async () => {
      try {
        const activeAlerts = await listActiveSos()
        if (mounted) setAlerts(activeAlerts)
      } catch {
        if (mounted) setAlerts([])
      }
    }
    void refreshAlerts()
    const unsubscribe = subscribeToSos(() => void refreshAlerts())
    const fallbackRefresh = window.setInterval(() => void refreshAlerts(), 15_000)
    return () => {
      mounted = false
      unsubscribe()
      window.clearInterval(fallbackRefresh)
    }
  }, [session])

  useEffect(() => {
    if (!session || !isCloudConfigured()) return
    let mounted = true
    const refreshTrips = async () => {
      try {
        const cloudTrips = await listAgencyTrips()
        if (mounted) setTrips(cloudTrips)
      } catch {
        if (mounted) setTrips([])
      }
    }
    void refreshTrips()
    const unsubscribe = subscribeToTrips(() => void refreshTrips())
    const fallbackRefresh = window.setInterval(() => void refreshTrips(), 30_000)
    return () => {
      mounted = false
      unsubscribe()
      window.clearInterval(fallbackRefresh)
    }
  }, [session])

  if (!session) {
    return <LoginScreen mode="agency" onLogin={async (email, password) => setSession(await loginAgency(email, password))} />
  }

  const signOut = async () => {
    await logout()
    setSession(null)
  }

  const acknowledge = async (id: string) => {
    await acknowledgeSos(id)
    setAlerts(alerts.filter((alert) => alert.id !== id))
  }

  const advanceTrip = async (trip: Trip, status: Trip['status']) => {
    await updateTripStatus(trip.id, status)
    setTrips(trips.map((item) => item.id === trip.id ? { ...item, status } : item))
  }

  return (
    <div className="app-shell agency-shell">
      <header className="topbar agency-topbar">
        <button className="brand" onClick={() => setView('dispatch')} aria-label="AccessRide Agency home">
          <span className="brand-mark"><Building2 size={24} /></span>
          <span>AccessRide Agency</span>
        </button>
        <nav className="agency-nav" aria-label="Agency navigation">
          <button className={view === 'dispatch' ? 'active' : ''} onClick={() => setView('dispatch')}><Bus size={19} /> Dispatch</button>
          <button className={view === 'riders' ? 'active' : ''} onClick={() => setView('riders')}><UsersRound size={19} /> Riders</button>
        </nav>
        <button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={21} /></button>
      </header>
      {view === 'dispatch' ? (
        <AgencyApp trips={trips} alerts={alerts} onAcknowledge={acknowledge} onAdvanceTrip={advanceTrip} />
      ) : (
        <RiderDirectory />
      )}
    </div>
  )
}

function RiderDirectory() {
  const [riders, setRiders] = useState<RiderProfile[]>([])
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [resettingRider, setResettingRider] = useState<RiderProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      setRiders(await listRiders())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load riders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const filtered = riders.filter((rider) =>
    `${rider.fullName} ${rider.username} ${rider.phone}`.toLowerCase().includes(query.toLowerCase()),
  )

  const toggleStatus = async (rider: RiderProfile) => {
    const status = rider.status === 'active' ? 'inactive' : 'active'
    await updateRiderStatus(rider.id, status)
    setRiders(riders.map((item) => item.id === rider.id ? { ...item, status } : item))
  }

  return (
    <main className="agency-page rider-directory">
      <div className="directory-heading">
        <div><p>Rider management</p><h1>Rider directory</h1></div>
        <button className="primary-button" onClick={() => setFormOpen(true)}><Plus size={20} /> New rider</button>
      </div>
      <div className="directory-tools">
        <label className="search-field"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search riders" /></label>
        <button className="icon-button" onClick={refresh} aria-label="Refresh riders"><RefreshCw size={20} /></button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="rider-list">
        {!loading && filtered.map((rider) => (
          <article className="rider-row" key={rider.id}>
            <span className="rider-avatar">{rider.fullName.split(' ').map((word) => word[0]).join('').slice(0, 2)}</span>
            <div className="rider-identity"><strong>{rider.fullName}</strong><small>@{rider.username}</small></div>
            <div><small>Phone</small><strong>{rider.phone}</strong></div>
            <div><small>Accessibility</small><strong>{rider.mobilityNeeds || 'None listed'}</strong></div>
            <span className={`account-status ${rider.status}`}>{rider.status}</span>
            <button className="icon-button" onClick={() => setResettingRider(rider)} aria-label={`Reset password for ${rider.fullName}`} title="Reset password">
              <KeyRound size={19} />
            </button>
            <button className="text-button" onClick={() => toggleStatus(rider)}>
              {rider.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
          </article>
        ))}
        {loading && <p className="empty-state">Loading riders…</p>}
        {!loading && filtered.length === 0 && <p className="empty-state">No riders found.</p>}
      </div>
      {formOpen && <CreateRiderDialog onClose={() => setFormOpen(false)} onCreated={(rider) => { setRiders([...riders, rider]); setFormOpen(false) }} />}
      {resettingRider && <ResetPasswordDialog rider={resettingRider} onClose={() => setResettingRider(null)} />}
    </main>
  )
}

function ResetPasswordDialog({
  rider,
  onClose,
}: {
  rider: RiderProfile
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)

  const generatePassword = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    setPassword(`AR!${Array.from(bytes).map((byte) => (byte % 36).toString(36)).join('')}9`)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('New temporary password must be at least 8 characters.')
      return
    }
    if (!confirmed) {
      setError('Confirm that you want to replace the rider’s current password.')
      return
    }
    setSaving(true)
    try {
      await resetRiderPassword(rider, password)
      setComplete(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reset password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog reset-password-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
        <div className="dialog-header">
          <div><p>Account recovery</p><h2 id="reset-password-title">Reset rider password</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        {complete ? (
          <div className="reset-password-result">
            <p className="form-success"><UserRoundCheck size={18} /> Password reset for {rider.fullName}.</p>
            <label className="field"><span>New temporary password</span><input value={password} readOnly /></label>
            <p>Give this password directly to the rider. They can change it after signing in.</p>
            <button className="primary-button" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form className="reset-password-form" onSubmit={submit}>
            <p>You are replacing the password for <strong>{rider.fullName}</strong> (@{rider.username}).</p>
            <label className="field">
              <span>New temporary password *</span>
              <span className="generated-password">
                <input value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
                <button type="button" onClick={generatePassword} aria-label="Generate password"><KeyRound size={19} /></button>
              </span>
            </label>
            <label className="reset-confirmation">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              <span>I confirm this rider requested account recovery.</span>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
              <button className="primary-button" disabled={saving || !confirmed}><KeyRound size={19} /> {saving ? 'Resetting…' : 'Reset password'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}

function CreateRiderDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (rider: RiderProfile) => void
}) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (field: keyof typeof emptyForm, value: string) => {
    setForm({ ...form, [field]: value })
  }

  const generatePassword = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(8))
    const password = `AR!${Array.from(bytes).map((byte) => (byte % 36).toString(36)).join('')}9`
    update('password', password)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!form.dateOfBirth) {
      setError('Select the rider birth year, month, and day.')
      return
    }
    if (form.password.length < 8) {
      setError('Temporary password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      const { password, ...profile } = form
      onCreated(await createRider(profile, password))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create rider.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-rider-title">
        <div className="dialog-header">
          <div><p>New account</p><h2 id="create-rider-title">Create rider</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <form className="create-rider-form" onSubmit={submit}>
          <label className="field"><span>Full name *</span><input value={form.fullName} onChange={(event) => update('fullName', event.target.value)} required /></label>
          <BirthDateField value={form.dateOfBirth} onChange={(value) => update('dateOfBirth', value)} />
          <label className="field"><span>Phone *</span><input type="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} required /></label>
          <label className="field"><span>Username *</span><input autoCapitalize="none" value={form.username} onChange={(event) => update('username', event.target.value)} required /></label>
          <label className="field wide"><span>Home address *</span><input value={form.address} onChange={(event) => update('address', event.target.value)} required /></label>
          <label className="field"><span>Emergency contact</span><input value={form.emergencyContactName} onChange={(event) => update('emergencyContactName', event.target.value)} /></label>
          <label className="field"><span>Emergency phone</span><input type="tel" value={form.emergencyContactPhone} onChange={(event) => update('emergencyContactPhone', event.target.value)} /></label>
          <label className="field wide"><span>Accessibility needs</span><textarea rows={3} value={form.mobilityNeeds} onChange={(event) => update('mobilityNeeds', event.target.value)} /></label>
          <label className="field"><span>Communication</span><select value={form.communicationPreference} onChange={(event) => update('communicationPreference', event.target.value)}><option value="text">Text</option><option value="voice">Voice call</option><option value="relay">711 relay</option></select></label>
          <label className="field"><span>Temporary password *</span><span className="generated-password"><input value={form.password} onChange={(event) => update('password', event.target.value)} required /><button type="button" onClick={generatePassword} aria-label="Generate password"><KeyRound size={19} /></button></span></label>
          {error && <p className="form-error wide" role="alert">{error}</p>}
          <div className="dialog-actions wide"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving}><UserRoundCheck size={19} /> {saving ? 'Creating…' : 'Create account'}</button></div>
        </form>
      </section>
    </div>
  )
}

function BirthDateField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const initial = value ? value.split('-') : ['', '', '']
  const [year, setYear] = useState(initial[0])
  const [month, setMonth] = useState(initial[1])
  const [day, setDay] = useState(initial[2])
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1899 }, (_, index) => String(currentYear - index))
  const daysInMonth = year && month
    ? new Date(Number(year), Number(month), 0).getDate()
    : 31

  const commit = (nextYear: string, nextMonth: string, nextDay: string) => {
    const maximumDay = nextYear && nextMonth
      ? new Date(Number(nextYear), Number(nextMonth), 0).getDate()
      : 31
    const safeDay = nextDay && Number(nextDay) > maximumDay
      ? String(maximumDay).padStart(2, '0')
      : nextDay
    setYear(nextYear)
    setMonth(nextMonth)
    setDay(safeDay)
    onChange(nextYear && nextMonth && safeDay ? `${nextYear}-${nextMonth}-${safeDay}` : '')
  }

  return (
    <label className="field birth-date-field">
      <span>Date of birth *</span>
      <span className="birth-date-selects">
        <select aria-label="Birth year" value={year} onChange={(event) => commit(event.target.value, month, day)}>
          <option value="">Year</option>
          {years.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Birth month" value={month} onChange={(event) => commit(year, event.target.value, day)}>
          <option value="">Month</option>
          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select aria-label="Birth day" value={day} onChange={(event) => commit(year, month, event.target.value)}>
          <option value="">Day</option>
          {Array.from({ length: daysInMonth }, (_, index) => String(index + 1).padStart(2, '0')).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </span>
    </label>
  )
}
