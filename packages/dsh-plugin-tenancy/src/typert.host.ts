import { z } from 'zod'

const tenant = z.object({ id: z.string(), name: z.string(), color: z.string().optional() }).readonly()
const result = z.object({ sessionId: z.string() })
export const TYPERT = {
  package: 'dsh-plugin-tenancy', face: 'host', schemas: [],
  invocations: [
    { id: 'dsh-plugin-tenancy#tenant/list', service: 'tenantController', namespace: 'tenant', method: 'list', invocation: { kind: 'direct' }, parameters: [], result: { mode: 'strict', typeSymbol: 'dsh-plugin-tenancy#TenantSummary[]', schema: z.array(tenant).readonly() } },
    { id: 'dsh-plugin-tenancy#tenant/create', service: 'tenantController', namespace: 'tenant', method: 'create', invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: 'dsh-plugin-tenancy#CreateTenantRequest', schema: z.object({ tenantId: z.string() }) } }], result: { mode: 'strict', typeSymbol: 'dsh-plugin-tenancy#CreateTenantResult', schema: result } },
  ], model: { services: [], events: [], objects: [] },
}
export default TYPERT
