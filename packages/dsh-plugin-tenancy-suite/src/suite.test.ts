import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('suite is an installable DSH web bundle with a tenant entrypoint', async () => {
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as { dsh?: { client?: { platform?: string } } }
  const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  assert.equal(manifest.dsh?.client?.platform, 'web')
  assert.match(patch, /name:\s*dsh-plugin-tenancy-suite/u)
  assert.match(await readFile(new URL('../dist/client.js', import.meta.url), 'utf8'), /tenantAgentUi/u)
})
