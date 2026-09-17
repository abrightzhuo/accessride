import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { RiderProfile, SessionUser } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null

const PROFILE_KEY = 'accessride-demo-profiles'
const PASSWORD_KEY = 'accessride-demo-passwords'
const AGENCY_EMAIL = import.meta.env.VITE_DEMO_AGENCY_EMAIL ?? ''
const AGENCY_PASSWORD = import.meta.env.VITE_DEMO_AGENCY_PASSWORD ?? ''
const RIDER_PASSWORD = import.meta.env.VITE_DEMO_RIDER_PASSWORD ?? ''

const seedProfile: RiderProfile = {
  id: 'rider-maria',
  agencyId: 'agency-chicago',
  username: 'maria.johnson',
  fullName: 'Maria Johnson',
  dateOfBirth: '1981-04-18',
  phone: '(312) 555-0124',
  address: '2843 W Congress Pkwy, Chicago, IL',
  emergencyContactName: 'Elena Johnson',
  emergencyContactPhone: '(312) 555-0182',
  mobilityNeeds: 'Wheelchair accessible vehicle',
  communicationPreference: 'text',
  status: 'active',
  createdAt: new Date().toISOString(),
}

function readProfiles(): RiderProfile[] {
  const stored = localStorage.getItem(PROFILE_KEY)
  if (stored) return JSON.parse(stored)
  localStorage.setItem(PROFILE_KEY, JSON.stringify([seedProfile]))
  return [seedProfile]
}

function writeProfiles(profiles: RiderProfile[]) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles))
}

async function hashPassword(value: string) {
  const bytes = new TextEncoder().encode(`accessride-demo:${value}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function readPasswords() {
  const stored = localStorage.getItem(PASSWORD_KEY)
  if (stored) return JSON.parse(stored) as Record<string, string>
  const passwords = { [seedProfile.username]: await hashPassword(RIDER_PASSWORD) }
  localStorage.setItem(PASSWORD_KEY, JSON.stringify(passwords))
  return passwords
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
}

function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@login.accessride.local`
}

function mapProfile(row: Record<string, unknown>): RiderProfile {
  return {
    id: String(row.id),
    agencyId: String(row.agency_id),
    username: String(row.username),
    fullName: String(row.full_name),
    dateOfBirth: String(row.date_of_birth ?? ''),
    phone: String(row.phone ?? ''),
    address: String(row.address ?? ''),
    emergencyContactName: String(row.emergency_contact_name ?? ''),
    emergencyContactPhone: String(row.emergency_contact_phone ?? ''),
    mobilityNeeds: String(row.mobility_needs ?? ''),
    communicationPreference: (row.communication_preference ?? 'text') as RiderProfile['communicationPreference'],
    status: (row.status ?? 'active') as RiderProfile['status'],
    createdAt: String(row.created_at),
  }
}

export function isCloudConfigured() {
  return Boolean(supabase)
}

export async function loginAgency(email: string, password: string): Promise<SessionUser> {
  if (!supabase) {
    if (email.trim().toLowerCase() !== AGENCY_EMAIL || password !== AGENCY_PASSWORD) {
      throw new Error('Invalid agency email or password.')
    }
    return { id: 'dispatcher-demo', role: 'dispatcher', displayName: 'Chicago Human Services' }
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', data.user.id)
    .single()
  if (profileError || !['dispatcher', 'admin'].includes(profile.role)) {
    await supabase.auth.signOut()
    throw new Error('This account is not authorized for the agency app.')
  }
  return { id: data.user.id, role: 'dispatcher', displayName: profile.full_name }
}

export async function loginRider(username: string, password: string): Promise<SessionUser> {
  const normalized = normalizeUsername(username)
  if (!supabase) {
    const passwords = await readPasswords()
    if (passwords[normalized] !== await hashPassword(password)) {
      throw new Error('Invalid username or password.')
    }
    const profile = readProfiles().find((item) => item.username === normalized && item.status === 'active')
    if (!profile) throw new Error('This rider account is inactive.')
    return { id: profile.id, role: 'rider', displayName: profile.fullName, profile }
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(normalized),
    password,
  })
  if (error) throw error
  const { data: row, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .eq('role', 'rider')
    .single()
  if (profileError) throw profileError
  const profile = mapProfile(row)
  return { id: data.user.id, role: 'rider', displayName: profile.fullName, profile }
}

export async function logout() {
  if (supabase) await supabase.auth.signOut()
}

export async function listRiders(): Promise<RiderProfile[]> {
  if (!supabase) return readProfiles()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'rider')
    .order('full_name')
  if (error) throw error
  return data.map(mapProfile)
}

export async function createRider(
  profile: Omit<RiderProfile, 'id' | 'agencyId' | 'createdAt' | 'status'>,
  password: string,
): Promise<RiderProfile> {
  const username = normalizeUsername(profile.username)
  if (!supabase) {
    const profiles = readProfiles()
    if (profiles.some((item) => item.username === username)) {
      throw new Error('Username already exists.')
    }
    const rider: RiderProfile = {
      ...profile,
      username,
      id: crypto.randomUUID(),
      agencyId: 'agency-chicago',
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    writeProfiles([...profiles, rider])
    const passwords = await readPasswords()
    passwords[username] = await hashPassword(password)
    localStorage.setItem(PASSWORD_KEY, JSON.stringify(passwords))
    return rider
  }
  const { data, error } = await supabase.functions.invoke('create-rider', {
    body: { ...profile, username, password },
  })
  if (error) throw error
  return mapProfile(data.profile)
}

export async function updateRiderStatus(id: string, status: RiderProfile['status']) {
  if (!supabase) {
    writeProfiles(readProfiles().map((item) => item.id === id ? { ...item, status } : item))
    return
  }
  const { error } = await supabase.from('profiles').update({ status }).eq('id', id)
  if (error) throw error
}

export async function resetRiderPassword(rider: RiderProfile, newPassword: string) {
  if (!supabase) {
    const passwords = await readPasswords()
    passwords[normalizeUsername(rider.username)] = await hashPassword(newPassword)
    localStorage.setItem(PASSWORD_KEY, JSON.stringify(passwords))
    return
  }
  const { error } = await supabase.functions.invoke('reset-rider-password', {
    body: { riderId: rider.id, password: newPassword },
  })
  if (error) throw error
}

export async function changeRiderPassword(username: string, currentPassword: string, newPassword: string) {
  if (!supabase) {
    const normalized = normalizeUsername(username)
    const passwords = await readPasswords()
    if (passwords[normalized] !== await hashPassword(currentPassword)) {
      throw new Error('Current password is incorrect.')
    }
    passwords[normalized] = await hashPassword(newPassword)
    localStorage.setItem(PASSWORD_KEY, JSON.stringify(passwords))
    return
  }
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password: currentPassword,
  })
  if (verifyError) throw new Error('Current password is incorrect.')
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}
