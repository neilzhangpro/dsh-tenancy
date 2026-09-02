import { TenantRuntime, createMemoryScopeAdapter } from '@dsh-tenancy/core'
import { createTenantHttpMiddleware, tenantIdFromVerifiedClaims, verifyJwtClaims } from '@dsh-tenancy/integrations'

interface Request { authorization: string }
const runtime = new TenantRuntime(createMemoryScopeAdapter())

// A real application supplies jose/Auth0/its gateway here. This verifier stub
// represents the already authenticated boundary and deliberately does not decode JWTs.
const verifyWithIdentityProvider = async (_token: string) => ({ tenant_id: 'acme', sub: 'user-42' })
const middleware = createTenantHttpMiddleware<Request, string>(runtime, async (request) => {
  const token = request.authorization.replace(/^Bearer\s+/u, '')
  return tenantIdFromVerifiedClaims(await verifyJwtClaims(token, verifyWithIdentityProvider))
})

const response = await middleware({ authorization: 'Bearer signed.jwt.value' }, async (_request, tenant) => {
  await Promise.resolve()
  return `✓ verified HTTP request entered tenant: ${runtime.require().id} (${tenant.key})`
})
console.log(response)
