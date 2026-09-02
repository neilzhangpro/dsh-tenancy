import { AsyncLocalStorage } from 'node:async_hooks'
import { TenantContextRequiredError, TenantDisposedError, TenantPluginRejectedError } from './errors.js'
import { TenantId, type TenantId as TenantIdType } from './id.js'
import { TENANCY_PROTOCOL, type Fiber, type TenantAwarePlugin } from './plugin.js'
import type { Scope, ScopeAdapter, ScopeKey } from './scope.js'

const tenantContextBrand = Symbol('TenantContext')

export interface Context { readonly scope: Scope }
export interface Tenant {
  readonly id: TenantIdType
  readonly key: ScopeKey
  readonly ctx: TenantContext
}
export interface TenantContext extends Context {
  readonly [tenantContextBrand]: true
  readonly tenant: Tenant
}
export interface AgentPlacement extends Context {
  readonly tenant: Tenant
  dispose(): Promise<void>
}

interface LiveTenant extends Tenant { disposed: boolean }

export class TenantRuntime {
  readonly root: Context
  #adapter: ScopeAdapter
  #tenants = new Map<TenantIdType, LiveTenant>()
  #current = new AsyncLocalStorage<LiveTenant>()

  constructor(adapter: ScopeAdapter) {
    this.#adapter = adapter
    this.root = Object.freeze({ scope: adapter.root })
  }

  resolve(value: TenantIdType | string): Tenant {
    const id = TenantId(value)
    const current = this.#tenants.get(id)
    if (current && !current.disposed) return current
    const scope = this.#adapter.create('tenant', this.#adapter.root)
    const tenant = { id, key: scope.key, ctx: undefined as unknown as TenantContext, disposed: false }
    const ctx = Object.freeze({ [tenantContextBrand]: true as const, tenant, scope })
    tenant.ctx = ctx
    this.#tenants.set(id, tenant)
    return tenant
  }

  run<T>(value: TenantIdType | string, operation: (tenant: Tenant) => T): T {
    const tenant = this.resolve(value) as LiveTenant
    return this.#current.run(tenant, () => operation(tenant))
  }

  current(ctx?: Context): Tenant | undefined {
    if (ctx) {
      const candidate = (ctx as Partial<TenantContext>).tenant as LiveTenant | undefined
      if (!candidate || (ctx as Partial<TenantContext>)[tenantContextBrand] !== true) return undefined
      this.#assertLive(candidate)
      return candidate
    }
    const tenant = this.#current.getStore()
    if (tenant) this.#assertLive(tenant)
    return tenant
  }

  require(ctx?: Context): Tenant {
    const tenant = this.current(ctx)
    if (!tenant) throw new TenantContextRequiredError('a live tenant context is required')
    return tenant
  }

  createAgent(tenantOrContext: Tenant | TenantContext): AgentPlacement {
    const tenant = ('ctx' in tenantOrContext ? tenantOrContext : tenantOrContext.tenant) as LiveTenant
    this.#assertLive(tenant)
    const scope = this.#adapter.create('agent', tenant.ctx.scope)
    tenant.ctx.scope.own(() => scope.dispose())
    return Object.freeze({ tenant, scope, dispose: () => scope.dispose() })
  }

  async mount<Config>(tenant: Tenant, plugin: TenantAwarePlugin<Config>, config: Config): Promise<Fiber> {
    const live = tenant as LiveTenant
    this.#assertLive(live)
    const declaration = plugin?.tenancy
    if (!declaration || declaration.awareness !== 'tenant') {
      throw new TenantPluginRejectedError(`plugin "${plugin?.name ?? 'unknown'}" is not declared tenant-aware`)
    }
    if (declaration.protocol !== TENANCY_PROTOCOL) {
      throw new TenantPluginRejectedError(`plugin "${plugin.name}" uses unsupported tenancy protocol ${String(declaration.protocol)}`)
    }
    let disposed = false
    const cleanup = await plugin.apply(live.ctx, config)
    const fiber: Fiber = {
      dispose: async () => {
        if (disposed) return
        disposed = true
        if (typeof cleanup === 'function') await cleanup()
      },
    }
    live.ctx.scope.own(() => fiber.dispose())
    return fiber
  }

  async dispose(value: TenantIdType | string): Promise<void> {
    const id = TenantId(value)
    const tenant = this.#tenants.get(id)
    if (!tenant) return
    tenant.disposed = true
    this.#tenants.delete(id)
    await tenant.ctx.scope.dispose()
  }

  #assertLive(tenant: LiveTenant): void {
    if (tenant.disposed || this.#tenants.get(tenant.id) !== tenant) {
      throw new TenantDisposedError(`tenant "${tenant.id}" scope has been disposed`)
    }
  }
}
