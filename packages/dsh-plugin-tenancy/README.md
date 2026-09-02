# dsh-plugin-tenancy

Installable DeepSeek Harness bundle for the `dsh-tenancy` runtime.

```bash
# Once published to npm:
dsh plugin --profile web add dsh-plugin-tenancy

# From a local tarball:
dsh plugin --profile web add ./dsh-plugin-tenancy-0.3.0.tgz
dsh --profile web --dump-config
```

The root Cordis context receives two services:

- `ctx.tenants`: tenant runtime and scope lifecycle.
- `ctx.tenantSessions`: in-memory session ownership registry.

The in-memory ownership provider is intended for evaluation. Configure a durable
provider before relying on ownership across process restarts. This package is an
application-level isolation protocol, not a plugin sandbox.

Verified with `@deepseek-ai/dsh@0.1.1-rc.2`: tarball installation, bundle-layer
composition, Cordis entry loading, and both service injections.
