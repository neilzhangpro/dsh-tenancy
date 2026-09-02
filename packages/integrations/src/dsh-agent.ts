import type { Tenant, TenantContext, TenantRuntime } from '@dsh-tenancy/core'
import type { TenantSessionRegistry } from '@dsh-tenancy/core'

export interface DshAgentContext { readonly [key: string]: unknown }

export interface DshAgent {
  readonly id: string
  readonly ctx?: DshAgentContext
  readonly session?: { readonly id?: string }
  whenIdle?(): Promise<void>
  followup?(message: unknown): void
}

export interface DshAgentHandle {
  readonly agent: DshAgent
  dispose(): Promise<void>
}

export interface DshAgentCreateOptions {
  readonly sessionId: string
  readonly setup?: (agentCtx: DshAgentContext) => void | Promise<void>
}

export interface DshAgentRegistry {
  create(options: DshAgentCreateOptions): Promise<DshAgentHandle>
}

export type TenantAgentPlacement = (agentCtx: DshAgentContext, tenant: Tenant) => void | Promise<void>

export interface TenantAgentHandle extends DshAgentHandle {
  readonly tenant: Tenant
}

export class TenantDshAgentBridge {
  constructor(
    private readonly runtime: TenantRuntime,
    private readonly sessions: TenantSessionRegistry,
    private readonly agents: DshAgentRegistry,
    private readonly placeTenant: TenantAgentPlacement,
  ) {}

  async create(ctx: TenantContext, sessionId: string): Promise<TenantAgentHandle> {
    const tenant = this.runtime.require(ctx)
    const owner = await this.sessions.claim(ctx, sessionId)
    const handle = await this.agents.create({
      sessionId: owner.sessionId,
      setup: (agentCtx) => this.placeTenant(agentCtx, tenant),
    })
    return Object.freeze({ ...handle, tenant })
  }
}
