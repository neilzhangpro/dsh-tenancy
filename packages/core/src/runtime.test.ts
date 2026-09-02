import assert from 'node:assert/strict'
import test from 'node:test'
import { TenantDisposedError, TenantPluginRejectedError } from './errors.js'
import { TenantRuntime } from './runtime.js'
import { createMemoryScopeAdapter } from './scope.js'

test('isolates tenant registrations and preserves scope precedence', () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  runtime.root.scope.register('search', 'global')
  const acme = runtime.resolve('acme')
  const globex = runtime.resolve('globex')
  acme.ctx.scope.register('crm', 'acme-crm')
  globex.ctx.scope.register('erp', 'globex-erp')
  acme.ctx.scope.register('search', 'acme-search')
  const a1 = runtime.createAgent(acme)
  const a2 = runtime.createAgent(acme)
  const b1 = runtime.createAgent(globex)
  a1.scope.register('search', 'agent-search')

  assert.equal(a1.scope.get('search'), 'agent-search')
  assert.equal(a2.scope.get('search'), 'acme-search')
  assert.equal(b1.scope.get('search'), 'global')
  assert.equal(a1.scope.get('crm'), 'acme-crm')
  assert.equal(a2.scope.get('crm'), 'acme-crm')
  assert.equal(b1.scope.get('crm'), undefined)
  assert.equal(a1.scope.get('erp'), undefined)
})

test('propagates current tenant through async work', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  await runtime.run('acme', async (tenant) => {
    await Promise.resolve()
    assert.equal(runtime.current()?.id, tenant.id)
    assert.equal(runtime.require(tenant.ctx), tenant)
  })
  assert.equal(runtime.current(), undefined)
})

test('plugin admission defaults to deny and cannot be forged by config', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const tenant = runtime.resolve('acme')
  await assert.rejects(
    runtime.mount(tenant, { name: 'legacy', apply() {}, tenancy: undefined } as never, { tenancy: { awareness: 'tenant', protocol: 1 } }),
    TenantPluginRejectedError,
  )
  await assert.rejects(
    runtime.mount(tenant, { name: 'future', tenancy: { awareness: 'tenant', protocol: 2 }, apply() {} } as never, undefined),
    /unsupported tenancy protocol/,
  )
})

test('tenant disposal awaits cleanup and invalidates old generation', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const old = runtime.resolve('acme')
  let cleaned = false
  await runtime.mount(old, {
    name: 'resource', tenancy: { awareness: 'tenant', protocol: 1 },
    apply(ctx) { ctx.scope.register('private', 1); return async () => { await Promise.resolve(); cleaned = true } },
  }, undefined)
  await runtime.dispose('acme')
  assert.equal(cleaned, true)
  assert.throws(() => runtime.createAgent(old), TenantDisposedError)
  const replacement = runtime.resolve('acme')
  assert.notEqual(replacement.key, old.key)
  assert.equal(replacement.ctx.scope.get('private'), undefined)
})

test('disposing one agent does not affect a sibling agent', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const tenant = runtime.resolve('acme')
  tenant.ctx.scope.register('shared', true)
  const first = runtime.createAgent(tenant)
  const second = runtime.createAgent(tenant)
  await first.dispose()
  assert.equal(second.scope.get('shared'), true)
})
