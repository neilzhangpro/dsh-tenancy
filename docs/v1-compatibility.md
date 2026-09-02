# v1 compatibility policy

The v1 tenancy protocol is intentionally narrow and stable:

- `tenancy.awareness === 'tenant'` and `tenancy.protocol === 1` are required.
- Tenant IDs, live-context checks, scope precedence, cleanup ordering, session
  ownership, and no-fallback resource routing are normative behavior.
- New optional declaration capabilities and adapter interfaces may be added in
  minor releases when they do not change those semantics.
- Existing fields are not repurposed, and protocol v1 plugins continue to mount
  unchanged throughout the `1.x` line.
- A change that alters isolation, lifecycle, ownership, or declaration meaning
  requires protocol 2 and a new major package version. Protocol 2 is not
  accepted by a v1 runtime.

Package versioning follows semver: fixes are patch releases, additive APIs are
minor releases, and incompatible protocol or public-type changes are major
releases. Adapters must document the exact protocol and package versions they
support; applications should pin the major version and run the compliance kit
when upgrading.

This policy does not promise sandboxing. Plugins remain trusted code inside the
same Node.js process, as described in the [threat model](threat-model.md).
