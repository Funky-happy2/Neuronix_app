# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Neuronix is an **educational website for children aged 9–13** that teaches STEM through
arcade-style games, boss battles, and science lab simulations. The audience shapes
nearly every product decision — keep these constraints in mind for any UI or copy change:

- **Kid-friendly, encouraging language** everywhere. No condescension, no scary failure states.
- **Large buttons, high-contrast colors**, vibrant arcade aesthetic (purple/blue/green/orange, Oxanium font).
- **No chat with strangers and no external links** — social features are walled gardens (clans, teams, classes, trades, PvP duels) and content is moderated/admin-approved.
- **A mute button must always be reachable** (passed through `Navbar` → `onToggleMute`).
- **Safety system is first-class**: per-user and teacher-enforced class-level toggles hide social
  surfaces (`hideLeaderboard`, `disableMultiplayer`, `hideTrade`, `focusMode`, etc.). The `useSafety()`
  hook computes hidden nav paths from the `/api/user` response with zero extra fetches — respect it
  when adding new social pages.

Science accuracy in lab simulations matters and has been deliberately tuned; don't "simplify"
lab physics/chemistry wording without checking it's still factually correct.

## Commands

```bash
npm run dev      # dev server (tsx, NODE_ENV=development) — serves API + Vite-HMR client on PORT (default 5000)
npm run build    # full prod build via script/build.ts (client → dist/public, server → dist/index.cjs)
npm run start    # run the production bundle (NODE_ENV=production node dist/index.cjs)
npm run check    # TypeScript typecheck (tsc --noEmit) — the only static-analysis gate
npm run db:push  # push shared/schema.ts to the database via drizzle-kit (no migration files are committed)
```

There is **no test runner and no linter configured** — `npm run check` is the verification step before committing.

### Environment variables

- `DATABASE_URL` — PostgreSQL connection string (required; `db:push` and the server both fail without it).
- `SESSION_SECRET` — required in production; a throwaway secret is generated in dev (sessions won't survive restart).
- `PORT` — defaults to 5000. The single port serves both the API and the client.

## Architecture

A TypeScript monorepo with three roots, wired by path aliases (`@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets`); aliases are defined in **both** `vite.config.ts` and `tsconfig.json`.

- **`client/`** — React 18 SPA. Routing is **wouter** (not react-router) in `client/src/App.tsx`. Data fetching is TanStack Query (`lib/queryClient.ts`). UI is shadcn/ui (new-york style) in `components/ui` + Tailwind + Framer Motion. State that matters lives in two places — see "Progression model" below.
- **`server/`** — Express 5. `index.ts` boots one HTTP server that mounts the API, then attaches Vite middleware in dev or static file serving (`static.ts`) in prod — so the catch-all client route must come last. **`routes.ts` is a single ~8k-line file** holding essentially all API endpoints *and* the `ws` WebSocket server (multiplayer lobby, real-time PvP quiz duels, spectators). New endpoints go here; it's monolithic by design.
- **`shared/schema.ts`** — Drizzle ORM table definitions + `drizzle-zod` insert types. This is the single source of truth for the DB shape and is imported by both client and server. ~30 tables (users, clans, teams, tournaments, grand tournaments, district battles, trades, schools/classes, admin proposals, etc.).

### Build pipeline (`script/build.ts`)

`npm run build` runs Vite for the client, then esbuild to bundle the server into a single minified CJS file. esbuild **externalizes most node_modules and only inlines an explicit `allowlist`** of server deps (to cut cold-start syscalls). If you add a server dependency that must be bundled, add it to that allowlist.

### Progression model (important and non-obvious)

User progress is **hybrid: LocalStorage-first for privacy + server persistence**. `client/src/lib/useLocalProgress.ts` is the client source of truth (xp, coins, gems, level, streaks, badges, `gameScores`, `bossesDefeated`, `yearLevel` — default year 7). Page components receive these as props and callbacks (`addXP`, `addCoins`, `earnBadge`, `defeatBoss`, `recordGamePlay`) from the `Router` in `App.tsx`. The server mirrors much of this on the `users` row and re-derives some rewards server-side.

- **`GamePlayer` submits rewards itself** and shows XP/coins/badges on its result screen. Pass `skipRewardSubmit` when the *parent* owns submission (e.g. PvP in `LobbyPage`).
- High scores are stored both overall (`gameId`) and per difficulty (`gameId:easy|medium|hard`) in the `gameScores` JSONB.
- `yearLevel` drives question difficulty across arcade quizzes, tournaments, and multiplayer.

### Content is data-driven

All games, bosses, labs, badges, worlds, potions, avatars, and tournament tiers are declared as
arrays/maps in **`client/src/lib/gameData.ts`** (`GAME_MODES`, `BOSS_BATTLES`, `LAB_EXPERIMENTS`,
`BADGES`, `WORLDS`, `POTIONS`, `TOURNAMENT_TIERS`, etc.). Home-page stat counts and many gameplay
mechanics are *computed from the length/contents of these arrays* — there are no hardcoded counts,
so adding a game/boss/world automatically updates the UI. Add content by editing these arrays rather
than hardcoding numbers elsewhere. Question banks live in `lib/questionBank.ts` and `lib/bossQuestions.ts`.

### Auth & admin

`server/auth.ts` uses passport-local with scrypt password hashing and express-session backed by
`connect-pg-simple`. One username (`Funky_happy2`, the "Ultra Admin"/Speaker) is auto-promoted to admin
on register/login and has final say in the **Admin Parliament** system, where major moderation actions
(ban, strike, delete, toggle-admin) require a proposal + admin votes before execution. Ultra-admin status
can be transferred and is then persisted in `users.is_ultra_admin`.

## Notes

- `replit.md` is the long-form product/feature spec (history of every system). It's the deepest reference for *what a feature is supposed to do*; this file covers *how the code is organized*.
- The app runs on a single firewalled port; don't assume a separate API host/origin on the client.
