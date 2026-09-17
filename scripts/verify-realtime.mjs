import { createClient } from '@supabase/supabase-js'
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

const agency = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const rider = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
for (const name of [
  'ACCESSRIDE_TEST_AGENCY_EMAIL',
  'ACCESSRIDE_TEST_AGENCY_PASSWORD',
  'ACCESSRIDE_TEST_RIDER_EMAIL',
  'ACCESSRIDE_TEST_RIDER_PASSWORD',
]) {
  if (!env[name]) throw new Error(`Set ${name} in .env`)
}

const agencyLogin = await agency.auth.signInWithPassword({
  email: env.ACCESSRIDE_TEST_AGENCY_EMAIL,
  password: env.ACCESSRIDE_TEST_AGENCY_PASSWORD,
})
if (agencyLogin.error) throw agencyLogin.error

const riderLogin = await rider.auth.signInWithPassword({
  email: env.ACCESSRIDE_TEST_RIDER_EMAIL,
  password: env.ACCESSRIDE_TEST_RIDER_PASSWORD,
})
if (riderLogin.error) throw riderLogin.error

const { data: riderProfile, error: profileError } = await rider
  .from('profiles')
  .select('id, agency_id')
  .single()
if (profileError) throw profileError

let insertedId = null
let channel
try {
  const eventPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Realtime SOS event timed out.')), 15_000)
    channel = agency
      .channel(`verify-sos-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_events' },
        (payload) => {
          clearTimeout(timeout)
          resolve(payload.new)
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          clearTimeout(timeout)
          reject(new Error('Realtime channel failed.'))
        }
      })
  })

  await new Promise((resolve) => setTimeout(resolve, 1_500))
  const { data, error } = await rider
    .from('sos_events')
    .insert({
      rider_id: riderProfile.id,
      agency_id: riderProfile.agency_id,
      latitude: 41.8781,
      longitude: -87.6298,
      accuracy_meters: 5,
      status: 'active',
    })
    .select('id')
    .single()
  if (error) throw error
  insertedId = data.id

  const event = await eventPromise
  if (event.id !== insertedId) throw new Error('Realtime event did not match inserted SOS.')

  console.log(JSON.stringify({ realtime_sos_insert: true }, null, 2))
} finally {
  if (insertedId) {
    await rider.from('sos_events').delete().eq('id', insertedId)
  }
  if (channel) await agency.removeChannel(channel)
  await agency.auth.signOut()
  await rider.auth.signOut()
}
