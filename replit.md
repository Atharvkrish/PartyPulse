# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### PartyPulse (`artifacts/partypulse`)
- **Type**: React + Vite PWA
- **Preview path**: `/`
- **Tech stack**: Firebase v9 (Auth, Firestore, Storage) + Leaflet maps + Tailwind CSS
- **Features**:
  - Email/password + phone OTP authentication
  - Interactive Leaflet map with emoji category markers (red/yellow/green by RSVP count)
  - Event discovery: inline search bar, filter sheet (sort/date/category/distance/capacity), active filter chips
  - Event creation + editing with category selector (10 categories with emoji), map location picker, image upload
  - RSVP system (Going / Interested / Can't Go) with max attendee limit enforcement
  - Real-time Firestore chat per event with ban controls
  - Photo gallery with Firebase Storage upload and delete confirmation per event
  - Admin controls: edit event, delete event, ban/unban users from chat
  - Push notifications via FCM (friend requests, new events, @mentions)
  - Social feed, friend system, user profiles
  - PWA-ready (vite-plugin-pwa, injectManifest + custom sw.ts)
- **Filter logic**: `src/lib/eventFilters.ts` — pure client-side, Haversine distance, 10 categories
- **Filter UI**: `src/components/EventFilterSheet.tsx` — bottom sheet, z-[9999]
- **Firebase project**: `partypulse-dc24f`
- **Deploy**: See `artifacts/partypulse/DEPLOY.md` for Firebase Hosting + Vercel instructions
- **Security rules**: `artifacts/partypulse/firestore.rules`, `artifacts/partypulse/storage.rules`

### API Server (`artifacts/api-server`)
- **Type**: Express 5 API
- **Preview path**: `/api`
- Shared backend — currently has only the health endpoint

### Canvas (`artifacts/mockup-sandbox`)
- **Type**: Mockup sandbox
- **Preview path**: `/__mockup`
