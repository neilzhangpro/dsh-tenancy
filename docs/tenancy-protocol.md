# Tenancy protocol v1

A tenant-aware plugin exports an immutable declaration:

```ts
export const tenancy = { awareness: 'tenant', protocol: 1 } as const
```

Its `apply` function receives a live `TenantContext`. The loader verifies the
declaration itself; configuration cannot override it. Unsupported, missing, or
root-only declarations are rejected.

`TenantId` is routing identity, not authentication evidence. An authenticated
gateway must derive a trusted ID before calling `run` or `resolve`.

Registrations resolve from nearest to farthest: agent, tenant, then global.
Disposal invalidates the complete tenant generation and awaits plugin cleanup.
A later `resolve` creates a new generation with no registrations from the old one.

Session ownership is the tuple `(tenantId, sessionId)`. Claims are atomic in the
provider, legacy sessions without metadata fail closed, and ownership is immutable.
