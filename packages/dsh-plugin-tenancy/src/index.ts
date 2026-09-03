import {
  MemorySessionOwnershipProvider,
  TenantId,
  TenantRuntime,
  TenantSessionRegistry,
  createMemoryScopeAdapter,
  type Tenant,
  type TenantId as TenantIdType,
} from '@dsh-tenancy/core'
import { TenantController } from './tenant-controller.js'

export const name = 'dsh-tenancy'

export { TenantController }

export interface CordisContext {
  provide(name: string, value: unknown): void | (() => void)
  plugin?(plugin: unknown): unknown
}

export interface DshTenancyService extends TenantRuntime {
  disposeAll(): Promise<void>
}

class ManagedTenantRuntime extends TenantRuntime implements DshTenancyService {
  #active = new Set<TenantIdType>()

  override resolve(value: TenantIdType | string): Tenant {
    const id = TenantId(value)
    this.#active.add(id)
    return super.resolve(id)
  }

  override run<T>(value: TenantIdType | string, operation: (tenant: Tenant) => T): T {
    const id = TenantId(value)
    this.#active.add(id)
    return super.run(id, operation)
  }

  override async dispose(value: TenantIdType | string): Promise<void> {
    const id = TenantId(value)
    this.#active.delete(id)
    await super.dispose(id)
  }

  async disposeAll(): Promise<void> {
    const ids = [...this.#active]
    this.#active.clear()
    const results = await Promise.allSettled(ids.map((id) => super.dispose(id)))
    const failures = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map((result) => result.reason)
    if (failures.length) throw new AggregateError(failures, 'one or more tenant scopes failed to dispose')
  }
}

export interface TenancyPluginServices {
  readonly tenants: DshTenancyService
  readonly tenantSessions: TenantSessionRegistry
}

export function createServices(): TenancyPluginServices {
  const tenants = new ManagedTenantRuntime(createMemoryScopeAdapter())
  const tenantSessions = new TenantSessionRegistry(new MemorySessionOwnershipProvider())
  return Object.freeze({ tenants, tenantSessions })
}

export function apply(ctx: CordisContext): () => Promise<void> {
  const services = createServices()
  const removeTenants = ctx.provide('tenants', services.tenants)
  const removeSessions = ctx.provide('tenantSessions', services.tenantSessions)
  ctx.plugin?.(TenantController)

  return async () => {
    if (typeof removeSessions === 'function') removeSessions()
    if (typeof removeTenants === 'function') removeTenants()
    await services.tenants.disposeAll()
  }
}
