# DSH integration guide

v0.1 follows the proposal's route A: compose tenant placement into agent creation
without patching DSH. `TenantRuntime.createAgent(tenant)` creates the validated
child scope. Feed its native scope/key into the existing Agent setup wrapper.

For a Cordis integration, implement `ScopeAdapter`: create tenant scopes below the
root, agent scopes below tenant scopes, registration lookup along that chain, and
awaitable disposal. The bundled memory adapter is the executable reference.

## DSH Agent bridge

`@dsh-tenancy/integrations` exposes `TenantDshAgentBridge` for the real DSH
`ctx.agents.create({ sessionId, setup })` API. It claims session ownership before
creating the Agent and invokes the host's placement callback during the Agent's
unpublished setup phase. The callback must attach the tenant scope to the DSH
`agentCtx`; the bridge does not pretend that a plain DSH Agent is tenant-isolated
without that placement seam.

```ts
const bridge = new TenantDshAgentBridge(runtime, tenantSessions, ctx.agents, (agentCtx, tenant) => {
  placeDshAgentScope(agentCtx, tenant.ctx.scope)
})
const handle = await bridge.create(tenant.ctx, sessionId)
```

This preserves DSH's normal Agent lifecycle and gives the application one place
to enforce tenant ownership before an Agent or persisted session is exposed.

The preferred upstream route B is a small placement seam equivalent to:

```ts
createScope(loopCtx, agent, { parent: tenant.key })
```

The application must reject requests lacking authenticated tenant identity before
calling this package. It must also check session ownership before DSH persistence
is read, not after session contents have already been loaded.

For v0.2 resource providers, see `resource-contracts.md`. For the v0.3 HTTP,
verified-claims, PostgreSQL, and MCP adapters, see `integrations.md`.
