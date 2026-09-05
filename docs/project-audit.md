# Project audit — 2026-09-04

This pass focused on shared logic/tests, mobile data loading and navigation,
web SSR queries/rendering, and repository verification. No production database
migrations, billing configuration changes, or deployments were performed.

## Implemented

| Finding | Change and evidence |
| --- | --- |
| Pages and MainLayout repeated owned/shared pet queries | Cache the in-flight lookup by the request's Supabase client, account, and active pet. A test using the actual Supabase query builder and a fake HTTP transport verifies **2 HTTP calls**, versus 4 for separate page/layout lookups. Tests cover client/account/selection isolation and retry after an error. |
| Failed pet queries looked like an empty account | Propagate errors instead of returning an empty list and redirecting to onboarding. Failed lookups are evicted from the request cache. |
| Dashboard awaited premium before starting independent history queries | Run premium and the six history queries together. Removes a serial dependency; production latency has not been measured. |
| Sidebar preloaded all six navigation destinations; other visible links also prefetched | Change explicit sidebar `load` and global `viewport` prefetching to `hover`. Avoid automatic SSR work for unvisited destinations. No percentage latency claim. |
| Static weight chart shipped browser hydration | Render the React chart on the server without `client:load`. It has no event handlers or client state. Web build passes. |
| Mobile vitality adapter copied every history row and lost food `end_date` | Pass structurally compatible records directly. A hook/render regression test verifies a recently closed bag is not marked stale. Removes six mapped arrays and their copied row objects per score calculation. |
| Dead food-screen loading state | Remove state and writes whose value was never rendered. |
| Redundant test | Remove the test asserting JavaScript `toFixed(0)` behavior. Preserve application money-formatting and total-consistency regressions. |
| Competing package managers and scripts that did nothing | Remove two npm lockfiles (18,498 generated lines), keep pnpm, fix mobile dev, remove the nonexistent shared build command, and simplify unused Turbo tasks/outputs. |
| Shared package skipped by root typecheck | Check all three packages concurrently. This exposed and fixed pricing functions whose default parameters inferred literal types instead of `number`. |
| Lint failed before any changes | Resolve all 17 errors: enable Tailwind parsing, add SVG titles, use record/value keys in charts, and fix a test callback. Existing warnings remain visible. |
| Web build cache missed relevant inputs | Include env files, Sentry configuration input, and shared package sources. Turbo dry-run confirms 28 shared inputs are included in the web task hash. |
| Verification setup was incomplete | Add `pnpm verify`, `pnpm run doctor`, public HTTP smoke, CI, env examples, a root README, and AGENTS.md. Mobile can now override its default backend for test environments. |
| E2E flow depended on removed UI and a covered tab bar | Remove the nonexistent health passport action, check screen content/containers, and dismiss the development warning toast that intercepted tab presses. |

## Verification

- Baseline: 86 tests passed; lint failed with 17 errors. Old typecheck passed but
  omitted the shared package.
- Updated after the mobile follow-up: 96 tests pass across 17 files. `pnpm verify` passes; lint still reports
  30 warnings and Astro reports 37 hints, with zero errors.
- Production web build passes. Public HTTP smoke passes all six checks: landing,
  login, privacy, terms, anonymous dashboard redirect, and PWA manifest.
- iOS export succeeds with a Hermes bundle. With Metro serving this checkout,
  both native Maestro flows pass: repeated navigation (38s) and opening/canceling
  grooming forms (25s). Initial failures exposed an absent Metro server and a
  development warning toast covering the tabs; both were resolved before the pass.
- `pnpm run doctor` passes with Node 22.23.2 and the existing web configuration.

The query-count test measures requests, not production response time. Public HTTP
smoke does not prove authenticated SSR behavior. CI has been added as configuration;
its hosted GitHub run has not been executed from this local audit.

## Mobile follow-up

- Home notification/trial status now runs explicitly during refresh, alongside
  the pet refresh. The former `refreshing` dependency fired once on `true` and
  again on `false`: four status HTTP requests per pull. It now sends two, with
  concurrent refresh callers sharing the same pending load.
- Profile spending issues **zero requests while the tab is initially hidden**,
  instead of six during startup. It reloads on focus and pull-to-refresh.
- Account/pet changes and blur/unmount cancel pending requests. Late transport
  responses are ignored even if the transport does not honor cancellation.
- A failed spending category produces a retry notice, never a partial total
  presented as the complete bill. Successful same-pet data remains visible while
  refreshing; a failed refresh clears the total and exposes the error.
- Expired or invalid trial dates no longer produce an active-trial banner.
- Seven new tests use real React effects in Happy DOM and the actual Supabase
  query builder with a fake HTTP transport. They verify request counts, refresh
  coalescing, focus behavior, stale responses, failure/retry, and trial dates.
  The shared request-lifecycle hook is used by both loaders so cancellation and
  refresh semantics stay consistent.
- After these changes, the iOS bundle export and both native flows passed again:
  navigation with spending totals visible (39s), and grooming form open/cancel (25s).

## Remaining high-value work

1. **Further spending query reduction:** spending now waits for Profile focus,
   refreshes on return/pull, and rejects partial totals. Its six queries still
   overlap several `usePet` tables. A coherent shared dataset or backend aggregate
   could reduce these further; validate totals against long histories before
   changing the data source.
2. **Other mobile loaders:** home status now refreshes explicitly once per pull,
   with cancellation and account-change tests. Several other screens still load
   independently while all tabs stay mounted; changing mounting policy needs
   native regression coverage because the repository documents blank-screen bugs.
3. **Large histories:** multiple queries read entire tables without pagination.
   Do not add arbitrary limits to money totals or medical histories. Use dedicated
   aggregate/count queries and paginated lists, verified with a seeded large-history
   account and query plans before introducing new indexes.
4. **Authenticated QA fixtures:** provide a separate seeded test account/backend
   covering owned/shared pets, revoked access, free/premium, and substantial history.
   Web auth/form tests and native purchase/push checks need those fixtures. The new
   env overrides and worktree instructions provide the connection points.
5. **Hook dependencies:** exhaustive dependency linting remains globally disabled.
   Reorder callbacks and validate lifecycle behavior before enabling it incrementally;
   a mechanical autofix risks new fetch loops and initialization failures.

Short auth/error helpers were retained where they centralize real behavior. Tests
for billing gates, vaccine history, shared access, money, and startup races remain.
