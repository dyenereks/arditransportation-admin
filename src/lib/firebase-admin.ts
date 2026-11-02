import "server-only";

import { createHash } from "node:crypto";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Server-side Firebase, used for the things the client SDK cannot do:
 * creating accounts, listing them, deleting them, and setting passwords.
 *
 * The service account bypasses security rules entirely, so nothing here may run
 * without first establishing that the caller is an admin — see requireAdmin().
 */

const APP_NAME = "admin";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

/**
 * Recover a usable PEM from however the host stored it.
 *
 * Private keys survive env vars badly: they arrive quote-wrapped, with newlines
 * escaped once, or — when a value passes through two layers of escaping, which
 * some hosting dashboards do — escaped twice. All three forms look fine in a UI
 * and fail only when the SDK tries to sign a token.
 */
function unwrap(value: string): string {
  // Strip balanced wrapping quotes, then any stray leading/trailing quote left
  // by a mispaste — a single unmatched quote on an email or project id is
  // invisible in an env file and breaks authentication with a message that
  // points nowhere near the real cause.
  return value
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

function normalizeKey(key: string): string {
  const body = unwrap(key)
    .replace(/\\\\n/g, "\n") // \\n  (double-escaped)
    .replace(/\\n/g, "\n"); //  \n   (single-escaped)
  // PEM convention keeps a trailing newline; some parsers insist on it.
  return body.endsWith("\n") ? body : `${body}\n`;
}

/** Reject values that will only fail later, far from their cause. */
function assertUsableIdentity(projectId: string, clientEmail: string): void {
  if (/["'\s]/.test(projectId)) {
    throw new Error(
      `The service-account project id ("${projectId}") contains quotes or ` +
        "whitespace. Remove them from the environment variable."
    );
  }
  if (/["'\s]/.test(clientEmail)) {
    throw new Error(
      `The service-account client email ("${clientEmail}") contains quotes or ` +
        "whitespace — usually a stray quote from pasting. Remove it."
    );
  }
  if (!clientEmail.includes("@") || !clientEmail.endsWith(".iam.gserviceaccount.com")) {
    throw new Error(
      `The service-account client email ("${clientEmail}") does not look like ` +
        "a service account — it should end with .iam.gserviceaccount.com."
    );
  }
}

/**
 * Catch a mangled key here rather than letting it surface later as an opaque
 * verification failure that looks like the user's session is at fault.
 */
function assertUsableKey(key: string): void {
  const begin = /-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(key);
  const end = /-----END (?:RSA )?PRIVATE KEY-----/.test(key);
  if (!begin || !end) {
    throw new Error(
      "The service-account private key is missing its BEGIN/END markers — " +
        "the value looks truncated. Check it was pasted in full."
    );
  }
  if (!key.includes("\n")) {
    throw new Error(
      "The service-account private key has no line breaks, so it cannot be " +
        "parsed. Store it with real newlines, or with them escaped as \\n."
    );
  }
  if (key.includes("\\")) {
    throw new Error(
      "The service-account private key still contains backslashes after " +
        "unescaping, so the host stored it double-escaped in a way this cannot " +
        "undo. Re-paste it, or use FIREBASE_SERVICE_ACCOUNT with the JSON " +
        "minified to one line."
    );
  }
}

/**
 * Reads the service account from either form:
 *
 *   FIREBASE_SERVICE_ACCOUNT  — the whole JSON, raw or base64
 *   FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 *
 * The split form exists for hosts that cap the combined size of all
 * environment variables — AWS Lambda allows 4 KB in total, and the full JSON
 * is ~2.4 KB raw or ~3.2 KB base64. Keeping only the three fields that matter
 * brings it to ~1.9 KB.
 */
type Source = "FIREBASE_SERVICE_ACCOUNT" | "split variables";

/** Non-secret description of whichever credential was loaded, for diagnostics. */
let loaded: { source: Source; projectId: string; clientEmail: string; keyFingerprint: string } | null =
  null;

/**
 * A short, non-secret fingerprint of the private key.
 *
 * Enough to tell two keys apart — which is the question when one environment
 * works and another does not — without revealing any of the key itself.
 */
function fingerprint(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

function parseBlob(blob: string): ServiceAccount {
  const text = blob.startsWith("{")
    ? blob
    : Buffer.from(blob, "base64").toString("utf8");

  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(text) as Partial<ServiceAccount>;
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT is not valid JSON. Paste the whole " +
        "service-account file (minified to one line), or its base64 encoding."
    );
  }

  const missing = (["project_id", "client_email", "private_key"] as const).filter(
    (k) => !parsed[k]
  );
  if (missing.length) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT is missing ${missing.join(", ")}. ` +
        "Use the file from Firebase Console → Project settings → Service accounts."
    );
  }

  const project_id = unwrap(parsed.project_id!);
  const client_email = unwrap(parsed.client_email!);
  const private_key = normalizeKey(parsed.private_key!);
  assertUsableIdentity(project_id, client_email);
  assertUsableKey(private_key);
  return { project_id, client_email, private_key };
}

function parseSplit(): ServiceAccount | null {
  const project_id = process.env.FIREBASE_PROJECT_ID
    ? unwrap(process.env.FIREBASE_PROJECT_ID)
    : undefined;
  const client_email = process.env.FIREBASE_CLIENT_EMAIL
    ? unwrap(process.env.FIREBASE_CLIENT_EMAIL)
    : undefined;
  const private_key = process.env.FIREBASE_PRIVATE_KEY;

  if (!project_id && !client_email && !private_key) return null;

  const missing = [
    !project_id && "FIREBASE_PROJECT_ID",
    !client_email && "FIREBASE_CLIENT_EMAIL",
    !private_key && "FIREBASE_PRIVATE_KEY",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `Incomplete service account — missing ${missing.join(", ")}. ` +
        "Set all three, or use FIREBASE_SERVICE_ACCOUNT instead."
    );
  }

  const key = normalizeKey(private_key!);
  assertUsableIdentity(project_id!, client_email!);
  assertUsableKey(key);
  return { project_id: project_id!, client_email: client_email!, private_key: key };
}

function readServiceAccount(): ServiceAccount | null {
  const blob = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  const hasSplit = !!(
    process.env.FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    process.env.FIREBASE_PRIVATE_KEY
  );

  if (blob) {
    if (hasSplit) {
      console.warn(
        "[firebase-admin] Both FIREBASE_SERVICE_ACCOUNT and the split variables " +
          "are set. The blob wins. If you meant to switch to the split form, " +
          "delete FIREBASE_SERVICE_ACCOUNT from this environment."
      );
    }
    try {
      const sa = parseBlob(blob);
      loaded = {
        source: "FIREBASE_SERVICE_ACCOUNT",
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        keyFingerprint: fingerprint(sa.private_key),
      };
      return sa;
    } catch (e) {
      // Rather than fail outright, prefer a usable split credential if one is
      // present — otherwise a stale blob silently defeats a correct update.
      if (!hasSplit) throw e;
      console.warn(
        `[firebase-admin] FIREBASE_SERVICE_ACCOUNT is unusable (${
          e instanceof Error ? e.message : "unknown error"
        }); falling back to the split variables.`
      );
    }
  }

  const split = parseSplit();
  if (!split) return null;
  loaded = {
    source: "split variables",
    projectId: split.project_id,
    clientEmail: split.client_email,
    keyFingerprint: fingerprint(split.private_key),
  };
  return split;
}

/**
 * Which credential is in play, in non-secret terms.
 *
 * When one environment authenticates and another does not, the useful question
 * is whether they are even using the same values — this answers it without
 * exposing the key.
 */
export function describeCredential(): string {
  if (!loaded) return "no service account loaded";
  return (
    `source=${loaded.source}, project=${loaded.projectId}, ` +
    `client_email=${loaded.clientEmail}, key#${loaded.keyFingerprint}`
  );
}

let cached: { app: App; auth: Auth; db: Firestore } | null = null;

/**
 * Returns null when no service account is configured, so a build or a preview
 * deploy without secrets still succeeds — callers surface that as a clear
 * "user management is not configured" rather than crashing.
 */
export function adminSdk(): { auth: Auth; db: Firestore } | null {
  if (cached) return cached;

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) return null;

  const app = getApps().find((a) => a.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp(
        {
          credential: cert({
            projectId: serviceAccount.project_id,
            clientEmail: serviceAccount.client_email,
            privateKey: serviceAccount.private_key,
          }),
          projectId: serviceAccount.project_id,
        },
        APP_NAME
      );

  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}

/** Firestore collection holding one document per admin, keyed by UID. */
export const ADMINS = "admins";
