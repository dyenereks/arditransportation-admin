"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard/contact" : "/login");
  }, [user, loading, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 text-sm">Loading…</p>
    </main>
  );
}
