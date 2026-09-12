# Ardi Transportation — Site Admin

A small Next.js app for editing the public website
([`../arditransportation`](../arditransportation)) without touching code.

Manages:

- **Contact & Location** — phone (displayed + dialed), hours, email, office address
- **Gallery** — the "Happy Clients" carousel: photos, captions, order
- **Fleet** — vehicle cards: photos, name, class, capacity, badge, photo size
- **Facebook** — page URL and handle

## Stack

- Next.js 16.2.4 (App Router) — read `node_modules/next/dist/docs/` before writing code
- Tailwind CSS v3 (matching the public site; `postcss.config.mjs` uses
  `tailwindcss: {}` + `autoprefixer: {}`, **not** `@tailwindcss/postcss`)
- Firebase — Auth (email/password) + Firestore (content)
- Cloudinary — image hosting. Firebase Storage is deliberately unused: it now
  requires the paid Blaze plan, while Cloudinary's free tier covers 25 GB.
- Node 20+ — `nvm use 20`

## Running locally

```bash
nvm use 20
cp .env.local.example .env.local   # then fill it in — see SETUP.md
npm install
npm run dev                        # http://localhost:3838
```

Port **3838**, so it can run alongside the public site on 3737.

## How content flows

```
                photo ──▶ Cloudinary  arditransportation/{gallery,fleet}
                  │                              │ (secure_url)
Admin (this app) ─┴────────write──▶  Firestore  site/content
                                          │
Public site  ────read (REST, cached 60s)──┘
```

The site is never configured with a Cloudinary folder — it renders whatever
absolute URL the content document holds, so admin and site can't drift apart.

- The admin writes the whole `site/content` document, merging in only the
  sections the open tab edits — two tabs can't clobber each other.
- The site reads it server-side over the Firestore REST API. No Firebase SDK and
  no service-account key on the public site.
- If Firestore is unreachable, missing, or a field is blank, the site falls back
  to `DEFAULT_CONTENT` — the copy it originally shipped with. **The site can
  never go blank because of a bad edit.**
- Saves optionally ping the site's `/api/revalidate` so changes appear
  immediately; otherwise they appear within 60 seconds.

## Keeping the schema in sync

`src/lib/content-schema.ts` is duplicated **verbatim** at
`../arditransportation/src/lib/content-schema.ts`. Changing one means changing
the other — the admin writes this shape, the site reads it.

```bash
diff src/lib/content-schema.ts ../arditransportation/src/lib/content-schema.ts
```

(only the header comment differs)

## Security model

- No public sign-up. Accounts are created by hand in the Firebase console.
- `firestore.rules` allows writes only from an allow-list of UIDs, and reads by
  anyone (the content is public marketing copy).
- Image uploads are **signed server-side** (`/api/cloudinary-sign`). The route
  verifies the caller's Firebase ID token before issuing a signature, so the
  Cloudinary API secret never reaches the browser and nobody can upload to the
  account without an admin login. An unsigned upload preset — the usual shortcut —
  would be readable in the public JS bundle.
- Uploads are capped at 8 MB and restricted to JPEG/PNG/WebP/AVIF, and land under
  `arditransportation/` (override with `CLOUDINARY_ROOT_FOLDER`). The client sends
  only `"gallery"` or `"fleet"` — the server builds the full path, so a caller
  can't write outside that root.
- `ADMIN_UIDS` lists the accounts allowed to upload, and **fails closed** — blank
  denies everyone. A valid Firebase session alone is not enough: the web API key
  is public, so unless sign-up is disabled in the Firebase console anyone holding
  it can self-register and obtain a real ID token.
- Turn off *Enable create (sign-up)* in Firebase Console → Authentication →
  Settings. Accounts are created by hand, so this costs nothing.
