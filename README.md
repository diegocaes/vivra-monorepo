# Vivra

Pet care app: Expo/React Native mobile, Astro SSR web, shared TypeScript logic,
and Supabase Auth/Postgres/Storage/Edge Functions. Use pnpm from the repository root.

```sh
nvm use
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
cp apps/web/.env.example apps/web/.env
# Fill in the web Supabase URL and public anon key.
pnpm run doctor
pnpm verify
```

`pnpm-lock.yaml` is the only dependency lockfile. The shared package exports
TypeScript source directly and does not need a build. Mobile retains its default
backend; to use a test backend, set both variables in `apps/mobile/.env.example`
in an untracked `apps/mobile/.env`. Never put service-role keys in public variables.

| Task | Command from repository root |
| --- | --- |
| Web dev | `pnpm --filter web dev --host 127.0.0.1` |
| Mobile Metro | `pnpm dev:mobile --localhost --port 8081` |
| Lint, unit tests, all three packages' types | `pnpm verify` |
| Production web build | `pnpm build:web` |
| Public web HTTP smoke, with dev server running | `pnpm smoke:web` |
| iOS JavaScript bundle | `pnpm --filter mobile exec expo export --platform ios --output-dir /tmp/vivra-ios-check` |
| Signed-in native navigation/forms | `pnpm test:mobile:navigation` |

Astro runs its dev server in the background. Use `pnpm --filter web exec astro dev status`,
`astro dev logs`, or `astro dev stop` through the same `pnpm --filter web exec` prefix.
HTTP smoke checks cover public routes, the anonymous dashboard redirect, and the PWA
manifest. They do not verify authenticated forms or production billing.

For device prerequisites and Expo Go commands, see [mobile E2E](apps/mobile/.maestro/README.md).
Purchases and push notifications require a native build and a test account.

## Fresh worktrees

Install dependencies in each checkout with the pinned Node and pnpm versions;
do not share `node_modules` symlinks between worktrees. Configure untracked env
files for the intended backend. Run `pnpm run doctor` before debugging app failures.
If pnpm reports `ERR_PNPM_UNEXPECTED_STORE`, use the store path named in its error
with `--store-dir`, or reinstall into the intended store; do not change global
configuration as part of an unrelated fix.

Use distinct ports for simultaneous checkouts, for example web `--port 4322` and
Metro `--port 8082`. Set `SMOKE_BASE_URL=http://127.0.0.1:4322` for web smoke and open
the corresponding Metro URL in the simulator. The existing Expo Go startup flow
assumes port 8081. A release build installed in the simulator does not necessarily
run the current checkout: use Expo Go/development builds connected to its Metro server.

The CI workflow installs from the frozen lockfile, runs `pnpm verify`, builds the
web app, and runs public HTTP smoke checks with placeholder backend configuration.
Authenticated QA needs a dedicated seeded test account (owned/shared pets, free/premium
states, and representative histories); credentials belong in local/CI secrets.

See [the audit notes](docs/project-audit.md) for verified changes and remaining work.
