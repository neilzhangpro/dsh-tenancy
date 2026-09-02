import assert from 'node:assert/strict'
import test from 'node:test'
import { TenantRuntime, createMemoryScopeAdapter } from '@dsh-tenancy/core'
import {
  CredentialRef, MemoryTenantCredentialResolver, MemoryTenantLlmResolver,
  TenantLlmProfileNotFoundError, TenantLlmRouter,
} from './index.js'

test('routes concurrent calls to tenant-partitioned credentials and clients', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const acme = runtime.resolve('acme'); const globex = runtime.resolve('globex')
  const profiles = new MemoryTenantLlmResolver(); const credentials = new MemoryTenantCredentialResolver()
  profiles.set(acme.id, { provider: 'fake', model: 'm', credentialRef: CredentialRef('vault/acme'), version: '1' })
  profiles.set(globex.id, { provider: 'fake', model: 'm', credentialRef: CredentialRef('vault/globex'), version: '1' })
  credentials.set(acme.id, CredentialRef('vault/acme'), 'acme-secret')
  credentials.set(globex.id, CredentialRef('vault/globex'), 'globex-secret')
  const router = new TenantLlmRouter<{ secret: string }>(profiles, credentials)
  const invoke = (ctx: typeof acme.ctx) => router.call(ctx, {
    createClient: (_profile, secret) => ({ secret }), execute: async (client) => client.secret,
  })
  assert.deepEqual(await Promise.all([invoke(acme.ctx), invoke(globex.ctx)]), ['acme-secret', 'globex-secret'])
})

test('missing tenant profile fails closed without a global fallback', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const router = new TenantLlmRouter(new MemoryTenantLlmResolver(), new MemoryTenantCredentialResolver())
  await assert.rejects(router.call(runtime.resolve('unset').ctx, {
    createClient: () => ({}), execute: async () => 'never',
  }), TenantLlmProfileNotFoundError)
})

test('client cache is partitioned by tenant and profile version', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter()); const tenant = runtime.resolve('acme')
  const profiles = new MemoryTenantLlmResolver(); const credentials = new MemoryTenantCredentialResolver()
  const ref = CredentialRef('vault/key'); credentials.set(tenant.id, ref, 'raw-secret')
  let created = 0
  const router = new TenantLlmRouter<{ id: number }>(profiles, credentials)
  const invoke = () => router.call(tenant.ctx, { createClient: () => ({ id: ++created }), execute: async (c) => c.id })
  profiles.set(tenant.id, { provider: 'fake', model: 'm', credentialRef: ref, version: '1' })
  assert.deepEqual([await invoke(), await invoke()], [1, 1])
  profiles.set(tenant.id, { provider: 'fake', model: 'm', credentialRef: ref, version: '2' })
  assert.equal(await invoke(), 2)
})

test('public profile and errors never expose raw secret material', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter()); const tenant = runtime.resolve('acme')
  const profiles = new MemoryTenantLlmResolver(); const credentials = new MemoryTenantCredentialResolver()
  const ref = CredentialRef('vault/acme'); profiles.set(tenant.id, { provider: 'fake', model: 'm', credentialRef: ref, version: '1' })
  credentials.set(tenant.id, ref, 'DO-NOT-LOG')
  const router = new TenantLlmRouter(profiles, credentials)
  const result = await router.call(tenant.ctx, { createClient: (_p, secret) => ({ secret }), execute: async (_c, profile) => JSON.stringify(profile) })
  assert.doesNotMatch(result, /DO-NOT-LOG/)
})
