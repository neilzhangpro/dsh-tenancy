# DSH integration guide

v0.1 follows the proposal's route A: compose tenant placement into agent creation
without patching DSH. `TenantRuntime.createAgent(tenant)` creates the validated
child scope. Feed its native scope/key into the existing Agent setup wrapper.

For a Cordis integration, implement `ScopeAdapter`: create tenant scopes below the
root, agent scopes below tenant scopes, registration lookup along that chain, and
awaitable disposal. The bundled memory adapter is the executable reference.

The preferred upstream route B is a small placement seam equivalent to:

```ts
createScope(loopCtx, agent, { parent: tenant.key })
```

The application must reject requests lacking authenticated tenant identity before
calling this package. It must also check session ownership before DSH persistence
is read, not after session contents have already been loaded.
