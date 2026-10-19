# Wedding Rentals frontend

Solid.js + Vite + Tailwind site for brides (`/`) and admins (`/admin`), in Turkmen, Russian and English.

## Setup

```sh
cd frontend
npm install          # npm installs packages (Deno's npm client is too slow on this network)
```

Everything else runs through Deno. Don't run Vite with Node: the installed Node is too old for it.

| Command | What it does |
|---|---|
| `deno task dev` | Dev server on http://localhost:5173; `/api` and `/uploads` go to the Go API on :8080 (`cd backend && make run`) |
| `deno task test` | Unit tests for `src/lib` and `src/i18n` |
| `deno task check` | Type-checks all of `src` |
| `deno task build` | Production build into `dist/`, which the Go server serves (`WEB_DIR=../frontend/dist`) |
| `sh scripts/make-icons.sh` | Re-renders the PWA icons after editing `icons-src/*.svg` (macOS) |

## Where things are

- `src/lib/api.ts` is the only place that calls `fetch`; `src/lib/upload.ts` uploads photos with progress.
- Texts live in `src/i18n/{tk,ru,en}.json`. The three files must have the same keys, and `deno task test` checks this.
- Favorites, the language choice and the admin token are kept in `localStorage` (`wr.favorites`, `wr.lang`, `wr.admin_token`).
- Design tokens (the Gyrmyzy palette, the Forum and Manrope fonts) are in `src/index.css`. The göl ornament is `src/components/GolBand.tsx`.
