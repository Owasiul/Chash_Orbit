# Chash Orbit 🌍

Earth-to-farm decision system — NASA Space Apps Challenge.

Point at any location on the 3D Earth, and Chash Orbit combines live NASA satellite
observations (POWER, SMAP, GPM, MODIS) with a crop-compatibility and rotation-planning
engine to recommend what to plant next.

## Tech Stack

- **Next.js 16** (App Router) — frontend + API routes
- **React 19**, **Tailwind CSS 4**, **shadcn/ui**, **three.js / react-globe.gl**
- **Prisma + SQLite** — persistence
- **Node.js ≥ 20.9** (npm) — runtime & package manager

## Getting Started

```bash
# 1. Install dependencies (also generates the Prisma client)
npm install

# 2. Create the database from the Prisma schema
npm run db:push

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> The crop library is seeded automatically on first API call — no manual seed step needed.

### Environment

Copy `.env` and adjust if needed:

```
DATABASE_URL=file:../db/custom.db
```

The SQLite file lives in `db/` and is gitignored (local data only).

## Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start dev server on port 3000                |
| `npm run build`     | Production build (standalone output)         |
| `npm start`         | Run the production server (`node`)           |
| `npm run lint`      | Run ESLint                                   |
| `npm run db:push`   | Sync Prisma schema to the SQLite database    |
| `npm run db:generate` | Regenerate the Prisma client               |

## Deploying to GitHub

```bash
# 1. Create an empty repo on https://github.com/new (do NOT add a README/.gitignore)

# 2. Connect and push
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

## Deploying the App

**Vercel (recommended for the web app):**
1. Push the repo to GitHub (above).
2. Go to [vercel.com/new](https://vercel.com/new) and import the repo — Next.js is auto-detected.
3. Add the environment variable `DATABASE_URL` in project settings.
4. Deploy.
> ⚠️ Vercel's filesystem is ephemeral, so SQLite works for read-mostly demos but data
> won't persist across deployments. For real persistence, switch Prisma to a hosted
> Postgres (Neon, Supabase, Railway) by changing `provider = "sqlite"` → `"postgresql"`
> in `prisma/schema.prisma` and updating `DATABASE_URL`.

**Any Node server / VPS (keeps SQLite):**
```bash
npm ci
npm run build
npm start          # serves .next/standalone/server.js on port 3000
```
Put a reverse proxy (Nginx/Caddy) in front for HTTPS.

## Data Sources

- [NASA POWER](https://power.larc.nasa.gov/) — live agroclimate data
- SMAP / GPM / MODIS — demonstrated with honest fallback/demo attribution
