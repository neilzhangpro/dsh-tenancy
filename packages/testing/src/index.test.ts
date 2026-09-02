import test from 'node:test'
import { assertTenantPluginCompliant } from './index.js'

test('accepts a protocol v1 plugin with cleanup', async () => {
  await assertTenantPluginCompliant({
    name: 'example', tenancy: { awareness: 'tenant', protocol: 1 },
    apply(ctx) { ctx.scope.register('example', ctx.tenant.id); return () => {} },
  }, undefined)
})
