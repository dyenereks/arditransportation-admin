"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { KeyRound, Loader2, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Card, Field, SectionHeader, TextInput } from "@/components/ui";
import {
  changeOwnPassword,
  createUser,
  deleteUser,
  listUsers,
  setUserPassword,
  MIN_PASSWORD,
  type AdminUser,
} from "@/lib/admin-api";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load users.");
      setUsers([]);
    }
  }, []);

  // The initial load is written out rather than calling refresh(), so state
  // only ever settles after the request resolves — and so a unmount mid-flight
  // doesn't set state on a gone component.
  useEffect(() => {
    let alive = true;
    listUsers()
      .then((list) => {
        if (alive) setUsers(list);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoadError(e instanceof Error ? e.message : "Couldn't load users.");
        setUsers([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <SectionHeader
        title="Users"
        blurb="Everyone who can sign in and edit the site. Access is granted per account — adding someone here is all that's needed, with no config to redeploy."
      />

      <div className="space-y-6">
        <AddUser onAdded={refresh} />

        <Card>
          <h2 className="text-white font-bold mb-5">
            Admins{users ? ` (${users.length})` : ""}
          </h2>

          {loadError ? (
            <ErrorText>{loadError}</ErrorText>
          ) : users === null ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-gray-400 text-sm">No admins found.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              {users.map((u) => (
                <UserRow
                  key={u.uid}
                  user={u}
                  isSelf={u.uid === user?.uid}
                  onChanged={refresh}
                />
              ))}
            </ul>
          )}
        </Card>

        <ChangeOwnPassword />
      </div>
    </>
  );
}

function AddUser({ onAdded }: { onAdded: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    setBusy(true);
    try {
      await createUser(email.trim(), password);
      setDone(`${email.trim()} can now sign in. Share the password securely — they can change it under Users.`);
      setEmail("");
      setPassword("");
      await onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the user.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-white font-bold mb-5">Add an admin</h2>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Email">
            <TextInput
              type="email"
              required
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </Field>
          <Field
            label="Temporary password"
            hint={`At least ${MIN_PASSWORD} characters. They can change it after signing in.`}
          >
            <TextInput
              type="text"
              required
              minLength={MIN_PASSWORD}
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
        </div>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {done ? (
          <p className="text-sm text-green-400" role="status">
            {done}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 bg-[#DC0000] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
          {busy ? "Adding…" : "Add admin"}
        </button>
      </form>
    </Card>
  );
}

function UserRow({
  user,
  isSelf,
  onChanged,
}: {
  user: AdminUser;
  isSelf: boolean;
  onChanged: () => Promise<void>;
}) {
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function remove() {
    if (
      !confirm(
        `Remove ${user.email ?? user.uid}? Their account is deleted and they lose access immediately.`
      )
    ) {
      return;
    }
    setError("");
    setBusy(true);
    try {
      await deleteUser(user.uid);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the user.");
      setBusy(false);
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    setBusy(true);
    try {
      await setUserPassword(user.uid, newPassword);
      setDone("Password updated. They have been signed out everywhere.");
      setNewPassword("");
      setResetting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">
            {user.email ?? "(account deleted)"}
            {isSelf ? <span className="text-gray-500 font-normal"> — you</span> : null}
          </p>
          <p className="text-gray-600 text-xs mt-1 font-mono truncate">{user.uid}</p>
          <p className="text-gray-500 text-xs mt-1">
            {user.lastSignInAt
              ? `Last signed in ${new Date(user.lastSignInAt).toLocaleDateString()}`
              : "Never signed in"}
            {user.addedBy ? ` · added by ${user.addedBy}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isSelf ? (
            <>
              <button
                type="button"
                onClick={() => setResetting((r) => !r)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-300 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: "#1d1d1d", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <KeyRound size={14} /> Reset password
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                aria-label={`Remove ${user.email ?? user.uid}`}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40"
                style={{
                  background: "#1d1d1d",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#ff6b6b",
                }}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </>
          ) : (
            <span className="text-gray-600 text-xs">
              Change your own password below
            </span>
          )}
        </div>
      </div>

      {resetting ? (
        <form onSubmit={reset} className="mt-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <Field label="New password">
              <TextInput
                type="text"
                required
                minLength={MIN_PASSWORD}
                autoComplete="off"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD} characters`}
              />
            </Field>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="bg-[#DC0000] text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Set password"}
          </button>
        </form>
      ) : null}

      {error ? <div className="mt-3"><ErrorText>{error}</ErrorText></div> : null}
      {done ? (
        <p className="text-sm text-green-400 mt-3" role="status">
          {done}
        </p>
      ) : null}
    </li>
  );
}

function ChangeOwnPassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);

    if (next !== confirmValue) {
      setError("The new passwords don't match.");
      return;
    }
    if (next.length < MIN_PASSWORD) {
      setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }

    setBusy(true);
    try {
      await changeOwnPassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirmValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="text-white font-bold mb-5">Change my password</h2>
      <form onSubmit={submit} className="space-y-5">
        <Field label="Current password">
          <TextInput
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
            <TextInput
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <TextInput
              type="password"
              required
              autoComplete="new-password"
              value={confirmValue}
              onChange={(e) => setConfirmValue(e.target.value)}
            />
          </Field>
        </div>

        {error ? <ErrorText>{error}</ErrorText> : null}
        {done ? (
          <p className="text-sm text-green-400" role="status">
            Password updated.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 bg-[#DC0000] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </Card>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-sm rounded-xl px-4 py-3"
      style={{ background: "rgba(220,0,0,0.12)", color: "#ff6b6b" }}
      role="alert"
    >
      {children}
    </p>
  );
}
