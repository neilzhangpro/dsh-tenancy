# dsh-tenancy contributor guide

Start with `README.md`, then read `docs/tenancy-protocol.md` and `docs/threat-model.md`.

## Startup Workflow

Before writing code, read `feature_list.json`, `progress.md`, and
`session-handoff.md`, then run `./init.sh`. A clean checkout must remain
restartable through that command.

## Invariants

- Tenant admission fails closed: never infer tenant awareness from config.
- A tenant context must be live and owned by its runtime.
- Session ownership is authoritative metadata, not a string prefix.
- Disposing a tenant waits for owned effects and invalidates its contexts.
- Never add implicit global credential or storage fallbacks.
- One feature at a time: use the tracker dependencies and stay in scope.

## Definition of done

Run `npm run verify`. Add negative tests for every admission or isolation change.
Update `feature_list.json` and `progress.md` when behavior or evidence changes.

## End of Session

Before ending, update state and handoff artifacts, record blockers and exact
verification evidence, and leave the repository clean enough for `./init.sh`.

## Verification Commands

`npm run verify` performs the strict build/type check, all tests, and demos.
