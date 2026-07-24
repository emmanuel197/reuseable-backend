# reuseable-backend

## Vision
A catalogue of reusable backend components (@reuseablebackend/*) for SilverRock products.
Build for one real product, extract once proven. Each component = a publishable package.

## Golden rules (non-negotiable)
- Config over code — behaviour from config, never hardcoded.
- Ports & Adapters — for EXTERNAL services that vary (databases, secrets, payment, SMS):
  talk to a socket (a port), plug vendors in as adapters. NOT for wrapping the framework.
- No shared DB tables — components talk via API or events only.
- tenant_id on every record.
- Versioned packages — semver, published to the private registry once stable.
- Thin vertical slices.

## Package layout (packages/*)
- A component is a STANDARD NestJS module: service(s) + module + dynamic forRoot/forRootAsync.
- Business logic lives in services / plain classes, not controllers.
- Add a port + adapters ONLY where the external backend genuinely varies
  (e.g. secrets: env vs AWS; payments: MoMo vs Paystack). Don't abstract otherwise.
- src/index.ts  barrel — the ONLY public surface.
- __tests__/    unit tests.

## Monolith runtime (Wave-1)
- One deployable (apps/api). Persistence: ONE Postgres, a schema per module — no cross-schema reads
  (modules share data via a published interface or an event, never each other's tables).
- Module-to-module: in-process calls via exported providers + in-process domain events.
  Kafka is ONLY for the external seam (analytics / durable workflow), via a transactional outbox —
  NOT between our own modules.
- Externals are adopt-not-embed: Durable Workflow (Temporal), Analytics Warehouse.

## Commands
- Install:   pnpm install
- Build:     pnpm -r build
- Test:      pnpm -r test        (single: pnpm --filter @reuseablebackend/<pkg> test)
- Lint:      pnpm -r lint

## Fetching source (opensrc)
Read real source, not docs. For any package we use:
  npx opensrc <repo>     # lands in repos/ ; then reference it in prompts

## Branch & PR
- Never work on main. Integrate on `staging`.
- Feature branches in isolated worktrees: .worktrees/<branch>.
- Small, focused PRs into staging. Promote staging -> main only at release.

## Security
- Never install a package younger than 14 days.
- Secrets never in code or git. .env is gitignored; .env.example documents keys.

