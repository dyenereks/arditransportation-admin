import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { ADMINS, adminSdk } from "@/lib/firebase-admin";
import { isFailure, requireAdmin } from "@/lib/require-admin";

export const runtime = "nodejs";

export type AdminUser = {
  uid: string;
  email: string | null;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  addedBy: string | null;
};

const MIN_PASSWORD = 8;

/** List every account holding an admin document. */
export async function GET(request: Request) {
  const caller = await requireAdmin(request);
  if (isFailure(caller)) return caller.response;

  const sdk = adminSdk()!;
  const docs = await sdk.db.collection(ADMINS).get();
  if (docs.empty) return NextResponse.json({ users: [] });

  // getUsers takes at most 100 identifiers; an admin list will never approach
  // that, but chunking keeps it honest if it somehow does.
  const ids = docs.docs.map((d) => ({ uid: d.id }));
  const found = new Map<string, AdminUser>();

  for (let i = 0; i < ids.length; i += 100) {
    const { users } = await sdk.auth.getUsers(ids.slice(i, i + 100));
    for (const u of users) {
      found.set(u.uid, {
        uid: u.uid,
        email: u.email ?? null,
        disabled: u.disabled,
        createdAt: u.metadata.creationTime ?? null,
        lastSignInAt: u.metadata.lastSignInTime ?? null,
        addedBy: (docs.docs.find((d) => d.id === u.uid)?.data().addedBy ??
          null) as string | null,
      });
    }
  }

  // An admin document whose auth account was deleted elsewhere would otherwise
  // be invisible; surface it so it can be cleaned up.
  const orphans: AdminUser[] = docs.docs
    .filter((d) => !found.has(d.id))
    .map((d) => ({
      uid: d.id,
      email: null,
      disabled: false,
      createdAt: null,
      lastSignInAt: null,
      addedBy: (d.data().addedBy ?? null) as string | null,
    }));

  const users = [...found.values(), ...orphans].sort((a, b) =>
    (a.email ?? "").localeCompare(b.email ?? "")
  );

  return NextResponse.json({ users });
}

/** Create an account and grant it admin access in one step. */
export async function POST(request: Request) {
  const caller = await requireAdmin(request);
  if (isFailure(caller)) return caller.response;

  let email: unknown;
  let password: unknown;
  try {
    ({ email, password } = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    });
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD} characters.` },
      { status: 400 }
    );
  }

  const sdk = adminSdk()!;

  let uid: string;
  try {
    const created = await sdk.auth.createUser({
      email: email.trim(),
      password,
      emailVerified: false,
    });
    uid = created.uid;
  } catch (e: unknown) {
    const code = (e as { code?: string }).code ?? "";
    if (code === "auth/email-already-exists") {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 409 }
      );
    }
    if (code === "auth/invalid-password") {
      return NextResponse.json(
        { error: "Firebase rejected that password — try a longer one." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Could not create the account." },
      { status: 500 }
    );
  }

  // Grant happens after creation, so a failure here leaves an account that
  // simply has no access rather than access with no account.
  await sdk.db.collection(ADMINS).doc(uid).set({
    email: email.trim(),
    addedBy: caller.email ?? caller.uid,
    addedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ uid, email: email.trim() }, { status: 201 });
}
