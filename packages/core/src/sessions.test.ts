import assert from 'node:assert/strict'
import test from 'node:test'
import { LegacySessionOwnershipError, SessionOwnershipError } from './errors.js'
import { TenantRuntime } from './runtime.js'
import { MemorySessionOwnershipProvider, TenantSessionRegistry } from './sessions.js'
import { createMemoryScopeAdapter } from './scope.js'

test('only one tenant can claim a session concurrently', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const sessions = new TenantSessionRegistry(new MemorySessionOwnershipProvider())
  const acme = runtime.resolve('acme')
  const globex = runtime.resolve('globex')
  const results = await Promise.allSettled([
    sessions.claim(acme.ctx, 'conversation-42'),
    sessions.claim(globex.ctx, 'conversation-42'),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1)
})

test('rejects cross-tenant resume', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const sessions = new TenantSessionRegistry(new MemorySessionOwnershipProvider())
  await sessions.claim(runtime.resolve('acme').ctx, 's1')
  await assert.rejects(sessions.requireOwner(runtime.resolve('globex').ctx, 's1'), SessionOwnershipError)
})

test('legacy sessions fail closed until explicit migration', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const provider = new MemorySessionOwnershipProvider()
  const sessions = new TenantSessionRegistry(provider)
  const ctx = runtime.resolve('acme').ctx
  provider.markLegacy('old-session')
  await assert.rejects(sessions.claim(ctx, 'old-session'), LegacySessionOwnershipError)
  assert.equal((await sessions.migrateLegacy(ctx, 'old-session')).tenantId, ctx.tenant.id)
  await assert.rejects(sessions.requireOwner(runtime.resolve('globex').ctx, 'old-session'), SessionOwnershipError)
})
