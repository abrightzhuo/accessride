import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Accessibility,
  CalendarDays,
  Check,
  Languages,
  LockKeyhole,
  LogOut,
  Phone,
  Route,
  UserRound,
} from 'lucide-react'
import { changeRiderPassword, isCloudConfigured, loginRider, logout } from './accountStore'
import { initialAlerts, initialTrips } from './data'
import { LoginScreen } from './LoginScreen'
import { RiderApp } from './RiderApp'
import { listRiderTrips, saveRiderTrip, subscribeToTrips } from './tripStore'
import type { Page, SessionUser, SosEvent, Trip } from './types'

export function RiderPortal() {
  const [session, setSession] = useState<SessionUser | null>(null)
  const [page, setPage] = useState<Page>('home')
  const [accountOpen, setAccountOpen] = useState(false)
  const [language, setLanguage] = useState<'en' | 'zh'>('en')
  const [editing, setEditing] = useState<Trip | null>(null)
  const [alerts, setAlerts] = useState<SosEvent[]>(isCloudConfigured() ? [] : initialAlerts)
  const [trips, setTrips] = useState<Trip[]>(() => {
    if (isCloudConfigured()) return []
    const stored = localStorage.getItem('accessride-rider-trips')
    return stored ? JSON.parse(stored) : initialTrips
  })

  useEffect(() => {
    if (isCloudConfigured()) return
    localStorage.setItem('accessride-rider-trips', JSON.stringify(trips))
  }, [trips])

  useEffect(() => {
    if (!session?.profile || !isCloudConfigured()) return
    let mounted = true
    const profile = session.profile
    const refreshTrips = async () => {
      try {
        const cloudTrips = await listRiderTrips(profile)
        if (mounted) setTrips(cloudTrips)
      } catch {
        // Login remains available while a transient refresh is retried.
      }
    }
    void refreshTrips()
    const unsubscribe = subscribeToTrips(() => void refreshTrips())
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [session])

  if (!session?.profile) {
    return <LoginScreen mode="rider" onLogin={async (username, password) => setSession(await loginRider(username, password))} />
  }

  const signOut = async () => {
    await logout()
    setSession(null)
    setAccountOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => { setPage('home'); setAccountOpen(false) }} aria-label="AccessRide home">
          <span className="brand-mark"><Accessibility size={25} /></span>
          <span>AccessRide Rider</span>
        </button>
        <div className="topbar-actions">
          <button className="icon-button" onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')} aria-label="Change language"><Languages size={21} /></button>
          <button className={accountOpen ? 'icon-button selected' : 'icon-button'} onClick={() => setAccountOpen(true)} aria-label="My profile"><UserRound size={21} /></button>
          <button className="icon-button" onClick={signOut} aria-label="Sign out"><LogOut size={21} /></button>
        </div>
      </header>

      {accountOpen ? (
        <RiderAccount profile={session.profile} language={language} />
      ) : (
        <RiderApp
          page={page}
          setPage={setPage}
          trips={trips}
          setTrips={setTrips}
          editing={editing}
          setEditing={setEditing}
          alerts={alerts}
          setAlerts={setAlerts}
          language={language}
          profile={session.profile}
          onSaveTrip={(trip) => saveRiderTrip(session.profile!, trip)}
        />
      )}

      {!accountOpen && page !== 'request' && (
        <nav className="bottom-nav" aria-label="Primary navigation">
          <NavButton active={page === 'home'} label={language === 'en' ? 'Home' : '首页'} icon={<Route size={22} />} onClick={() => setPage('home')} />
          <NavButton active={page === 'trips'} label={language === 'en' ? 'My rides' : '我的行程'} icon={<CalendarDays size={22} />} onClick={() => setPage('trips')} />
          <NavButton active={page === 'help'} label={language === 'en' ? 'Help' : '帮助'} icon={<Phone size={22} />} onClick={() => setPage('help')} />
        </nav>
      )}
    </div>
  )
}

function RiderAccount({
  profile,
  language,
}: {
  profile: NonNullable<SessionUser['profile']>
  language: 'en' | 'zh'
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (newPassword.length < 8) {
      setError(language === 'en' ? 'New password must be at least 8 characters.' : '新密码至少需要 8 个字符。')
      return
    }
    if (newPassword !== confirmPassword) {
      setError(language === 'en' ? 'New passwords do not match.' : '两次输入的新密码不一致。')
      return
    }
    setSaving(true)
    try {
      await changeRiderPassword(profile.username, currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage(language === 'en' ? 'Password updated.' : '密码已更新。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update password.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="page account-page">
      <div className="page-title">
        <h1>{language === 'en' ? 'My profile' : '我的资料'}</h1>
        <p>{language === 'en' ? 'Information maintained by your transportation agency.' : '以下信息由接送机构维护。'}</p>
      </div>
      <section className="profile-details">
        <ProfileItem label={language === 'en' ? 'Full name' : '姓名'} value={profile.fullName} />
        <ProfileItem label={language === 'en' ? 'Username' : '用户名'} value={profile.username} />
        <ProfileItem label={language === 'en' ? 'Phone' : '电话'} value={profile.phone} />
        <ProfileItem label={language === 'en' ? 'Home address' : '家庭地址'} value={profile.address} />
        <ProfileItem label={language === 'en' ? 'Accessibility needs' : '无障碍需求'} value={profile.mobilityNeeds} />
        <ProfileItem label={language === 'en' ? 'Emergency contact' : '紧急联系人'} value={`${profile.emergencyContactName} · ${profile.emergencyContactPhone}`} />
      </section>
      <section className="password-section">
        <div className="section-heading"><h2><LockKeyhole size={21} /> {language === 'en' ? 'Change password' : '修改密码'}</h2></div>
        <form className="password-form" onSubmit={changePassword}>
          <label className="field"><span>{language === 'en' ? 'Current password' : '当前密码'}</span><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
          <label className="field"><span>{language === 'en' ? 'New password' : '新密码'}</span><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
          <label className="field"><span>{language === 'en' ? 'Confirm new password' : '确认新密码'}</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success"><Check size={18} /> {message}</p>}
          <button className="primary-button" disabled={saving}><LockKeyhole size={19} /> {saving ? (language === 'en' ? 'Updating…' : '正在更新…') : (language === 'en' ? 'Update password' : '更新密码')}</button>
        </form>
      </section>
    </main>
  )
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value || '—'}</strong></div>
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return <button className={active ? 'active' : ''} onClick={onClick}>{icon}<span>{label}</span></button>
}
