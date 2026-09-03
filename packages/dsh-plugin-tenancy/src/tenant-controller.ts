import { Context } from '@deepseek-ai/cordis'
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
    const session = (this.ctx.get('sessions') as { create(): { header: { id: string } } }).create()
    const tenantContext = services.resolve(TenantId(tenant.id)).ctx
    await ownership.claim(tenantContext, session.header.id)
    const agents = this.ctx.get('agents') as { create(options: { sessionId: string; setup?: (ctx: Record<string, unknown>) => void }): Promise<unknown> } | undefined
    if (agents) await agents.create({ sessionId: session.header.id, setup: (agentCtx) => { agentCtx.tenant = tenantContext.tenant } })
    return { sessionId: session.header.id }
  }
}

export default TenantController
