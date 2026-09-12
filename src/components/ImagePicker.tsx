"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2 } from "lucide-react";
import { uploadImage, validateImage } from "@/lib/content-store";

/**
 * Preview + upload control for a single image.
 *
 * Uploads land in Firebase Storage and the resulting download URL is handed
 * back through `onChange`; the value is only persisted when the page is saved.
 * Existing `/public` paths from the original site still render via `siteOrigin`.
 */
export function ImagePicker({
  value,
  folder,
  onChange,
  aspect = "16 / 9",
  fit = "cover",
  label = "Replace image",
}: {
  value: string;
  folder: "gallery" | "fleet";
  onChange: (url: string) => void;
  aspect?: string;
  fit?: "cover" | "contain";
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  // A bundled site asset ("/vehicles/x.png") has to be resolved against the
  // public site's origin to be viewable from the admin's own domain.
  const preview = value.startsWith("/") ? `${siteOrigin}${value}` : value;

  async function handleFile(file: File) {
    const invalid = validateImage(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setBusy(true);
    try {
      onChange(await uploadImage(folder, file));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-xl"
        style={{
          aspectRatio: aspect,
          background: "#0d0d0d",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {preview ? (
          // Storage URLs are signed and unpredictable, and previews are small —
          // a plain <img> avoids per-upload optimizer misses in the admin.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: fit }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs">
            No image
          </div>
        )}

        {busy ? (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.65)" }}
          >
            <Loader2 size={22} className="animate-spin text-white" />
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-200 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        style={{ background: "#1d1d1d", border: "1px solid rgba(255,255,255,0.12)" }}
      >
        <ImageUp size={16} /> {busy ? "Uploading…" : label}
      </button>

      {error ? (
        <p className="text-xs mt-2" style={{ color: "#ff6b6b" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
