import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outputDirectory = new URL('../releases/real-ui-reference/', import.meta.url)
await mkdir(outputDirectory, { recursive: true })
const outputPath = (name) => fileURLToPath(new URL(name, outputDirectory))

const browser = await chromium.launch()
try {
  const clearActiveAlerts = async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4174')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByText('Transportation desk').waitFor()
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const buttons = page.getByRole('button', { name: 'Acknowledge' })
      if (await buttons.count() === 0) break
      await buttons.first().click()
      await page.waitForTimeout(750)
    }
    await context.close()
  }

  await clearActiveAlerts()

  const riderContext = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    geolocation: { latitude: 41.8781, longitude: -87.6298 },
    permissions: ['geolocation'],
  })
  const rider = await riderContext.newPage()
  await rider.goto('http://127.0.0.1:4173')
  await rider.getByRole('button', { name: 'Sign in' }).click()
  await rider.getByText('Where do you need to go?').waitFor()
  await rider.screenshot({
    path: outputPath('rider-home-en.png'),
    fullPage: true,
  })

  await rider.getByRole('button', { name: /Request a ride/ }).click()
  await rider.getByText('Request a ride').first().waitFor()
  await rider.screenshot({
    path: outputPath('rider-request-en.png'),
    fullPage: true,
  })
  await rider.getByRole('button', { name: 'Cancel' }).click()

  const sos = rider.locator('.sos-button')
  const box = await sos.boundingBox()
  if (!box) throw new Error('SOS button was not visible.')
  await rider.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await rider.mouse.down()
  await rider.waitForTimeout(1_700)
  await rider.mouse.up()
  await rider.getByText('SOS received by dispatch').waitFor({ timeout: 15_000 })
  await rider.screenshot({
    path: outputPath('rider-sos-en.png'),
    fullPage: true,
  })

  const agencyContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  })
  const agency = await agencyContext.newPage()
  await agency.goto('http://127.0.0.1:4174')
  await agency.getByRole('button', { name: 'Sign in' }).click()
  await agency.getByText('Transportation desk').waitFor()
  await agency.getByText('Active SOS alerts').waitFor({ timeout: 15_000 })
  await agency.screenshot({
    path: outputPath('agency-sos-en.png'),
    fullPage: true,
  })

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const buttons = agency.getByRole('button', { name: 'Acknowledge' })
    if (await buttons.count() === 0) break
    await buttons.first().click()
    await agency.waitForTimeout(750)
  }
  await agency.screenshot({
    path: outputPath('agency-dispatch-en.png'),
    fullPage: true,
  })

  await riderContext.close()
  await agencyContext.close()
} finally {
  await browser.close()
}

console.log(fileURLToPath(outputDirectory))
