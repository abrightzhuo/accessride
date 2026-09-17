import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outputDirectory = new URL('../releases/full-demo-ui/', import.meta.url)
await mkdir(outputDirectory, { recursive: true })
const outputPath = (name) => fileURLToPath(new URL(name, outputDirectory))
const env = Object.fromEntries(
  (await readFile(new URL('../.env', import.meta.url), 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }),
)
for (const name of [
  'ACCESSRIDE_TEST_AGENCY_EMAIL',
  'ACCESSRIDE_TEST_AGENCY_PASSWORD',
  'ACCESSRIDE_TEST_RIDER_EMAIL',
  'ACCESSRIDE_TEST_RIDER_PASSWORD',
]) {
  if (!env[name]) throw new Error(`Set ${name} in .env`)
}
const riderUsername = env.ACCESSRIDE_TEST_RIDER_EMAIL.split('@')[0]
const admin = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const riderApi = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const demoPickup = '1200 Accessible Way, Chicago'

const adminLogin = await admin.auth.signInWithPassword({
  email: env.ACCESSRIDE_TEST_AGENCY_EMAIL,
  password: env.ACCESSRIDE_TEST_AGENCY_PASSWORD,
})
if (adminLogin.error) throw adminLogin.error
const riderLogin = await riderApi.auth.signInWithPassword({
  email: env.ACCESSRIDE_TEST_RIDER_EMAIL,
  password: env.ACCESSRIDE_TEST_RIDER_PASSWORD,
})
if (riderLogin.error) throw riderLogin.error
await riderApi.from('trip_requests').delete().eq('pickup_address', demoPickup)
await admin.from('sos_events').update({ status: 'acknowledged' }).eq('status', 'active')

const browser = await chromium.launch()
try {
  const riderContext = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    geolocation: { latitude: 41.8781, longitude: -87.6298 },
    permissions: ['geolocation'],
  })
  const rider = await riderContext.newPage()
  await rider.goto('http://127.0.0.1:4173')
  await rider.screenshot({ path: outputPath('01-rider-login.png'), fullPage: true })
  await rider.getByLabel('Username').fill(riderUsername)
  await rider.getByLabel('Password').fill(env.ACCESSRIDE_TEST_RIDER_PASSWORD)
  await rider.getByRole('button', { name: 'Sign in' }).click()
  await rider.getByText('Where do you need to go?').waitFor()
  await rider.screenshot({ path: outputPath('02-rider-home.png'), fullPage: true })

  await rider.getByRole('button', { name: /Request a ride/ }).click()
  await rider.getByPlaceholder('Street address or landmark').fill(demoPickup)
  await rider.getByPlaceholder('Street address or agency').fill('Chicago Mobility Center, 500 Service Plaza')
  await rider.getByLabel('Travel date *').fill('2026-09-22')
  await rider.getByLabel('Pickup time *', { exact: true }).fill('09:30')
  await rider.getByLabel('Return pickup time *').fill('14:15')
  await rider.getByPlaceholder('Wheelchair, walker, service animal...').fill('Wheelchair-accessible vehicle; assistance boarding')
  await rider.screenshot({ path: outputPath('03-round-trip-request.png'), fullPage: true })
  await rider.getByRole('button', { name: 'Send request' }).click()
  await rider.getByText('My rides').first().waitFor()
  await rider.getByText(demoPickup).waitFor({ timeout: 15_000 })
  await rider.screenshot({ path: outputPath('04-rider-requested.png'), fullPage: true })

  const agencyContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  const agency = await agencyContext.newPage()
  await agency.goto('http://127.0.0.1:4174')
  await agency.screenshot({ path: outputPath('05-agency-login.png'), fullPage: true })
  await agency.getByLabel('Work email').fill(env.ACCESSRIDE_TEST_AGENCY_EMAIL)
  await agency.getByLabel('Password').fill(env.ACCESSRIDE_TEST_AGENCY_PASSWORD)
  await agency.getByRole('button', { name: 'Sign in' }).click()
  await agency.getByText('Transportation desk').waitFor()
  await agency.getByText(demoPickup).waitFor({ timeout: 15_000 })
  await agency.screenshot({ path: outputPath('06-agency-new-request.png'), fullPage: true })

  let row = agency.locator('.queue-row').filter({ hasText: demoPickup })
  await row.getByRole('button', { name: /Accept/ }).click()
  await row.getByText('Scheduled', { exact: true }).waitFor()
  await agency.screenshot({ path: outputPath('07-agency-scheduled.png'), fullPage: true })
  await row.getByRole('button', { name: /Assign driver/ }).click()
  await row.getByText('Driver assigned', { exact: true }).waitFor()
  await agency.screenshot({ path: outputPath('08-agency-driver-assigned.png'), fullPage: true })

  await rider.reload()
  await rider.getByLabel('Username').fill(riderUsername)
  await rider.getByLabel('Password').fill(env.ACCESSRIDE_TEST_RIDER_PASSWORD)
  await rider.getByRole('button', { name: 'Sign in' }).click()
  await rider.getByText('Where do you need to go?').waitFor()
  await rider.getByRole('button', { name: 'My rides' }).click()
  await rider.getByText('Driver assigned', { exact: true }).waitFor({ timeout: 15_000 })
  await rider.screenshot({ path: outputPath('09-rider-status-update.png'), fullPage: true })

  await rider.getByRole('button', { name: 'Home', exact: true }).click()
  const sos = rider.locator('.sos-button')
  const box = await sos.boundingBox()
  if (!box) throw new Error('SOS button was not visible.')
  await rider.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await rider.mouse.down()
  await rider.waitForTimeout(1_700)
  await rider.mouse.up()
  await rider.getByText('SOS received by dispatch').waitFor({ timeout: 15_000 })
  await rider.screenshot({ path: outputPath('10-rider-sos.png'), fullPage: true })

  await agency.getByText('Active SOS alerts').waitFor({ timeout: 15_000 })
  await agency.screenshot({ path: outputPath('11-agency-sos-call.png'), fullPage: true })
  const acknowledge = agency.getByRole('button', { name: 'Acknowledge' })
  if (await acknowledge.count()) {
    await acknowledge.first().click()
    await agency.waitForTimeout(750)
  }

  await agency.getByRole('button', { name: 'Riders' }).click()
  await agency.getByText('Rider directory').waitFor()
  await agency.screenshot({ path: outputPath('12-rider-directory.png'), fullPage: true })
  await agency.getByRole('button', { name: 'Reset password for Maria Johnson' }).click()
  await agency.getByText('Reset rider password').waitFor()
  await agency.screenshot({ path: outputPath('13-agency-reset-password.png'), fullPage: true })
  await agency.getByRole('button', { name: 'Close' }).click()
  await agency.getByRole('button', { name: 'New rider' }).click()
  await agency.getByText('Create rider').waitFor()
  await agency.screenshot({ path: outputPath('14-agency-create-rider.png'), fullPage: true })

  await rider.getByRole('button', { name: 'My profile' }).click()
  await rider.getByText('Change password').waitFor()
  await rider.screenshot({ path: outputPath('15-rider-change-password.png'), fullPage: true })

  await riderContext.close()
  await agencyContext.close()
} finally {
  await browser.close()
  await riderApi.from('trip_requests').delete().eq('pickup_address', demoPickup)
  await admin.from('sos_events').update({ status: 'acknowledged' }).eq('status', 'active')
  await riderApi.auth.signOut()
  await admin.auth.signOut()
}

console.log(fileURLToPath(outputDirectory))
