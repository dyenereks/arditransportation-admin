import "server-only";

import { NextResponse } from "next/server";
import { ADMINS, adminSdk, describeCredential } from "./firebase-admin";

/**
 * Establishes that a request comes from a signed-in admin.
 *
 * Authorization is a document in the `admins` collection rather than a
 * hardcoded list, so granting access is data — no rules edit, no redeploy.
 * Holding a valid Firebase session is NOT sufficient on its own: the web API
 * key is public, so a token only proves "some account in this project".
 */

export type AdminCaller = { uid: string; email: string | null };

type Failure = { response: NextResponse };

export function isFailure(x: unknown): x is Failure {
  return !!x && typeof x === "object" && "response" in x;
}

const fail = (error: string, status: number): Failure => ({
  response: NextResponse.json({ error }, { status }),
});

/** Pull the bearer token off the Authorization header. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function requireAdmin(
  request: Request
): Promise<AdminCaller | Failure> {
  let sdk: ReturnType<typeof adminSdk>;
  try {
    sdk = adminSdk();
  } catch (e: unknown) {
    // A malformed service account explains itself; don't bury it in a 500.
    const detail = e instanceof Error ? e.message : "unknown error";
    console.error(`[requireAdmin] service account unusable: ${detail}`);
    return fail(detail, 503);
  }

  if (!sdk) {
    return fail(
      "User management is not configured — set FIREBASE_SERVICE_ACCOUNT, or " +
        "FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY. " +
        "On Netlify these must be set in the UI (not netlify.toml) and scoped " +
        "to Functions. See SETUP.md.",
      503
    );
  }

  const token = bearerToken(request);
  if (!token) return fail("Not signed in.", 401);

  let uid: string;
  let email: string | null;
  try {
    // checkRevoked catches a disabled or deleted account still holding a token
    // that has not expired yet.
    const decoded = await sdk.auth.verifyIdToken(token, true);
    uid = decoded.uid;
    email = decoded.email ?? null;
  } catch (e: unknown) {
    return verifyFailure(e);
  }

  const doc = await sdk.db.collection(ADMINS).doc(uid).get();
  if (!doc.exists) {
    return fail(
      `This account (${uid}) is not an admin. Ask an existing admin to add it ` +
        `under Users.`,
      403
    );
  }

  return { uid, email };
}

/**
 * Not every verification failure is the caller's session.
 *
 * verifyIdToken also reaches out to the Auth backend when checking revocation,
 * so a bad service account or a network problem lands in the same catch as an
 * expired token. Reporting those as "sign in again" sends an operator chasing
 * their own session while the real fault is server-side, so they are separated
 * here and the server log keeps the detail either way.
 */
function verifyFailure(e: unknown): Failure {
  const code = (e as { code?: string })?.code ?? "";
  const detail = e instanceof Error ? e.message : String(e);
  console.error(`[requireAdmin] verifyIdToken failed (${code || "no code"}): ${detail}`);

  switch (code) {
    case "auth/id-token-expired":
      return fail("Your session expired — sign in again.", 401);
    case "auth/id-token-revoked":
      return fail("You were signed out elsewhere — sign in again.", 401);
    case "auth/user-disabled":
      return fail("This account has been disabled.", 403);
    case "auth/user-not-found":
      // The account behind a still-valid token was deleted in the console.
      return fail(
        "The account for this session no longer exists. Sign out and sign in " +
          "with a current account.",
        401
      );
    case "auth/argument-error":
      return fail("Your session looks corrupted — sign out and sign in again.", 401);
    case "app/invalid-credential":
      // The service account could not get an access token: wrong client email,
      // or a key that has been revoked or whose account was deleted. Report
      // which credential is actually in play — when one environment works and
      // another does not, that is the question worth answering first.
      return fail(
        "Firebase rejected the server's credentials, so your session could " +
          `not be checked. In use: ${describeCredential()}. Compare that with ` +
          "a working environment — a differing key fingerprint means this " +
          "environment has a stale or revoked key.",
        503
      );
    default:
      // Credential or connectivity problem: nothing the operator can fix by
      // signing in again. Name the code — without it the only way to tell these
      // apart is server log access, which the person hitting this may not have.
      return fail(
        `The server could not verify your session (${code || "no error code"}). ` +
          "This is a server-side credential problem, not your login. In use: " +
          `${describeCredential()}.`,
        500
      );
  }
}
