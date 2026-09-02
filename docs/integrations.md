# Integrations (v0.3)

## HTTP and verified JWT claims

`createTenantHttpMiddleware` is framework-neutral. It accepts a resolver that
must return an authenticated tenant identity and runs the downstream handler in
`TenantRuntime.run` so async work inherits the context.

The JWT helper intentionally does not decode or verify signatures. The host
supplies a verifier (for example, `jose` with issuer, audience, algorithm, and
key checks); only its returned claims receive the `VerifiedJwtClaims` brand.
`tenantIdFromVerifiedClaims` then validates the selected claim as a `TenantId`.
See `examples/http-jwt-middleware`.

## PostgreSQL session ownership

`PostgresSessionOwnershipProvider` accepts any `SqlClient` compatible with
node-postgres' `query` shape. Call `initialize()` during deployment/bootstrap.
Claims use `INSERT ... ON CONFLICT DO NOTHING`, so the database primary key is
the concurrency authority. Existing ownership never changes. Legacy rows use a
NULL tenant and require the explicit `migrateLegacy` path.

Applications must authorize migrations separately and should run schema changes
through their normal migration system instead of relying on runtime DDL.

## MCP routing experiment

`TenantMcpRouter` registers and resolves server descriptors only with a live
`TenantContext`. It provides no global fallback. Routes are keyed by tenant scope
generation and registered as tenant-owned cleanup effects, preventing hot-reload
leaks when the same tenant ID receives a new scope generation.

This routes trusted descriptors; it does not sandbox MCP servers, validate their
responses, or protect network credentials.
