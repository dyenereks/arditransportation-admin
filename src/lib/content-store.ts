"use client";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { DEFAULT_CONTENT, mergeContent, type SiteContent } from "./content-schema";

export const CONTENT_DOC = { collection: "site", id: "content" } as const;

const contentRef = () => doc(db, CONTENT_DOC.collection, CONTENT_DOC.id);

/** Read the live document, falling back to shipped defaults on a first run. */
export async function loadContent(): Promise<SiteContent> {
  const snap = await getDoc(contentRef());
  if (!snap.exists()) return DEFAULT_CONTENT;
  return mergeContent(snap.data());
}

/**
 * Write back only the sections that were edited.
 *
 * Re-reads the document first and merges, so saving the Fleet tab can't clobber
 * a Gallery change made in another tab a moment earlier. Sections themselves are
 * replaced wholesale — arrays only make sense as a unit.
 */
export async function savePartial(patch: Partial<SiteContent>): Promise<void> {
  const current = await loadContent();
  const next: SiteContent = { ...current, ...patch };
  await setDoc(contentRef(), { ...next, updatedAt: serverTimestamp() });
  await pingRevalidate();
}

/**
 * Ask the public site to drop its cached copy so the edit shows up immediately
 * instead of at the next 60-second revalidation. Best-effort: a failure here
 * is not a failed save, so it never surfaces as an error to the operator.
 */
async function pingRevalidate(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SITE_REVALIDATE_URL;
  const secret = process.env.NEXT_PUBLIC_SITE_REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret }),
      mode: "cors",
    });
  } catch {
    // Site will pick the change up on its own within the revalidate window.
  }
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return "Use a JPEG, PNG, WebP, or AVIF image.";
  }
  if (file.size > MAX_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — keep it under 8 MB.`;
  }
  return null;
}

type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

/**
 * Upload to Cloudinary and return the delivered image URL.
 *
 * The file goes straight from the browser to Cloudinary — it never passes
 * through this app's server. Only the signature does, so the Cloudinary API
 * secret stays server-side (see /api/cloudinary-sign).
 */
export async function uploadImage(
  folder: "gallery" | "fleet",
  file: File
): Promise<string> {
  const invalid = validateImage(file);
  if (invalid) throw new Error(invalid);

  const user = auth.currentUser;
  if (!user) throw new Error("Your session expired — sign in again.");

  const signRes = await fetch("/api/cloudinary-sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: await user.getIdToken(), folder }),
  });

  if (!signRes.ok) {
    const body = (await signRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "Couldn't authorize the upload.");
  }

  const sig = (await signRes.json()) as UploadSignature;

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const upload = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
    { method: "POST", body: form }
  );

  if (!upload.ok) {
    const body = (await upload.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(body.error?.message ?? "Upload failed.");
  }

  const { secure_url: url } = (await upload.json()) as { secure_url?: string };
  if (!url) throw new Error("Cloudinary returned no image URL.");
  return url;
}
