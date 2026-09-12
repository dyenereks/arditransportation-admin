"use client";

import { AlertTriangle } from "lucide-react";
import { FIREBASE_CONFIG_ERROR } from "@/lib/firebase";

/** Renders nothing once the environment is complete. */
export function ConfigBanner() {
  if (!FIREBASE_CONFIG_ERROR) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 mb-6 flex items-start gap-3"
      style={{
        background: "rgba(220,0,0,0.12)",
        border: "1px solid rgba(220,0,0,0.4)",
      }}
      role="alert"
    >
      <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color: "#ff6b6b" }} />
      <p className="text-sm leading-relaxed" style={{ color: "#ffb4b4" }}>
        {FIREBASE_CONFIG_ERROR}
      </p>
    </div>
  );
}
