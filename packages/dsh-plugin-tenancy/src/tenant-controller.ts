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
  static inject = ['sessions', 'agents', 'tenants', 'tenantSessions']

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
    const agents = this.ctx.get('agents') as { create(options: { sessionId: string; setup?: (ctx: { provide(name: string, value: unknown): () => void }) => void }): Promise<unknown> } | undefined
    if (agents) {
      const handle = await agents.create({ sessionId, setup: (agentCtx) => { agentCtx.provide('dshTenancyTenant', tenantContext.tenant) } }) as { dispose?: () => Promise<void> }
      try {
        await ownership.claim(tenantContext, sessionId)
      } catch (error) {
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
