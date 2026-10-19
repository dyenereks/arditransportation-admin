@AGENTS.md

# Ardi Transportation — Admin

Next.js 16 App Router admin for editing the public marketing site at
`../arditransportation`. See `README.md` for the architecture and `SETUP.md` for
the Firebase configuration steps.

## Stack

- **Next.js 16.2.4** (App Router) — read `node_modules/next/dist/docs/` before writing code (see AGENTS.md)
- **React 19.2**
- **Tailwind CSS v3** — same downgrade as the public site. `postcss.config.mjs`
  uses `tailwindcss: {}` + `autoprefixer: {}`, NOT `@tailwindcss/postcss`.
- **Firebase v12** — Auth (email/password) + Firestore. Client SDK only; no
  service-account key anywhere.
- **Cloudinary** — image hosting, via signed uploads. Firebase Storage is
  deliberately unused (it requires the paid Blaze plan).
- **lucide-react** for icons
- **Node 20+** — `nvm use 20`

## Running locally

```bash
nvm use 20
npm run dev          # http://localhost:3838
npm run build
npm run lint
npm run seed         # write default-content.json into Firestore
```

Dev server runs on **port 3838** so it can sit alongside the site on 3737.

## Conventions / gotchas

- **`src/lib/content-schema.ts` and `src/lib/default-content.json` are duplicated
  verbatim in the public site** (`../arditransportation/src/lib/`). Editing one
  without the other silently breaks the contract. Only the header comment differs.
- Every page under `src/app/dashboard/` is a client component — Firebase's client
  SDK is the only data path.
- Image uploads go browser → Cloudinary directly; only the *signature* comes from
  `src/app/api/cloudinary-sign/route.ts`, which verifies the caller's Firebase ID
  token first. Never move `CLOUDINARY_API_SECRET` behind a `NEXT_PUBLIC_` prefix,
  and don't "simplify" this to an unsigned upload preset — the preset would be
  readable in the client bundle and let anyone upload to the account.
- Uploads go to `arditransportation/{gallery,fleet}` on Cloudinary
  (`CLOUDINARY_ROOT_FOLDER` overrides the root). The **server** builds the full
  path from a client-supplied `"gallery" | "fleet"` — keep it that way, or a
  caller could write anywhere in the account. The signed `folder` must match the
  `folder` sent with the upload exactly, so the client echoes back the value the
  sign route returned.
- `src/lib/firebase.ts` throws at import time when a `NEXT_PUBLIC_FIREBASE_*` var
  is missing. That's deliberate: the alternative is an opaque Firebase error much
  later.
- Each dashboard tab saves only its own top-level keys via `savePartial`, which
  re-reads the document first. Don't switch it to a whole-document write — the
  tabs would clobber each other.
- **Use inline `style={{ ... }}` for dynamic state-driven styling.** Tailwind
  purges template-literal classes. This is why vehicle photo size is stored as
  `"small" | "medium" | "large"` and mapped to a pixel height on the site rather
  than stored as a Tailwind class.
- Brand color **`#DC0000`**; surfaces are `#0a0a0a` (page), `#141414` (cards),
  `#161616` (inputs), with `rgba(255,255,255,0.1–0.15)` borders.

## Security

- No public sign-up. Accounts are created by hand in the Firebase console.
- **Authorization is one place: a document in the `admins` collection.** The
  security rules check `exists(/admins/$(uid))`, and every protected route calls
  `requireAdmin`, which does the same after verifying the token. Don't reintroduce
  a UID list in config — that split is what made adding a user impossible and
  caused saves and uploads to disagree.
- Reads are public — the site fetches content unauthenticated.
- `src/lib/firebase-admin.ts` holds the service account and bypasses all rules.
  It is `server-only`; never import it from a client component, and never expose
  `FIREBASE_SERVICE_ACCOUNT` to the browser.
- Routes that act on another account must check the target has an `admins`
  document first. The service account will happily delete or re-password any
  user in the project otherwise.
- The last admin cannot be removed, and nobody can remove themselves — losing
  every admin would mean no way back in short of `npm run grant-admin`.
- `ADMIN_UIDS` (server-only) lists who may upload images and **fails closed** —
  blank denies everyone. Don't "simplify" it back to allowing any authenticated
  user: the Firebase web API key is public, so with sign-up enabled anyone can
  self-register and hold a genuine ID token for the project.
