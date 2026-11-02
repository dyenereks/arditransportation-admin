import "server-only";

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

/** Env vars routinely arrive with the key's newlines escaped, or quote-wrapped. */
function normalizeKey(key: string): string {
  return key
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n");
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
function readServiceAccount(): ServiceAccount | null {
  const blob = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();

  if (blob) {
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

    return {
      project_id: parsed.project_id!,
      client_email: parsed.client_email!,
      private_key: normalizeKey(parsed.private_key!),
    };
  }

  const project_id = process.env.FIREBASE_PROJECT_ID?.trim();
  const client_email = process.env.FIREBASE_CLIENT_EMAIL?.trim();
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

  return {
    project_id: project_id!,
    client_email: client_email!,
    private_key: normalizeKey(private_key!),
  };
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
