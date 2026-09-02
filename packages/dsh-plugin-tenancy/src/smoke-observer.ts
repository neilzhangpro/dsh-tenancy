import type { DshTenancyService } from './index.js'
import type { TenantSessionRegistry } from '@dsh-tenancy/core'

export const name = 'dsh-tenancy-smoke-observer'
export const inject = ['tenants', 'tenantSessions']

interface ObserverContext {
  readonly tenants: DshTenancyService
  readonly tenantSessions: TenantSessionRegistry
}

export function apply(ctx: ObserverContext): void {
  const tenant = ctx.tenants.resolve('smoke-tenant')
  if (tenant.id !== 'smoke-tenant' || typeof ctx.tenantSessions.claim !== 'function') {
    throw new Error('dsh-tenancy services are not operational')
  }
  console.log('DSH_TENANCY_SMOKE_OK tenants tenantSessions smoke-tenant')
}
