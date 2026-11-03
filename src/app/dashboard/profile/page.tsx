"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Card, ErrorText, Field, SectionHeader, TextInput } from "@/components/ui";
import { changeOwnPassword, MIN_PASSWORD } from "@/lib/admin-api";

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <>
      <SectionHeader
        title="Profile"
        blurb="Your own account. Managing other people's accounts is under Users."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="text-white font-bold mb-5">Account</h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                Signed in as
              </dt>
              <dd className="text-white font-semibold text-sm">
                {user?.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500 text-xs uppercase tracking-wide mb-1">
                User ID
              </dt>
              <dd className="text-gray-400 font-mono text-xs break-all">
                {user?.uid ?? "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <ChangeOwnPassword />
      </div>
    </>
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
