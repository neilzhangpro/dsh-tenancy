# dsh-tenancy

The missing tenant scope for DeepSeek Harness.

Run multiple logical tenants in one DSH process without pretending every plugin
is tenant-safe.

- Tenant → Agent scope hierarchy
- Session ownership enforcement
- Default-deny, versioned plugin admission
- Per-tenant LLM profiles, credential references, and client partitioning
- Tenant storage namespaces and an in-memory reference adapter
- HTTP, verified JWT claims, PostgreSQL ownership, and MCP integrations
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
[resource contracts](docs/resource-contracts.md), [v0.3 integrations](docs/integrations.md),
[plugin author guide](docs/plugin-author-guide.md), and [threat model](docs/threat-model.md).

## Packages

- `@dsh-tenancy/core`: IDs, runtime, scopes, plugin admission, session ownership.
- `@dsh-tenancy/testing`: reusable compliance checks for tenant-aware plugins.
- `@dsh-tenancy/llm`: LLM profile, credential reference, secret resolver, and router.
- `@dsh-tenancy/storage`: safe namespaces and an in-memory storage adapter.
- `@dsh-tenancy/integrations`: HTTP, verified JWT claims, PostgreSQL, and MCP.

## Non-goals

The project does not authenticate users, validate JWT signatures by itself, run
an HTTP server, operate a database or vault, provide RBAC/billing, or sandbox
plugins. Integrations accept authenticated identities, verified claims, SQL
clients, and secret resolvers supplied by the host application.

## Version status

- v0.1: tenant scope, admission, lifecycle, and session ownership.
- v0.2: resource contracts and in-memory LLM/storage adapters.
- v0.3: HTTP/JWT examples, PostgreSQL ownership provider, and MCP routing.
