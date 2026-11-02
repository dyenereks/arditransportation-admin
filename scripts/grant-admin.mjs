#!/usr/bin/env node
/**
 * Grant admin access to an existing account, by email.
 *
 * This exists for the bootstrap case — the first admin, before anyone can use
 * the Users screen — and as a way back in if the last admin is ever lost.
 * Everything afterwards is done in the app.
 *
 *   npm run grant-admin -- you@example.com
 */

import { readFile } from "node:fs/promises";
import { argv, env, exit } from "node:process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

async function loadEnv() {
  try {
    const text = await readFile(join(here, "..", ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // Fall back to the ambient environment.
  }
}

await loadEnv();

const email = argv[2];
if (!email || !email.includes("@")) {
  console.error("Usage: npm run grant-admin -- you@example.com");
  exit(1);
}

/**
 * Reads the service account in either supported form, matching
 * src/lib/firebase-admin.ts — the whole JSON in FIREBASE_SERVICE_ACCOUNT, or
 * FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY for hosts
 * that cap the combined size of all environment variables.
 */
function readServiceAccount() {
  const normalizeKey = (k) =>
    k.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n");

  const blob = env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (blob) {
    const parsed = JSON.parse(
      blob.startsWith("{") ? blob : Buffer.from(blob, "base64").toString("utf8")
    );
    return {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: normalizeKey(parsed.private_key ?? ""),
    };
  }

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: env.FIREBASE_PROJECT_ID.trim(),
      client_email: env.FIREBASE_CLIENT_EMAIL.trim(),
      private_key: normalizeKey(env.FIREBASE_PRIVATE_KEY),
    };
  }

  return null;
}

const json = readServiceAccount();

if (!json?.project_id || !json?.client_email || !json?.private_key) {
  console.error(
    "No service account configured — see SETUP.md step 4b. Granting access " +
      "writes a document the security rules forbid clients from touching, so " +
      "this needs either FIREBASE_SERVICE_ACCOUNT, or all three of " +
      "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY."
  );
  exit(1);
}

const { cert, initializeApp } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const { getFirestore, FieldValue } = await import("firebase-admin/firestore");

const app = initializeApp({
  credential: cert({
    projectId: json.project_id,
    clientEmail: json.client_email,
    privateKey: json.private_key,
  }),
  projectId: json.project_id,
});

const auth = getAuth(app);
const db = getFirestore(app);

let user;
try {
  user = await auth.getUserByEmail(email);
} catch {
  console.error(
    `No account exists for ${email}. Create it first in Firebase Console → ` +
      `Authentication → Users, then run this again.`
  );
  exit(1);
}

await db.collection("admins").doc(user.uid).set(
  {
    email: user.email ?? email,
    addedBy: "grant-admin script",
    addedAt: FieldValue.serverTimestamp(),
  },
  { merge: true }
);

const total = await db.collection("admins").count().get();
console.log(
  `${user.email} (${user.uid}) is now an admin. ` +
    `${total.data().count} admin(s) total.`
);
