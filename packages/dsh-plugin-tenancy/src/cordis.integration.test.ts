import assert from 'node:assert/strict'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { apply, type DshTenancyService } from './index.js'
import type { TenantSessionRegistry } from '@dsh-tenancy/core'

type InjectedContext = Context & {
  readonly tenants: DshTenancyService
  readonly tenantSessions: TenantSessionRegistry
}

test('publishes services through a real Cordis context and tears them down', async () => {
  const ctx = new Context()
  const cleanup = apply(ctx)
  const injected = ctx as InjectedContext
  assert.equal(injected.tenants.resolve('cordis-acme').id, 'cordis-acme')
  assert.equal(typeof injected.tenantSessions.claim, 'function')
  await cleanup()
  assert.equal((ctx as Partial<InjectedContext>).tenants, undefined)
  assert.equal((ctx as Partial<InjectedContext>).tenantSessions, undefined)
  await ctx.fiber.dispose()
})
