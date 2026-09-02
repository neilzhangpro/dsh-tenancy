# dsh-tenancy

The missing tenant scope for DeepSeek Harness.

Run multiple logical tenants in one DSH process without pretending every plugin
is tenant-safe.

- Tenant → Agent scope hierarchy
- Session ownership enforcement
- Default-deny, versioned plugin admission
- Adapter seam for DSH/Cordis scope integration
- No auth, database, vault, or sandbox lock-in

> **Security boundary:** this is application-level isolation and admission
> control, not a code sandbox. Arbitrary Node.js plugins remain fully privileged.

```text
Before: Global → Agent
After:  Global → Tenant → Agent → Session
```

## Quick start

```bash
npm install
npm test
npm run demo
```

```ts
import { TenantRuntime, createMemoryScopeAdapter } from '@dsh-tenancy/core'

const tenants = new TenantRuntime(createMemoryScopeAdapter())

await tenants.run('tenant-acme', async (tenant) => {
  const agent = tenants.createAgent(tenant)
  agent.scope.register('crm', acmeCrm)
  // Pass agent.scope/native scope to the DSH Agent setup or placement seam.
})
```

See [the integration guide](docs/integration-guide.md), [protocol](docs/tenancy-protocol.md),
[plugin author guide](docs/plugin-author-guide.md), and [threat model](docs/threat-model.md).

## Packages

- `@dsh-tenancy/core`: IDs, runtime, scopes, plugin admission, session ownership.
- `@dsh-tenancy/testing`: reusable compliance checks for tenant-aware plugins.

## Non-goals

Authentication, JWT validation, RBAC, billing, databases, secret vaults, HTTP
servers, and execution sandboxes are deliberately outside v0.1.
