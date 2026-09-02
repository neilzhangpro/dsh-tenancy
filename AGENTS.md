# dsh-tenancy contributor guide

Start with `README.md`, then read `docs/tenancy-protocol.md` and `docs/threat-model.md`.

## Invariants

- Tenant admission fails closed: never infer tenant awareness from config.
- A tenant context must be live and owned by its runtime.
- Session ownership is authoritative metadata, not a string prefix.
- Disposing a tenant waits for owned effects and invalidates its contexts.
- Never add implicit global credential or storage fallbacks.

## Definition of done

Run `npm run verify`. Add negative tests for every admission or isolation change.
Update `feature_list.json` and `progress.md` when behavior or evidence changes.
