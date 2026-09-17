import { Accessibility, CalendarDays, ChevronRight } from 'lucide-react'
import { formatDate, formatTime, statusClass } from './data'
import type { Trip } from './types'

export function TripCard({ trip, onEdit }: { trip: Trip; onEdit: () => void }) {
  return (
    <article className="trip-card">
      <div className="trip-topline">
        <span className={statusClass[trip.status]}>{trip.status}</span>
        <span>{trip.id}</span>
      </div>
      <div className="trip-date">
        <CalendarDays size={20} />
        <strong>{formatDate(trip.date)}</strong>
        <span>at {formatTime(trip.pickupTime)}</span>
      </div>
      <div className="trip-route">
        <div className="route-line">
          <span className="route-dot pickup" />
          <div><small>Pickup</small><strong>{trip.pickup}</strong></div>
        </div>
        <div className="route-line">
          <span className="route-dot destination" />
          <div><small>Destination</small><strong>{trip.destination}</strong></div>
        </div>
      </div>
      <div className="trip-footer">
        <span><Accessibility size={18} />{trip.mobility || 'No special assistance requested'}</span>
        <button onClick={onEdit}>Change ride <ChevronRight size={17} /></button>
      </div>
    </article>
  )
}
