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
const temporaryPassword = `Verify!${Date.now()}`
const selfChangedPassword = `Self!${Date.now()}`
const originalPassword = env.ACCESSRIDE_TEST_RIDER_PASSWORD

const agencyLogin = await agency.auth.signInWithPassword({
  email: env.ACCESSRIDE_TEST_AGENCY_EMAIL,
  password: env.ACCESSRIDE_TEST_AGENCY_PASSWORD,
})
if (agencyLogin.error) throw agencyLogin.error

const { data: profile, error: profileError } = await agency
  .from('profiles')
  .select('id')
  .eq('username', 'maria.johnson')
  .single()
if (profileError) throw profileError

const riderPermissionCheck = await rider.auth.signInWithPassword({
  email: env.ACCESSRIDE_TEST_RIDER_EMAIL,
  password: originalPassword,
})
if (riderPermissionCheck.error) throw riderPermissionCheck.error
const unauthorizedReset = await rider.functions.invoke('reset-rider-password', {
  body: { riderId: profile.id, password: originalPassword },
})
if (!unauthorizedReset.error) {
  throw new Error('Rider account was incorrectly allowed to reset passwords.')
}
await rider.auth.signOut()

async function reset(password) {
  const { error } = await agency.functions.invoke('reset-rider-password', {
    body: { riderId: profile.id, password },
  })
  if (error) throw error
}

try {
  await reset(temporaryPassword)
  const temporaryLogin = await rider.auth.signInWithPassword({
    email: env.ACCESSRIDE_TEST_RIDER_EMAIL,
    password: temporaryPassword,
  })
  if (temporaryLogin.error) throw temporaryLogin.error
  await rider.auth.signOut()
} finally {
  await reset(originalPassword)
}

const restoredLogin = await rider.auth.signInWithPassword({
  email: env.ACCESSRIDE_TEST_RIDER_EMAIL,
  password: originalPassword,
})
if (restoredLogin.error) throw restoredLogin.error

try {
  const selfChange = await rider.auth.updateUser({ password: selfChangedPassword })
  if (selfChange.error) throw selfChange.error
  await rider.auth.signOut()
  const selfChangedLogin = await rider.auth.signInWithPassword({
    email: env.ACCESSRIDE_TEST_RIDER_EMAIL,
    password: selfChangedPassword,
  })
  if (selfChangedLogin.error) throw selfChangedLogin.error
  await rider.auth.signOut()
} finally {
  await reset(originalPassword)
}

const finalLogin = await rider.auth.signInWithPassword({
  email: env.ACCESSRIDE_TEST_RIDER_EMAIL,
  password: originalPassword,
})
if (finalLogin.error) throw finalLogin.error

console.log(JSON.stringify({
  agency_reset_authorized: true,
  rider_reset_blocked: true,
  rider_temporary_password_login: true,
  rider_self_change_login: true,
  original_password_restored: true,
}, null, 2))

await rider.auth.signOut()
await agency.auth.signOut()
