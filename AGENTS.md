# Project workflow

- Use Node from `.node-version` / `.nvmrc` and pnpm 9.15.9 at the repository root.
- Read `README.md` for setup, worktrees, and verification. `pnpm run doctor` checks
  prerequisites without printing credentials. `pnpm doctor` is a different pnpm command.
- Shared domain code lives in `packages/shared/lib`; both apps consume its TypeScript
  source. Do not add build wrappers or separate npm lockfiles.
- Run `pnpm verify` for code changes. For web rendering changes also run
  `pnpm build:web` and `pnpm smoke:web` against a running local server. Biome excludes
  Astro templates; `astro check` is part of verification.
- For mobile changes, export the iOS bundle and run relevant Maestro flows when
  a simulator/test session is available. A tab-selection assertion alone does not
  prove screen content loaded. Confirm the tested app runs the current checkout.
- Supabase clients resolve most query failures as `{ error }`; check errors before
  interpreting null data as an empty account. Keep request caches isolated per client.
- Preserve targeted regression tests for auth, billing, shared-pet access, dates,
  and money. Add tests for observable bugs, not language built-ins or implementation shape.
- Report measured query/bundle changes separately from unmeasured user latency.
  Record any unverified authenticated/device/backend behavior explicitly.
