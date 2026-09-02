# Progress

Last Updated: 2026-09-03

## Current Objective

Implement the original proposal's complete v0.2 resource-contract and v0.3
integration scope. Current State: implementation and verification complete.

## v0.1 implementation

- Implemented validated branded tenant IDs.
- Implemented tenant lifecycle, scope inheritance, agent placement, and cleanup.
- Implemented versioned, default-deny plugin admission.
- Implemented atomic session ownership and explicit legacy migration.
- Added reusable plugin compliance checks and a two-tenant demo.
- Added protocol, integration, authoring, security, and threat-model documentation.

## Verification

Latest v0.1 run (2026-09-02): `npm run verify` passed TypeScript compilation,
9/9 Node tests, and the two-tenant demo.

## v0.2 implementation

- Added tenant LLM profiles, opaque credential references, per-call secret
  resolution, fail-closed routing, and tenant/version-partitioned clients.
- Added context-required storage namespaces with traversal-safe segments and an
  in-memory reference adapter.

## v0.3 implementation

- Added framework-neutral HTTP context middleware and verified-JWT-claim mapping.
- Added a PostgreSQL ownership provider with atomic claims and legacy migration.
- Added generation-aware, no-fallback per-tenant MCP routing.
- Added an executable HTTP/JWT composition example.

## Latest verification

2026-09-03: `npm run verify` passed strict TypeScript compilation, 27/27 Node
tests including a real Cordis context, a Node crypto HS256 verifier integration,
LLM client eviction/lifecycle, the real two-tenant LLM-routing demo, and the
HTTP/JWT context demo. Dry run package audits passed for all five public packages
without shipping tests.
Run `./init.sh` to reproduce all checks from a clean checkout.

GitNexus index: 484 nodes, 1,182 relationships, 35 clusters, and 23 flows
created with `npx gitnexus analyze`.

## Recommended Next Step

Prepare a tagged v0.3.0 release or start the separately scoped v1.0 protocol
stability work. The v1 compatibility policy is documented in
`docs/v1-compatibility.md`; there are no current blockers.

## Documentation polish

- Rebuilt `README.md` as the English open-source landing page.
- Added the aligned Simplified Chinese `README.zh-CN.md`.
- Added truthful project/stack badges, architecture, package matrix, security
  boundary, developer workflow, roadmap, and contribution guidance.

## Installable DSH Bundle

- Added `packages/dsh-plugin-tenancy` with a valid `dsh.bundle` manifest and
  `cordis.patch.yml` row.
- The Cordis entry provides `ctx.tenants` and `ctx.tenantSessions`; teardown
  removes both services and awaits every live tenant-owned effect.
- The packed entry is self-contained and declares no registry-time runtime
  dependencies.
- Verification: `npm run verify` passed 27/27 tests. A tarball was installed
  into a fresh DSH profile using `@deepseek-ai/dsh@0.1.1-rc.2`; `--dump-config`
  showed the Bundle layer and a dependent observer printed
  `DSH_TENANCY_SMOKE_OK tenants tenantSessions smoke-tenant` after real boot.
