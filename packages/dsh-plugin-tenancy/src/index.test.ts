import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { apply, createServices } from './index.js'

test('publishes DSH tenancy services and removes them on cleanup', async () => {
  const provided = new Map<string, unknown>()
  const cleanup = apply({
    provide(name, value) {
      provided.set(name, value)
      return () => provided.delete(name)
    },
  })
  assert.ok(provided.has('tenants'))
  assert.ok(provided.has('tenantSessions'))
  await cleanup()
  assert.equal(provided.size, 0)
})

test('plugin cleanup awaits tenant-owned effects', async () => {
  const services = createServices()
  const tenant = services.tenants.resolve('acme')
  let cleaned = false
  tenant.ctx.scope.own(async () => { await Promise.resolve(); cleaned = true })
  await services.tenants.disposeAll()
  assert.equal(cleaned, true)
})

test('package declares an installable DSH bundle and patch row', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    dsh?: { bundle?: { patch?: string } }
    dependencies?: Record<string, string>
  }
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  assert.equal(packageJson.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.deepEqual(packageJson.dependencies ?? {}, {})
  assert.match(patch, /id:\s*dsh-tenancy/u)
  assert.match(patch, /name:\s*dsh-plugin-tenancy/u)
})
