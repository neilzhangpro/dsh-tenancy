# Resource contracts (v0.2)

## LLM and credentials

`@dsh-tenancy/llm` deliberately separates three responsibilities:

1. `TenantLlmResolver` chooses a profile for a `Tenant`.
2. `TenantCredentialResolver` resolves the profile's opaque `CredentialRef`.
3. `TenantLlmRouter` partitions clients by tenant, provider, model, profile
   version, and credential reference.

```ts
const profile = {
  provider: 'openai-compatible',
  model: 'deepseek-chat',
  credentialRef: CredentialRef('vault/tenants/acme/llm'),
  version: '2026-09-02',
}
```

Secrets are passed only to `createClient`; they are never stored in the public
profile, cache key, error message, or router output. Missing tenant profiles and
credentials fail closed. There is no global key fallback.

The memory resolvers are reference adapters for tests and demos, not vaults.
Production integrations should resolve references per call and partition any
provider SDK clients with at least the same cache dimensions.

## Storage

`@dsh-tenancy/storage` requires `TenantContext` for every namespace and storage
operation. The default layout is:

```text
tenant / <tenant-id> / <domain> / <parts...>
```

Empty, traversal, control-character, and path-separator segments are rejected.
The memory adapter demonstrates the contract; durable providers must retain the
tenant prefix as authoritative input rather than trusting caller-built strings.
