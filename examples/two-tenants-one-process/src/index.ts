import {
  MemorySessionOwnershipProvider, TenantPluginRejectedError, TenantRuntime,
  TenantSessionRegistry, createMemoryScopeAdapter,
} from '@dsh-tenancy/core'
import {
  CredentialRef, MemoryTenantCredentialResolver, MemoryTenantLlmResolver, TenantLlmRouter,
} from '@dsh-tenancy/llm'

const runtime = new TenantRuntime(createMemoryScopeAdapter())
const sessions = new TenantSessionRegistry(new MemorySessionOwnershipProvider())
runtime.root.scope.register('global-search', true)

const acme = runtime.resolve('acme')
const globex = runtime.resolve('globex')
acme.ctx.scope.register('acme-crm', true)
globex.ctx.scope.register('globex-erp', true)

const visible = (tenant: typeof acme, names: string[]) =>
  names.filter((name) => tenant.ctx.scope.get(name) === true)
const tools = ['global-search', 'acme-crm', 'globex-erp']

console.log(`✓ tenant acme sees:    [${visible(acme, tools).join(', ')}]`)
console.log(`✓ tenant globex sees:  [${visible(globex, tools).join(', ')}]`)
const profiles = new MemoryTenantLlmResolver()
const credentials = new MemoryTenantCredentialResolver()
const acmeRef = CredentialRef('vault/acme/llm'); const globexRef = CredentialRef('vault/globex/llm')
profiles.set(acme.id, { provider: 'fake', model: 'deepseek-chat', credentialRef: acmeRef, version: '1' })
profiles.set(globex.id, { provider: 'fake', model: 'deepseek-chat', credentialRef: globexRef, version: '1' })
credentials.set(acme.id, acmeRef, 'acme-private-key')
credentials.set(globex.id, globexRef, 'globex-private-key')
const llm = new TenantLlmRouter<{ key: string }>(profiles, credentials)
const routedKey = (ctx: typeof acme.ctx) => llm.call(ctx, {
  createClient: (_profile, key) => ({ key }),
  execute: async (client) => `${client.key.slice(0, client.key.indexOf('-'))}-***`,
})
console.log(`✓ acme uses LLM key:   ${await routedKey(acme.ctx)}`)
console.log(`✓ globex uses LLM key: ${await routedKey(globex.ctx)}`)

await sessions.claim(acme.ctx, 'session-1')
try {
  await sessions.requireOwner(globex.ctx, 'session-1')
} catch {
  console.log('✓ globex cannot resume acme/session-1')
}

try {
  await runtime.mount(globex, { name: 'legacy-global-cache', apply() {} } as never, undefined)
} catch (error) {
  if (!(error instanceof TenantPluginRejectedError)) throw error
  console.log('✓ legacy-global-cache plugin rejected')
}
