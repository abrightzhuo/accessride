import { supabase } from './accountStore'
import type { RiderProfile, SosEvent } from './types'

type Coordinates = {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
}

function requireCloud() {
  if (!supabase) {
    throw new Error('SOS service is not connected. Contact the agency administrator.')
  }
  return supabase
}

function locationLabel(latitude: number | null, longitude: number | null) {
  if (latitude === null || longitude === null) return 'Location unavailable'
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return `${hours} hr ago`
}

function mapAlert(row: Record<string, unknown>): SosEvent {
  const related = row.profiles
  const profile = Array.isArray(related)
    ? related[0] as Record<string, unknown> | undefined
    : related as Record<string, unknown> | null
  return {
    id: String(row.id),
    rider: String(profile?.full_name ?? 'Rider'),
    phone: String(profile?.phone ?? ''),
    location: locationLabel(
      row.latitude === null ? null : Number(row.latitude),
      row.longitude === null ? null : Number(row.longitude),
    ),
    createdAt: relativeTime(String(row.created_at)),
    status: row.status === 'active' ? 'Active' : 'Acknowledged',
  }
}

export async function sendSos(profile: RiderProfile, coordinates: Coordinates): Promise<SosEvent> {
  const client = requireCloud()
  const { data, error } = await client
    .from('sos_events')
    .insert({
      rider_id: profile.id,
      agency_id: profile.agencyId,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy_meters: coordinates.accuracy,
      status: 'active',
    })
    .select('id, latitude, longitude, created_at, status')
    .single()
  if (error) throw error
  return {
    id: data.id,
    rider: profile.fullName,
    phone: profile.phone,
    location: locationLabel(data.latitude, data.longitude),
    createdAt: 'Just now',
    status: 'Active',
  }
}

export async function listActiveSos(): Promise<SosEvent[]> {
  const client = requireCloud()
  const { data, error } = await client
    .from('sos_events')
    .select('id, latitude, longitude, created_at, status, profiles!sos_events_rider_id_fkey(full_name, phone)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((row) => mapAlert(row as Record<string, unknown>))
}

export async function acknowledgeSos(id: string) {
  const client = requireCloud()
  const { data: auth } = await client.auth.getUser()
  const { error } = await client
    .from('sos_events')
    .update({
      status: 'acknowledged',
      acknowledged_by: auth.user?.id ?? null,
      acknowledged_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

export function subscribeToSos(onChange: () => void) {
  if (!supabase) return () => undefined
  const channel = supabase
    .channel('agency-sos-events')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sos_events' },
      onChange,
    )
    .subscribe()
  return () => {
    void supabase?.removeChannel(channel)
  }
}
