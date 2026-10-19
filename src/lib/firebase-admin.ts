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

/**
 * Accepts the service-account JSON either raw or base64-encoded. Base64 is the
 * practical choice for hosting dashboards, which mangle multi-line values.
 */
function readServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  const text = raw.trim().startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");

  try {
    const parsed = JSON.parse(text) as Record<string, string>;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error("missing project_id, client_email or private_key");
    }
    // Env vars commonly arrive with the key's newlines escaped.
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  } catch (e) {
    throw new Error(
      `FIREBASE_SERVICE_ACCOUNT could not be parsed (${
        e instanceof Error ? e.message : "unknown error"
      }). Paste the whole service-account JSON, or its base64 encoding.`
    );
  }
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
