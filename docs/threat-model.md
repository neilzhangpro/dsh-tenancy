# Threat model

## Protected through library APIs

- Cross-tenant visibility of scoped registrations.
- Use of disposed or forged tenant contexts.
- Mounting undeclared or incompatible plugins in tenant scope.
- Cross-tenant session resume and concurrent ownership races.
- Leakage of tenant-owned effects into a replacement scope generation.

## Trusted

- The application authenticates callers and supplies the correct tenant ID.
- Tenant-aware plugins honor the protocol and use capability interfaces.
- Scope and ownership adapters preserve the documented atomicity contract.

## Not protected

Plugins share the Node.js process and may access globals, environment variables,
files, the network, child processes, or native modules. Hostile code requires a
process, container, or microVM boundary. Denial of service, side channels, and
provider-specific storage/credential isolation are also outside this package.
