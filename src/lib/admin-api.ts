"use client";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth } from "./firebase";

/** Shape returned by GET /api/users. */
export type AdminUser = {
  uid: string;
  email: string | null;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  addedBy: string | null;
};

export const MIN_PASSWORD = 8;

/** Every protected route authenticates with the caller's Firebase ID token. */
async function authedFetch(path: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Your session expired — sign in again.");

  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "content-type": "application/json",
      authorization: `Bearer ${await user.getIdToken()}`,
    },
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
  } & Record<string, unknown>;

  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body;
}

export async function listUsers(): Promise<AdminUser[]> {
  const body = await authedFetch("/api/users");
  return (body.users ?? []) as AdminUser[];
}

export async function createUser(email: string, password: string) {
  await authedFetch("/api/users", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function deleteUser(uid: string) {
  await authedFetch(`/api/users/${encodeURIComponent(uid)}`, {
    method: "DELETE",
  });
}

export async function setUserPassword(uid: string, password: string) {
  await authedFetch(`/api/users/${encodeURIComponent(uid)}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

/**
 * Change the signed-in user's own password.
 *
 * Done client-side on purpose: Firebase requires a recent login to change a
 * password, so proving knowledge of the current one is part of the flow. That
 * is a stronger check than an admin reset, and the right one for the account
 * holder.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Your session expired — sign in again.");

  try {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, currentPassword)
    );
  } catch (e: unknown) {
    const code = (e as { code?: string }).code ?? "";
    if (
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential"
    ) {
      throw new Error("Your current password is incorrect.");
    }
    if (code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Wait a minute and try again.");
    }
    throw new Error("Could not verify your current password.");
  }

  try {
    await updatePassword(user, newPassword);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code ?? "";
    if (code === "auth/weak-password") {
      throw new Error(`Choose a password of at least ${MIN_PASSWORD} characters.`);
    }
    throw new Error("Could not update your password.");
  }
}
