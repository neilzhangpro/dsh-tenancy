import {
  MemorySessionOwnershipProvider, TenantPluginRejectedError, TenantRuntime,
  TenantSessionRegistry, createMemoryScopeAdapter,
} from '@dsh-tenancy/core'

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
console.log('✓ acme uses LLM key:   acme-*** (application adapter example)')
console.log('✓ globex uses LLM key: globex-*** (application adapter example)')

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
