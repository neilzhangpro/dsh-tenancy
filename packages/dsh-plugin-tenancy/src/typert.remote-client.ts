import { z } from 'zod'

const tenant = z.object({ id: z.string(), name: z.string(), color: z.string().optional() }).readonly()
const session = z.object({ sessionId: z.string() })
export const TYPERT_REMOTE = {
  package: 'dsh-plugin-tenancy',
  descriptors: [
    { id: 'dsh-plugin-tenancy#tenant/list', service: 'tenantController', namespace: 'tenant', method: 'list', invocation: { kind: 'direct' }, parameters: [], result: { mode: 'strict', schema: z.array(tenant).readonly() } },
    { id: 'dsh-plugin-tenancy#tenant/create', service: 'tenantController', namespace: 'tenant', method: 'create', invocation: { kind: 'direct' }, parameters: [{ name: 'request', wire: 'request', kind: 'json', schema: z.object({ tenantId: z.string() }) }], result: { mode: 'strict', schema: session } },
  ],
}
export default TYPERT_REMOTE
