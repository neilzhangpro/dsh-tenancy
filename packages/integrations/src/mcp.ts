import type { ScopeKey, TenantContext, TenantRuntime } from '@dsh-tenancy/core'

export interface TenantMcpServer {
  readonly name: string
  readonly endpoint: string
  readonly capabilities?: readonly string[]
}

export class TenantMcpRouteNotFoundError extends Error {
  constructor(tenantId: string, name: string) {
    super(`MCP server "${name}" is not configured for tenant "${tenantId}"`); this.name = new.target.name
  }
}

export class TenantMcpRouter {
  #routes = new Map<ScopeKey, Map<string, TenantMcpServer>>()
  constructor(private readonly runtime: TenantRuntime) {}

  register(ctx: TenantContext, server: TenantMcpServer): () => void {
    const tenant = this.runtime.require(ctx)
    if (!server.name.trim() || !server.endpoint.trim()) throw new TypeError('MCP server name and endpoint are required')
    let routes = this.#routes.get(tenant.key)
    if (!routes) { routes = new Map(); this.#routes.set(tenant.key, routes) }
    routes.set(server.name, Object.freeze({ ...server }))
    const unregister = () => {
      routes?.delete(server.name)
      if (routes?.size === 0) this.#routes.delete(tenant.key)
    }
    ctx.scope.own(unregister)
    return unregister
  }

  resolve(ctx: TenantContext, name: string): TenantMcpServer {
    const tenant = this.runtime.require(ctx)
    const server = this.#routes.get(tenant.key)?.get(name)
    if (!server) throw new TenantMcpRouteNotFoundError(tenant.id, name)
    return server
  }
}
