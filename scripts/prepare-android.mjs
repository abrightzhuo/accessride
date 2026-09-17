import { cp, mkdir, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const appSource = resolve(root, 'android/app/src')

function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' })
}

async function copyBuild(mode) {
  run('npm', ['run', `build:${mode}`])
  const destination = resolve(appSource, mode, 'assets/public')
  await rm(destination, { recursive: true, force: true })
  await mkdir(destination, { recursive: true })
  await cp(resolve(root, `dist-${mode}`), destination, { recursive: true })
}

await copyBuild('rider')
await copyBuild('agency')
await rm(resolve(appSource, 'main/assets/public'), { recursive: true, force: true })

console.log('Prepared rider and agency Android assets.')
