import type { TenantContext } from './runtime.js'
import type { Cleanup } from './scope.js'

export const TENANCY_PROTOCOL = 1 as const

export interface TenancyDeclaration {
  readonly awareness: 'tenant'
  readonly protocol: typeof TENANCY_PROTOCOL
  readonly capabilities?: readonly string[]
}

export interface TenantAwarePlugin<Config = unknown> {
  readonly name: string
  readonly tenancy: TenancyDeclaration
  apply(ctx: TenantContext, config: Config): void | Cleanup | Promise<void | Cleanup>
}

export interface Fiber { dispose(): Promise<void> }
