# Plugin author guide

Declare protocol v1 on the plugin object and accept only `TenantContext`:

```ts
import type { TenantAwarePlugin } from '@dsh-tenancy/core'

export const crmPlugin: TenantAwarePlugin<{ endpoint: string }> = {
  name: 'crm',
  tenancy: { awareness: 'tenant', protocol: 1 },
  apply(ctx, config) {
    ctx.scope.register('crm', createClient(ctx.tenant.id, config.endpoint))
    return () => closeClient(ctx.tenant.id)
  },
}
```

Do not mutate global clients or environment variables. Partition caches by tenant
and profile version. Treat cleanup as async and idempotent. Run the compliance kit
and include a negative test proving another tenant cannot observe registrations.
