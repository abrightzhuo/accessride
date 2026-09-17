import { BellRing, CalendarDays, Check, ChevronRight, Clock3, MapPin, Phone, Radio, Route, ShieldAlert, UsersRound } from 'lucide-react'
import { formatDate, formatTime, statusClass } from './data'
import type { SosEvent, Trip, TripStatus } from './types'

export function AgencyApp({ trips, alerts, onAcknowledge, onAdvanceTrip }: {
  trips: Trip[]
  alerts: SosEvent[]
  onAcknowledge: (id: string) => Promise<void>
  onAdvanceTrip: (trip: Trip, status: TripStatus) => Promise<void>
}) {
  const pending = trips.filter((trip) => trip.status === 'Requested').length
  const activeAlerts = alerts.filter((alert) => alert.status === 'Active')
  const advance = (trip: Trip) => {
    const status: TripStatus = trip.status === 'Requested' ? 'Scheduled' : trip.status === 'Scheduled' ? 'Driver assigned' : 'Completed'
    void onAdvanceTrip(trip, status)
  }

  return (
    <section className="agency-page">
      <div className="agency-heading">
        <div><p>Chicago Human Services</p><h1>Transportation desk</h1></div>
        <button className="notification-button" aria-label="Notifications"><BellRing /><span>{activeAlerts.length}</span></button>
      </div>
      <div className="metrics">
        <Metric icon={<Radio />} value={pending} label="Pending requests" tone="gold" />
        <Metric icon={<Route />} value={trips.length} label="Today's rides" tone="blue" />
        <Metric icon={<ShieldAlert />} value={activeAlerts.length} label="Active SOS" tone="red" />
        <Metric icon={<UsersRound />} value={3} label="Active riders" tone="violet" />
      </div>
      {activeAlerts.length > 0 && <section className="alert-section">
        <div className="section-heading"><h2><ShieldAlert size={23} /> Active SOS alerts</h2></div>
        {activeAlerts.map((alert) => <article className="alert-card" key={alert.id}>
          <div className="pulse-dot" />
          <div className="alert-main"><div><strong>{alert.rider}</strong><span>{alert.createdAt}</span></div><p><MapPin size={18} /> {alert.location}</p></div>
          <div className="alert-actions">
            <a className="call-button" href={`tel:${alert.phone.replace(/\D/g, '')}`}><Phone size={19} /> Call rider</a>
            <button onClick={() => void onAcknowledge(alert.id)}><Check size={19} /> Acknowledge</button>
          </div>
        </article>)}
      </section>}
      <section className="queue-section">
        <div className="section-heading"><h2>Ride queue</h2><span>{trips.length} requests</span></div>
        <div className="queue-table">{trips.map((trip) => <article className="queue-row" key={trip.id}>
          <div className="rider-avatar">{trip.rider.split(' ').map((word) => word[0]).join('')}</div>
          <div className="queue-rider"><strong>{trip.rider}</strong><span>{trip.id} · {trip.mobility}</span></div>
          <div className="route-summary"><span>{trip.pickup}</span><Route size={17} /><span>{trip.destination}</span></div>
          <div className="time-summary"><CalendarDays size={17} /><span>{formatDate(trip.date)}</span><Clock3 size={17} /><span>{formatTime(trip.pickupTime)}</span></div>
          <span className={statusClass[trip.status]}>{trip.status}</span>
          {trip.status !== 'Completed' ? <button className="advance-button" onClick={() => advance(trip)}>{trip.status === 'Requested' ? 'Accept' : trip.status === 'Scheduled' ? 'Assign driver' : 'Complete'}<ChevronRight size={17} /></button> : <Check size={22} className="complete-check" />}
        </article>)}</div>
      </section>
    </section>
  )
}

function Metric({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: string }) {
  return <div className={`metric ${tone}`}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></div>
}
