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

## DSH multi-tenant Sidebar example

`dsh-plugin-tenancy-suite` is the browser-side companion for the host Bundle. It
keeps DSH's official workspace/sidebar and adds:

- a tenant switcher;
- a tenant-scoped `New session` action;
- a tenant-filtered session list;
- a call to `tenantAgents.create` before opening the new session.

The example runs against a local DSH checkout without changing DSH source. Use
Node.js 22.13 or newer because the current pnpm toolchain requires it.

From the `dsh-tenancy` checkout, build the plugin packages:

```bash
npm install
npm run build
```

Then, from the DSH checkout, create an isolated profile and install the three
required local bundles. A custom profile starts with `dsh-base`; adding the web
bundle is what makes it a browser profile.

```bash
# Ensure Node.js 22.13+ is first on PATH, then use an isolated DSH home.
export DSH_HOME="$(mktemp -d /tmp/dsh-tenancy.XXXXXX)"

pnpm dsh plugin --profile tenancy add \
  /path/to/dsh-tenancy/packages/dsh-plugin-tenancy
pnpm dsh plugin --profile tenancy add \
  /path/to/dsh-tenancy/packages/dsh-plugin-tenancy-suite
pnpm dsh plugin --profile tenancy add \
  /path/to/deepseek-harness/packages/bundle/web-app

pnpm dsh --profile tenancy --port 4174
```

Open <http://127.0.0.1:4174/>. The lower Sidebar action should show `＋ New
session`; the tenant selector switches the visible session list, and creating
a session calls the host tenant service before opening the returned DSH session.

The host Bundle and UI suite must both be installed. Installing only the UI
package leaves the action disabled because `remote.tenant` is unavailable. The
local dashboard at `npm run demo:dashboard` is a separate JWT/scope demo; it is
not the DSH Web UI integration.

For v0.2 resource providers, see `resource-contracts.md`. For the v0.3 HTTP,
verified-claims, PostgreSQL, and MCP adapters, see `integrations.md`.
