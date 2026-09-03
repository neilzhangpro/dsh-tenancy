import { Context } from '@deepseek-ai/cordis'
import { randomUUID } from 'node:crypto'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { TenantId } from '@dsh-tenancy/core'
import type { DshTenancyService, TenancyPluginServices } from './index.js'

export const TENANTS = Object.freeze([
  { id: 'acme', name: 'Acme', color: '#f5b84b' },
  { id: 'globex', name: 'Globex', color: '#8de1d0' },
])

export class TenantController extends TypertRemoteService {
  static inject = ['sessions', 'agents', 'agentPresets', 'tenants', 'tenantSessions', 'workspaceRegistry']

  constructor(ctx: Context) { super(ctx, 'tenantController', { namespace: 'tenant' }) }

  @Remote('list')
  async list() { return TENANTS }

  @Remote('create')
  async create(request: { tenantId: string }): Promise<{ sessionId: string }> {
    const tenant = TENANTS.find((item) => item.id === request?.tenantId)
    if (!tenant) throw new Error('unknown tenant')
    const services = this.ctx.get('tenants') as DshTenancyService
    const ownership = this.ctx.get('tenantSessions') as TenancyPluginServices['tenantSessions']
    const sessionId = `tenant-${tenant.id}-${randomUUID()}`
    const tenantContext = services.resolve(TenantId(tenant.id)).ctx
    const agents = this.ctx.get('agents') as { create(options: { sessionId: string; meta?: { cwd?: string; agentPreset?: string }; setup?: (ctx: Context) => Promise<unknown> }): Promise<unknown> } | undefined
    if (agents) {
      const agentPresets = this.ctx.get('agentPresets') as { mount(ctx: Context, id?: string): Promise<unknown> } | undefined
      const workspaces = this.ctx.get('workspaceRegistry') as { list(): readonly { path: string; attachSession?(id: string): Promise<void>; detachSession?(id: string): Promise<void> }[] } | undefined
      const workspace = workspaces?.list()[0]
      const cwd = workspace?.path
      const handle = await agents.create({
        sessionId,
        meta: { agentPreset: 'standard', ...(cwd === undefined ? {} : { cwd }) },
        ...(agentPresets ? { setup: async (agentContext: Context) => { await agentPresets.mount(agentContext, 'standard') } } : {}),
      }) as { dispose?: () => Promise<void> }
      let attached = false
      try {
        await workspace?.attachSession?.(sessionId)
        attached = workspace?.attachSession !== undefined
        await ownership.claim(tenantContext, sessionId)
      } catch (error) {
        if (attached) await workspace?.detachSession?.(sessionId)
        await handle.dispose?.()
        throw error
      }
      return { sessionId }
    }
    const session = (this.ctx.get('sessions') as { create(id?: string): { header: { id: string } } }).create(sessionId)
    await ownership.claim(tenantContext, session.header.id)
    return { sessionId: session.header.id }
  }
}

export default TenantController
