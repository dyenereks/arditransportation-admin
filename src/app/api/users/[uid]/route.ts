import { NextResponse } from "next/server";
import { ADMINS, adminSdk } from "@/lib/firebase-admin";
import { isFailure, requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";

/** Remove an admin: revoke access, then delete the account itself. */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ uid: string }> }
) {
  const caller = await requireAdmin(request);
  if (isFailure(caller)) return caller.response;

  const { uid } = await ctx.params;

  if (uid === caller.uid) {
    return NextResponse.json(
      { error: "You can't remove your own account while signed in as it." },
      { status: 400 }
    );
  }

  const sdk = adminSdk()!;

  // Only accounts that appear in `admins` are in scope. Without this, an admin
  // could pass any UID in the project and delete that person's account — the
  // service account has no such limits of its own.
  const target = await sdk.db.collection(ADMINS).doc(uid).get();
  if (!target.exists) {
    return NextResponse.json(
      { error: "That account is not an admin." },
      { status: 404 }
    );
  }

  // Never let the last admin be removed — that would lock everyone out with no
  // way back in short of running a script against the service account.
  const remaining = await sdk.db.collection(ADMINS).count().get();
  if (remaining.data().count <= 1) {
    return NextResponse.json(
      { error: "This is the only admin — add another before removing it." },
      { status: 400 }
    );
  }

  await sdk.db.collection(ADMINS).doc(uid).delete();

  try {
    await sdk.auth.deleteUser(uid);
  } catch (e: unknown) {
    // Access is already revoked at this point; a missing auth account just
    // means we cleaned up an orphaned admin document.
    if ((e as { code?: string }).code !== "auth/user-not-found") {
      return NextResponse.json(
        { error: "Access was revoked, but the account could not be deleted." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ removed: uid });
}
