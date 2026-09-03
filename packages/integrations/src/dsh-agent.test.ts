import assert from 'node:assert/strict'
import test from 'node:test'
import { MemorySessionOwnershipProvider, TenantRuntime, TenantSessionRegistry, createMemoryScopeAdapter } from '@dsh-tenancy/core'
import { TenantDshAgentBridge, type DshAgentRegistry } from './dsh-agent.js'

test('bridges tenant ownership into real DSH agent creation setup', async () => {
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const sessions = new TenantSessionRegistry(new MemorySessionOwnershipProvider())
  let placed: string | undefined
  let created = ''
  const agents: DshAgentRegistry = {
    async create(options) {
      created = options.sessionId
      await options.setup?.({})
      return { agent: { id: options.sessionId }, dispose: async () => undefined }
    },
  }
  const bridge = new TenantDshAgentBridge(runtime, sessions, agents, (_agentCtx, tenant) => { placed = tenant.id })
  const tenant = runtime.resolve('acme')
  const handle = await bridge.create(tenant.ctx, 'session-1')
  assert.equal(created, 'session-1')
  assert.equal(placed, 'acme')
  assert.equal(handle.tenant, tenant)
  await assert.rejects(bridge.create(runtime.resolve('globex').ctx, 'session-1'), /belongs to another tenant/)
})
