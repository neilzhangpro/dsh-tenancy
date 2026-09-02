import assert from 'node:assert/strict'
import test from 'node:test'
import { TenantRuntime, createMemoryScopeAdapter } from '@dsh-tenancy/core'
import { DefaultTenantNamespace, MemoryTenantStorage } from './index.js'

test('partitions identical logical keys by tenant context', () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const acme = runtime.resolve('acme'); const globex = runtime.resolve('globex')
  const storage = new MemoryTenantStorage<string>()
  storage.set(acme.ctx, 'memory', ['session-1'], 'acme-value')
  storage.set(globex.ctx, 'memory', ['session-1'], 'globex-value')
  assert.equal(storage.get(acme.ctx, 'memory', ['session-1']), 'acme-value')
  assert.equal(storage.get(globex.ctx, 'memory', ['session-1']), 'globex-value')
})

test('namespace includes tenant identity and rejects traversal segments', () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter()); const ctx = runtime.resolve('acme').ctx
  const namespace = new DefaultTenantNamespace()
  assert.deepEqual(namespace.namespace(ctx, 'memory', ['session-1']), ['tenant', 'acme', 'memory', 'session-1'])
  assert.throws(() => namespace.namespace(ctx, 'memory', ['../globex']), /unsafe namespace/)
})
