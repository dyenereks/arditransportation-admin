"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { LogIn } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import { Card, Field, TextInput } from "@/components/ui";
import { ConfigBanner } from "@/components/ConfigBanner";

/** Firebase error codes mapped to something an operator can act on. */
function friendlyError(code: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "Can't reach Firebase — check your connection.";
    default:
      return "Sign-in failed. Please try again.";
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard/contact");
  }, [user, loading, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/dashboard/contact");
    } catch (err) {
      const code = (err as { code?: string }).code ?? "";
      setError(friendlyError(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-[#DC0000] text-xs font-bold uppercase tracking-widest mb-2">
            Ardi Transportation
          </p>
          <h1 className="text-3xl font-black text-white">Site Admin</h1>
          <p className="text-gray-400 text-sm mt-2">
            Sign in to update the public website.
          </p>
        </div>

        <ConfigBanner />

        <Card>
          <form onSubmit={onSubmit} className="space-y-5">
            <Field label="Email">
              <TextInput
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="Password">
              <TextInput
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error ? (
              <p
                className="text-sm rounded-xl px-4 py-3"
                style={{ background: "rgba(220,0,0,0.12)", color: "#ff6b6b" }}
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#DC0000] text-white font-bold py-3 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <LogIn size={18} />
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </Card>

        <p className="text-gray-600 text-xs text-center mt-6">
          Accounts are created in the Firebase console — there is no public sign-up.
        </p>
      </div>
    </main>
  );
}
