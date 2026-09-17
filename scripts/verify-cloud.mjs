import { readFile } from 'node:fs/promises'

const env = Object.fromEntries(
  (await readFile(new URL('../.env', import.meta.url), 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }),
)

const baseUrl = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY
for (const name of [
  'ACCESSRIDE_TEST_AGENCY_EMAIL',
  'ACCESSRIDE_TEST_AGENCY_PASSWORD',
  'ACCESSRIDE_TEST_RIDER_EMAIL',
  'ACCESSRIDE_TEST_RIDER_PASSWORD',
]) {
  if (!env[name]) throw new Error(`Set ${name} in .env`)
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(`${response.status} ${path}: ${data?.message ?? data?.error ?? text}`)
  }
  return data
}

async function login(email, password) {
  return request('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

const agencyAuth = await login(
  env.ACCESSRIDE_TEST_AGENCY_EMAIL,
  env.ACCESSRIDE_TEST_AGENCY_PASSWORD,
)
const agencyHeaders = { Authorization: `Bearer ${agencyAuth.access_token}` }

let profiles = await request('/rest/v1/profiles?username=eq.maria.johnson&select=*', {
  headers: agencyHeaders,
})

if (profiles.length === 0) {
  await request('/functions/v1/create-rider', {
    method: 'POST',
    headers: agencyHeaders,
    body: JSON.stringify({
      username: 'maria.johnson',
      password: env.ACCESSRIDE_TEST_RIDER_PASSWORD,
      fullName: 'Maria Johnson',
      dateOfBirth: '1981-04-18',
      phone: '(312) 555-0124',
      address: '2843 W Congress Pkwy, Chicago, IL',
      emergencyContactName: 'Elena Johnson',
      emergencyContactPhone: '(312) 555-0182',
      mobilityNeeds: 'Wheelchair accessible vehicle',
      communicationPreference: 'text',
    }),
  })
  profiles = await request('/rest/v1/profiles?username=eq.maria.johnson&select=*', {
    headers: agencyHeaders,
  })
}

const rider = profiles[0]
const riderAuth = await login(
  env.ACCESSRIDE_TEST_RIDER_EMAIL,
  env.ACCESSRIDE_TEST_RIDER_PASSWORD,
)
const riderHeaders = {
  Authorization: `Bearer ${riderAuth.access_token}`,
  Prefer: 'return=representation',
}

const [trip] = await request('/rest/v1/trip_requests', {
  method: 'POST',
  headers: riderHeaders,
  body: JSON.stringify({
    rider_id: rider.id,
    agency_id: rider.agency_id,
    trip_type: 'round_trip',
    pickup_address: 'AccessRide cloud verification pickup',
    destination_address: 'AccessRide cloud verification destination',
    travel_date: '2026-09-20',
    pickup_time: '09:30',
    return_pickup_time: '11:30',
    mobility_needs: rider.mobility_needs,
    status: 'requested',
  }),
})

const [sos] = await request('/rest/v1/sos_events', {
  method: 'POST',
  headers: riderHeaders,
  body: JSON.stringify({
    rider_id: rider.id,
    agency_id: rider.agency_id,
    latitude: 41.8781,
    longitude: -87.6298,
    accuracy_meters: 5,
    status: 'active',
  }),
})

const agencyTrips = await request(`/rest/v1/trip_requests?id=eq.${trip.id}&select=id,status`, {
  headers: agencyHeaders,
})
const agencySos = await request(`/rest/v1/sos_events?id=eq.${sos.id}&select=id,status`, {
  headers: agencyHeaders,
})

if (agencyTrips.length !== 1 || agencySos.length !== 1) {
  throw new Error('Agency could not read rider trip or SOS record.')
}

await request(`/rest/v1/trip_requests?id=eq.${trip.id}`, {
  method: 'DELETE',
  headers: riderHeaders,
})
await request(`/rest/v1/sos_events?id=eq.${sos.id}`, {
  method: 'DELETE',
  headers: riderHeaders,
})

console.log(JSON.stringify({
  agency_login: true,
  rider_account: rider.username,
  rider_login: true,
  trip_shared: true,
  sos_shared: true,
  test_records_cleaned: true,
}, null, 2))
