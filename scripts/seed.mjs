#!/usr/bin/env node
/**
 * Write the site's current content into Firestore as `site/content`.
 *
 * Runs against the same REST APIs the browser uses and signs in as a real admin
 * account, so it needs no service-account key and is bound by the same security
 * rules as the app. Safe to re-run — it overwrites the document with defaults.
 *
 *   npm run seed
 */

import { createInterface } from "node:readline/promises";
import { readFile } from "node:fs/promises";
import { stdin, stdout, env, exit } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

/** Minimal .env.local reader — avoids pulling in a dependency for one file. */
async function loadEnv() {
  try {
    const text = await readFile(join(here, "..", ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local — fall back to whatever is already in the environment.
  }
}

/** Convert a plain JS value into Firestore's typed REST representation. */
function encode(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encode) } };
  }
  return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, encode(v)])
      ),
    },
  };
}

async function main() {
  await loadEnv();

  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    console.error(
      "Missing NEXT_PUBLIC_FIREBASE_API_KEY / NEXT_PUBLIC_FIREBASE_PROJECT_ID.\n" +
        "Fill in .env.local first — see SETUP.md step 3."
    );
    exit(1);
  }

  const content = JSON.parse(
    await readFile(join(here, "..", "src", "lib", "default-content.json"), "utf8")
  );

  const rl = createInterface({ input: stdin, output: stdout });
  console.log(`Signing in to project "${projectId}" to write site/content.\n`);
  const email = (await rl.question("Admin email: ")).trim();
  const password = await rl.question("Password: ");
  rl.close();
  console.log();

  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  if (!signIn.ok) {
    const body = await signIn.json().catch(() => ({}));
    console.error(
      `Sign-in failed: ${body?.error?.message ?? signIn.status}\n` +
        "Check the email and password, and that Email/Password sign-in is enabled."
    );
    exit(1);
  }

  const { idToken, localId } = await signIn.json();

  const write = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
      `/databases/(default)/documents/site/content`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields: encode(content).mapValue.fields }),
    }
  );

  if (!write.ok) {
    const body = await write.json().catch(() => ({}));
    console.error(`Write failed: ${body?.error?.message ?? write.status}`);
    if (write.status === 403) {
      console.error(
        `\nYour UID is ${localId}. Add it to the allow-list in firestore.rules ` +
          `and deploy the rules — see SETUP.md step 4.`
      );
    }
    exit(1);
  }

  console.log(
    `Seeded site/content — ${content.gallery.length} gallery photos, ` +
      `${content.fleet.length} vehicles.`
  );
}

await main();
