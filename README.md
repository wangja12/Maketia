# Tunnels IA

SaaS de création, publication et optimisation de tunnels de vente avec l'IA, pensé pour les
marchés africains. Phase 1 (fondations) : comptes, espaces de travail isolés, gestion des tunnels
et système de design.

Architecture, schéma, plan et état des fonctionnalités : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prérequis

- Node.js 22, pnpm 10
- PostgreSQL 16 avec deux bases : une pour l'application, une pour les tests

## Démarrage

```bash
pnpm install
cp .env.example .env          # puis ajustez les URL de connexion
pnpm db:migrate               # base de l'application
pnpm db:migrate:test          # base de test
pnpm dev                      # http://localhost:3000
```

## Vérifications

```bash
pnpm typecheck
pnpm lint
pnpm test                     # intégration, sur TEST_DATABASE_URL (vidée à chaque test)
pnpm build && pnpm test:e2e   # Playwright, bureau et mobile, sur TEST_DATABASE_URL
```

Pour Playwright avec un Chromium déjà installé, définissez `PLAYWRIGHT_CHROMIUM_PATH`.

## Modifier le schéma

1. Éditez `src/db/schema.ts`.
2. `pnpm db:generate` crée la migration SQL dans `drizzle/`.
3. `pnpm db:migrate` puis `pnpm db:migrate:test`.
