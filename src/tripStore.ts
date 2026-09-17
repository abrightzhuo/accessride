import { supabase } from './accountStore'
import type { RiderProfile, Trip, TripStatus } from './types'

const statusFromDatabase: Record<string, TripStatus> = {
  requested: 'Requested',
  scheduled: 'Scheduled',
  driver_assigned: 'Driver assigned',
  completed: 'Completed',
  cancelled: 'Completed',
}

const statusToDatabase: Record<TripStatus, string> = {
  Requested: 'requested',
  Scheduled: 'scheduled',
  'Driver assigned': 'driver_assigned',
  Completed: 'completed',
}

function requireCloud() {
  if (!supabase) throw new Error('Transportation service is not connected.')
  return supabase
}

function mapTrip(row: Record<string, unknown>): Trip {
  const related = row.profiles
  const profile = Array.isArray(related)
    ? related[0] as Record<string, unknown> | undefined
    : related as Record<string, unknown> | null
  return {
    id: String(row.id),
    rider: String(profile?.full_name ?? row.rider_name ?? 'Rider'),
    pickup: String(row.pickup_address),
    destination: String(row.destination_address),
    date: String(row.travel_date),
    pickupTime: String(row.pickup_time).slice(0, 5),
    returnTime: row.return_pickup_time ? String(row.return_pickup_time).slice(0, 5) : undefined,
    type: row.trip_type === 'round_trip' ? 'round-trip' : 'one-way',
    status: statusFromDatabase[String(row.status)] ?? 'Requested',
    mobility: String(profile?.mobility_needs ?? row.mobility_needs ?? ''),
  }
}

export async function listRiderTrips(profile: RiderProfile): Promise<Trip[]> {
  const client = requireCloud()
  const { data, error } = await client
    .from('trip_requests')
    .select('*')
    .eq('rider_id', profile.id)
    .order('travel_date')
    .order('pickup_time')
  if (error) throw error
  return data.map((row) => mapTrip({ ...row, rider_name: profile.fullName }))
}

export async function listAgencyTrips(): Promise<Trip[]> {
  const client = requireCloud()
  const { data, error } = await client
    .from('trip_requests')
    .select('*, profiles!trip_requests_rider_id_fkey(full_name, mobility_needs)')
    .order('travel_date')
    .order('pickup_time')
  if (error) throw error
  return data.map((row) => mapTrip(row as Record<string, unknown>))
}

export async function saveRiderTrip(profile: RiderProfile, trip: Trip): Promise<Trip> {
  const client = requireCloud()
  const values = {
    rider_id: profile.id,
    agency_id: profile.agencyId,
    trip_type: trip.type === 'round-trip' ? 'round_trip' : 'one_way',
    pickup_address: trip.pickup,
    destination_address: trip.destination,
    travel_date: trip.date,
    pickup_time: trip.pickupTime,
    return_pickup_time: trip.returnTime ?? null,
    mobility_needs: trip.mobility,
    status: statusToDatabase[trip.status],
    updated_at: new Date().toISOString(),
  }

  const isExisting = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(trip.id)
  const query = isExisting
    ? client.from('trip_requests').update(values).eq('id', trip.id)
    : client.from('trip_requests').insert(values)
  const { data, error } = await query.select().single()
  if (error) throw error
  return mapTrip({ ...data, rider_name: profile.fullName })
}

export async function updateTripStatus(id: string, status: TripStatus) {
  const client = requireCloud()
  const { error } = await client
    .from('trip_requests')
    .update({ status: statusToDatabase[status], updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export function subscribeToTrips(onChange: () => void) {
  if (!supabase) return () => undefined
  const channel = supabase
    .channel('agency-trip-requests')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trip_requests' },
      onChange,
    )
    .subscribe()
  return () => {
    void supabase?.removeChannel(channel)
  }
}
