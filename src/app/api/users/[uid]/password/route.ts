import { NextResponse } from "next/server";
import { ADMINS, adminSdk } from "@/lib/firebase-admin";
import { isFailure, requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";

const MIN_PASSWORD = 8;

/**
 * Set another admin's password.
 *
 * Changing your OWN password goes through the client SDK instead, which
 * re-authenticates with the current password first — a stronger check than
 * this one, and the right default for the account holder.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ uid: string }> }
) {
  const caller = await requireAdmin(request);
  if (isFailure(caller)) return caller.response;

  const { uid } = await ctx.params;

  let password: unknown;
  try {
    ({ password } = (await request.json()) as { password?: unknown });
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD} characters.` },
      { status: 400 }
    );
  }

  const sdk = adminSdk()!;

  // Scope this to admins, so it can't be used to seize an unrelated account in
  // the project — the service account itself imposes no such limit.
  const target = await sdk.db.collection(ADMINS).doc(uid).get();
  if (!target.exists) {
    return NextResponse.json(
      { error: "That account is not an admin." },
      { status: 404 }
    );
  }

  try {
    await sdk.auth.updateUser(uid, { password });
    // Force existing sessions to re-authenticate — the point of a reset is
    // usually that the old holder should lose access.
    await sdk.auth.revokeRefreshTokens(uid);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "auth/user-not-found") {
      return NextResponse.json({ error: "No such account." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Could not update the password." },
      { status: 500 }
    );
  }

  return NextResponse.json({ updated: uid });
}
