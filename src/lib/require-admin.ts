import "server-only";

import { NextResponse } from "next/server";
import { ADMINS, adminSdk } from "./firebase-admin";

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
  const sdk = adminSdk();
  if (!sdk) {
    return fail(
      "User management is not configured — set FIREBASE_SERVICE_ACCOUNT. " +
        "See SETUP.md.",
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
  } catch {
    return fail("Your session is no longer valid — sign in again.", 401);
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
