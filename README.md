# Wavelength

A cloud music player for the songs you own: sign in, upload your tracks, and
play them from any browser with a queue and a live spectrum display. This is
the Phase 1 frontend from the project roadmap (auth, cloud library, player),
built so Phases 2 to 5 can be added without rework.

**Stack:** React 19, TypeScript, Vite, Supabase (Auth, Postgres, Storage),
Web Audio API.

## Run it now (demo mode)

```bash
npm install
npm run dev
```

Open the printed URL and sign in with any email and password. With no
Supabase variables set, the app runs in **demo mode**: three short tracks are
synthesized in your browser, uploads work (they live in memory), and nothing
is saved when you reload. It exists so the whole UI can be tried before any
backend is set up. A "Demo mode" label is shown in the header while it is on.

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste and run [`supabase/schema.sql`](./supabase/schema.sql).
   It creates the `songs` table, row-level security, and the `songs` (private)
   and `thumbnails` (public) storage buckets. Safe to re-run.
3. In **Project Settings → API**, copy the Project URL and the anon public key.
4. `cp .env.example .env` and paste both values in.
5. Optional, for development: **Authentication → Sign In / Providers → Email**,
   turn off "Confirm email" so you can sign up and sign in immediately.
6. Restart `npm run dev`.

Setting only one of the two variables is treated as a mistake and fails with a
clear message instead of silently falling back to demo mode.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check, then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

## How it's organised

```
src/
  lib/backend/        The only code that talks to a backend
    types.ts            Backend interface + Song type
    supabaseBackend.ts  Real implementation
    demoBackend.ts      In-memory implementation (+ demoAudio.ts synth)
    index.ts            Picks one from the env variables
  context/
    AuthContext.tsx     Session state
    PlayerContext.tsx   Queue, transport, Web Audio graph, analyser
  hooks/useLibrary.ts   Load / upload / rename / delete songs
  components/
    Auth/  Layout/  Library/  Player/
  styles/               base, auth, library, player
```

Components never import Supabase. They use the `Backend` interface, which is
why demo mode and the real backend are interchangeable and why a feature can
change without touching unrelated UI.

## Notes for contributors

- **Audio graph:** `<audio>` → source → analyser → gain → speakers. The
  Phase 3 equalizer goes between the analyser and the gain as a chain of
  `BiquadFilterNode`s. Volume is set on the `<audio>` element, not the gain
  node, so the two never double-attenuate.
- **CORS:** the audio element sets `crossOrigin = "anonymous"`. Without it,
  routing a cross-origin file (such as a Supabase signed URL) through the Web
  Audio API produces silence.
- **Storage:** files go to a private bucket at `<user_id>/<uuid>-<name>`.
  Playback uses a fresh one-hour signed URL per track, never a public link.
- **Keyboard:** Space toggles play/pause when focus isn't on a control. Media
  keys work through the Media Session API.
- **Reduced motion:** the spectrum and the queue drawer respect
  `prefers-reduced-motion`.
- **UI standards** (also recorded in the SRS, section 3.1.1): IBM Plex Sans;
  charcoal background with one amber accent used only for active and primary
  states; icon-only buttons carry an `aria-label`; times use tabular figures;
  below 640px the duration column and volume control are hidden.

## Not built yet

Custom thumbnails, themes, tag-based sorting (Phase 2); equalizer and
lossless delivery (Phase 3); Jam (Phase 4); listening recap and offline
caching (Phase 5). Metadata is currently taken from the file name; there is
no ID3 tag reading.
