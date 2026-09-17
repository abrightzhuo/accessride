import { Accessibility, ChevronRight, Phone, Plus, ShieldAlert } from 'lucide-react'
import { SosButton } from './SosButton'
import { TripCard } from './TripCard'
import { TripForm } from './TripForm'
import type { Page, RiderProfile, SosEvent, Trip } from './types'

export function RiderApp({ page, setPage, trips, setTrips, editing, setEditing, alerts, setAlerts, language, profile, onSaveTrip }: {
  page: Page
  setPage: (page: Page) => void
  trips: Trip[]
  setTrips: (trips: Trip[]) => void
  editing: Trip | null
  setEditing: (trip: Trip | null) => void
  alerts: SosEvent[]
  setAlerts: (alerts: SosEvent[]) => void
  language: 'en' | 'zh'
  profile: RiderProfile
  onSaveTrip: (trip: Trip) => Promise<Trip>
}) {
  const riderTrips = trips.filter((trip) => trip.rider === profile.fullName)

  if (page === 'request') return (
    <TripForm
      editing={editing}
      language={language}
      riderName={profile.fullName}
      onCancel={() => { setEditing(null); setPage('home') }}
      onSave={async (trip) => {
        const saved = await onSaveTrip(trip)
        setTrips(editing ? trips.map((item) => item.id === trip.id ? saved : item) : [saved, ...trips])
        setEditing(null)
        setPage('trips')
      }}
    />
  )

  if (page === 'trips') return (
    <section className="page section-stack">
      <PageTitle title={language === 'en' ? 'My rides' : '我的行程'} subtitle={language === 'en' ? 'Review or change an upcoming ride.' : '查看或修改即将到来的接送。'} />
      {riderTrips.map((trip) => <TripCard key={trip.id} trip={trip} onEdit={() => { setEditing(trip); setPage('request') }} />)}
    </section>
  )

  if (page === 'help') return (
    <section className="page section-stack">
      <PageTitle title={language === 'en' ? 'Help & safety' : '帮助与安全'} subtitle={language === 'en' ? 'Get support in the way that works for you.' : '选择适合您的方式获得帮助。'} />
      <SupportLink href="tel:+13125550110" icon={<Phone />} title={language === 'en' ? 'Call transportation support' : '致电接送服务中心'} detail="(312) 555-0110" />
      <SupportLink href="tel:711" icon={<Accessibility />} title={language === 'en' ? 'Call 711 relay service' : '呼叫 711 转接服务'} detail={language === 'en' ? 'TTY and voice relay' : 'TTY 与语音转接'} />
      <div className="safety-note"><ShieldAlert size={24} /><p><strong>{language === 'en' ? 'Immediate danger?' : '有即时危险？'}</strong><br />{language === 'en' ? 'Call 911. AccessRide does not replace emergency services.' : '请拨打 911。AccessRide 不能替代紧急救援服务。'}</p></div>
    </section>
  )

  const nextTrip = riderTrips[0]
  return (
    <section className="page rider-home">
      <div className="welcome"><p>{language === 'en' ? `Hello, ${profile.fullName}` : `您好，${profile.fullName}`}</p><h1>{language === 'en' ? 'Where do you need to go?' : '您需要去哪里？'}</h1></div>
      <button className="request-button" onClick={() => { setEditing(null); setPage('request') }}><span><Plus size={28} /></span><strong>{language === 'en' ? 'Request a ride' : '预约接送'}</strong><ChevronRight /></button>
      <SosButton language={language} profile={profile} onSent={(alert) => setAlerts([alert, ...alerts])} />
      {nextTrip && <div className="next-section">
        <div className="section-heading"><h2>{language === 'en' ? 'Your next trip' : '下一次行程'}</h2><button onClick={() => setPage('trips')}>{language === 'en' ? 'View all' : '查看全部'}</button></div>
        <TripCard trip={nextTrip} onEdit={() => { setEditing(nextTrip); setPage('request') }} />
      </div>}
    </section>
  )
}

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="page-title"><h1>{title}</h1><p>{subtitle}</p></div>
}

function SupportLink({ href, icon, title, detail }: { href: string; icon: React.ReactNode; title: string; detail: string }) {
  return <a className="support-row" href={href}><span className="support-icon">{icon}</span><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight /></a>
}
