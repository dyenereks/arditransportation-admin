# Setup

Two services: **Firebase** for sign-in and the content database, **Cloudinary**
for hosting uploaded photos. Both stay on their free tiers — Firebase Storage is
deliberately not used, because it now requires the paid Blaze plan.

## 1. Enable the Firebase services

In the [Firebase console](https://console.firebase.google.com/):

| Service | Where | What to do |
|---|---|---|
| **Authentication** | Build → Authentication → Sign-in method | Enable **Email/Password**. Leave "Email link" off. |
| **Firestore** | Build → Firestore Database | Create database. Any region; `us-west1` is closest to San Diego. Start in **production mode** — the rules in step 4 replace the defaults. |

Storage is **not** needed. Leave it disabled.

## 2. Create your admin account

Authentication → Users → **Add user**. Enter an email and a strong password.

Copy the **User UID** from the list — you need it in step 4.

There is no sign-up screen; this is the only way an account is created.

## 3. Set up Cloudinary

Sign up free at [cloudinary.com](https://cloudinary.com/users/register_free) — no
credit card. The free tier covers 25 GB of storage and 25 GB of monthly delivery,
which is far more than this site will use.

From the Cloudinary console, go to **Settings → API Keys** (the dashboard also
shows these) and note three values:

- **Cloud name** — public, appears in every image URL
- **API key**
- **API secret** — treat like a password

You do **not** need an upload preset. Uploads from the admin are signed
server-side, so the secret never reaches the browser and nobody else can upload
to your account.

You also don't need to create any folders. Everything uploads into
`arditransportation/gallery` and `arditransportation/fleet`, which Cloudinary
creates on the first upload. To use a different root folder, set
`CLOUDINARY_ROOT_FOLDER` in `.env.local`.

## 4. Fill in `.env.local`

Firebase: Project settings (gear icon) → **Your apps**. If there's no web app
yet, add one (`</>` icon, no Hosting needed).

```bash
cp .env.local.example .env.local
```

| Variable | From |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase `projectId` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase `appId` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLOUDINARY_ROOT_FOLDER` | Optional — defaults to `arditransportation` |
| `ADMIN_UIDS` | **Required for uploads** — your UID from step 2. Blank means no one can upload |

The `NEXT_PUBLIC_` values are public by design — Firebase web keys identify the
project rather than granting access, and the Cloudinary cloud name is in every
image URL anyway. **`CLOUDINARY_API_SECRET` is different: it must never get a
`NEXT_PUBLIC_` prefix**, or it ships to every visitor's browser.

## 5. Turn off public sign-up

Authentication → **Settings** → User actions → untick **Enable create (sign-up)**.

This matters more than it looks. The Firebase web API key is public by design —
it ships in the site's JavaScript — and while that key grants no data access on
its own, it *is* enough to call the sign-up endpoint. With sign-up left on,
anyone could register an account in your project and obtain a genuine ID token.

Your content is still protected by the Firestore rules in step 6, and uploads by
`ADMIN_UIDS`, but this closes the door one step earlier. You create accounts by
hand in the console, so nothing is lost.

## 6. Deploy the Firestore rules

Open `firestore.rules` and replace `REPLACE_WITH_YOUR_ADMIN_UID` with the UID
from step 2. To add a second admin later, add their UID to the same list.

Then either paste the file into the console (Firestore → Rules) and publish, or
use the CLI:

```bash
npx firebase-tools login
npx firebase-tools use --add          # pick your project
npx firebase-tools deploy --only firestore:rules
```

> Without this step Firestore's production-mode default denies everything and
> saves fail with "Missing or insufficient permissions."

## 7. Seed the first document

Optional but recommended — it puts today's live content into Firestore so the
first thing you see in the admin is the real site, not empty fields.

```bash
nvm use 20
npm run seed
```

Safe to skip: the admin shows the shipped defaults for an empty document anyway,
and the first save writes them.

## 8. Point the public website at the same Firebase project

In `../arditransportation/.env.local`:

```
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_API_KEY=...same key...
```

That's all the site needs — it reads over REST and only ever reads. It has no
Cloudinary configuration at all, and nothing to point at a folder: each photo's
full URL is stored in the content document, so the site always loads exactly
what the admin uploaded.

## 9. Optional: instant updates

Without this, an edit shows up on the site within 60 seconds. With it, right
away.

Pick any random string as the secret, then:

`../arditransportation/.env.local`:
```
REVALIDATE_SECRET=the-random-string
ADMIN_ORIGIN=http://localhost:3838
```

`.env.local` (this app):
```
NEXT_PUBLIC_SITE_REVALIDATE_URL=http://localhost:3737/api/revalidate
NEXT_PUBLIC_SITE_REVALIDATE_SECRET=the-random-string
```

Use the real domains in production. The secret ships to the browser, so it's a
nuisance filter rather than a credential — the worst a caller can do with it is
force the site to refetch its own content.

## Deploying

Two separate Vercel projects, one per folder.

- **Site** — root `arditransportation`, env: the two `NEXT_PUBLIC_FIREBASE_*`
  vars, plus `REVALIDATE_SECRET` / `ADMIN_ORIGIN` if you did step 9.
- **Admin** — root `arditransportation-admin`, env: everything in
  `.env.local.example`. Set `NEXT_PUBLIC_SITE_URL` to the live site.

The admin needs a real server (it has API routes) — a static export won't work.
Vercel, Netlify, or any Node host is fine.

Afterwards, update `ADMIN_ORIGIN` on the site with the admin's real domain.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Missing or insufficient permissions" on save | Step 6 — UID not in the rules allow-list, or rules not deployed |
| "Cloudinary is not configured" when uploading | Step 4 — one of the three Cloudinary vars is blank. On a host, check they're set for the deployed environment, not just locally |
| "Uploads are disabled because ADMIN_UIDS is not set" | `ADMIN_UIDS` is blank. This is deliberate — the gate fails closed. The message names your UID; paste it in and restart |
| "This account (…) is not in ADMIN_UIDS" | `ADMIN_UIDS` is set and doesn't include the account you signed in as. The message names your real UID — paste that in. Do not "fix" this by clearing `ADMIN_UIDS`; blank denies everyone. Restart the server after editing `.env.local` |
| "Couldn't verify your session" | Sign out and back in. If it persists, the server log names the cause — usually a Firebase API key with HTTP-referrer restrictions, which block server-side calls |
| "Your session expired — sign in again" | Sign out and back in |
| Red *"Not configured"* banner | Step 4 — a blank var; the banner names it. Restart `npm run dev` after editing `.env.local` |
| Site still shows old content | Wait 60s, or set up step 9. On a host, confirm the site's env vars are set for the deployed environment |
| Images 400 on the site | The site's `next.config.ts` must allow `res.cloudinary.com` — it already does |
