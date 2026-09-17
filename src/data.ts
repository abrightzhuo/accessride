import type { SosEvent, Trip, TripStatus } from './types'

export const initialTrips: Trip[] = [
  {
    id: 'AR-1042',
    rider: 'Maria Johnson',
    pickup: '2843 W Congress Pkwy, Chicago',
    destination: 'Cook County Health, 1969 W Ogden Ave',
    date: '2026-09-15',
    pickupTime: '09:30',
    returnTime: '12:30',
    type: 'round-trip',
    status: 'Driver assigned',
    mobility: 'Wheelchair accessible vehicle',
  },
  {
    id: 'AR-1043',
    rider: 'James Carter',
    pickup: '720 S Michigan Ave, Chicago',
    destination: 'Social Security Office, 605 W Washington Blvd',
    date: '2026-09-15',
    pickupTime: '11:15',
    type: 'one-way',
    status: 'Scheduled',
    mobility: 'Walker assistance',
  },
  {
    id: 'AR-1044',
    rider: 'Aisha Williams',
    pickup: '1735 W 79th St, Chicago',
    destination: 'City Hall, 121 N LaSalle St',
    date: '2026-09-16',
    pickupTime: '08:00',
    returnTime: '10:45',
    type: 'round-trip',
    status: 'Requested',
    mobility: 'Service animal',
  },
]

export const initialAlerts: SosEvent[] = [{
  id: 'SOS-204',
  rider: 'Robert Davis',
  phone: '(312) 555-0187',
  location: 'Near 95th St & Halsted St, Chicago',
  createdAt: '2 min ago',
  status: 'Active',
}]

export const statusClass: Record<TripStatus, string> = {
  Requested: 'status gold',
  Scheduled: 'status blue',
  'Driver assigned': 'status violet',
  Completed: 'status gray',
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

export function formatTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2026, 0, 1, hour, minute))
}
