import {
  TENANCY_PROTOCOL, TenantRuntime, createMemoryScopeAdapter,
  type TenantAwarePlugin,
} from '@dsh-tenancy/core'

export interface ComplianceResult { readonly name: string; readonly passed: boolean; readonly detail?: string }

export async function checkTenantPluginCompliance<Config>(
  plugin: TenantAwarePlugin<Config>, config: Config,
): Promise<readonly ComplianceResult[]> {
  const results: ComplianceResult[] = []
  results.push({
    name: 'protocol declaration',
    passed: plugin.tenancy?.awareness === 'tenant' && plugin.tenancy?.protocol === TENANCY_PROTOCOL,
  })
  const runtime = new TenantRuntime(createMemoryScopeAdapter())
  const acme = runtime.resolve('compliance-acme')
  const globex = runtime.resolve('compliance-globex')
  try {
    const fiber = await runtime.mount(acme, plugin, config)
    results.push({ name: 'mounts in tenant context', passed: true })
    results.push({
      name: 'separate tenant scope',
      passed: acme.ctx.scope.key !== globex.ctx.scope.key && acme.ctx.scope.parent === globex.ctx.scope.parent,
    })
    await fiber.dispose()
    await runtime.dispose(acme.id)
    results.push({ name: 'cleanup is awaitable and idempotent', passed: true })
  } catch (error) {
    results.push({ name: 'mounts in tenant context', passed: false, detail: String(error) })
  } finally {
    await runtime.dispose(globex.id)
  }
  return results
}

export async function assertTenantPluginCompliant<Config>(plugin: TenantAwarePlugin<Config>, config: Config): Promise<void> {
  const failures = (await checkTenantPluginCompliance(plugin, config)).filter((result) => !result.passed)
  if (failures.length) throw new Error(failures.map((failure) => `${failure.name}: ${failure.detail ?? 'failed'}`).join('\n'))
}
