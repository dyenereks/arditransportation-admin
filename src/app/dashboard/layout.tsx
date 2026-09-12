"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Images, LogOut, Phone, Truck, ExternalLink } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ConfigBanner } from "@/components/ConfigBanner";

const TABS = [
  { href: "/dashboard/contact", label: "Contact", icon: Phone },
  { href: "/dashboard/gallery", label: "Gallery", icon: Images },
  { href: "/dashboard/fleet", label: "Fleet", icon: Truck },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading…</p>
      </main>
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-30 backdrop-blur"
        style={{
          background: "rgba(10,10,10,0.9)",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC0000] flex-shrink-0" />
              <span className="font-black text-white truncate">Ardi Admin</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {siteUrl ? (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
                >
                  View site <ExternalLink size={14} />
                </a>
              ) : null}
              <span className="hidden md:block text-gray-500 text-xs truncate max-w-[180px]">
                {user.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
              >
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>

          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors"
                  style={{
                    color: active ? "#ffffff" : "#9ca3af",
                    borderBottom: active
                      ? "2px solid #DC0000"
                      : "2px solid transparent",
                  }}
                >
                  <Icon size={16} /> {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <ConfigBanner />
        {children}
      </main>
    </div>
  );
}
