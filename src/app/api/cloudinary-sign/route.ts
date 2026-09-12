import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Hands out a short-lived Cloudinary upload signature — but only to someone
 * holding a valid Firebase session for this project.
 *
 * The alternative, an unsigned upload preset, would sit in the public JS bundle
 * and let anyone on the internet upload to the account. Here the API secret
 * never leaves the server, and every signature is tied to one folder and one
 * timestamp.
 */

export const runtime = "nodejs";

/** Folders an upload is allowed to target, as named by the client. */
const FOLDERS = ["gallery", "fleet"] as const;
type Folder = (typeof FOLDERS)[number];

/**
 * Everything this site uploads lives under one Cloudinary folder, so the
 * account stays tidy if it ever hosts a second project.
 *
 * The client sends only "gallery" or "fleet"; the full path is built here, so a
 * caller can't reach outside this root.
 */
const ROOT_FOLDER = process.env.CLOUDINARY_ROOT_FOLDER || "arditransportation";

const fullFolder = (folder: Folder) => `${ROOT_FOLDER}/${folder}`;

/**
 * Confirm the ID token is real and belongs to our Firebase project.
 *
 * Uses Firebase's own REST endpoint rather than firebase-admin: it needs no
 * service-account key, and a forged or expired token simply fails here.
 * Returns the caller's UID, or null.
 */
async function verifyIdToken(idToken: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error("[cloudinary-sign] NEXT_PUBLIC_FIREBASE_API_KEY is not set");
    return null;
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    // Surfaced in the server log so a misconfigured key or a restricted API
    // doesn't look the same as a plain expired session.
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    console.error(
      `[cloudinary-sign] token lookup failed (${res.status}): ` +
        `${body.error?.message ?? "no detail"}`
    );
    return null;
  }

  const body = (await res.json()) as { users?: { localId?: string }[] };
  return body.users?.[0]?.localId ?? null;
}

/**
 * Optional second gate. With no ADMIN_UIDS set, any account in the Firebase
 * project may upload — which is fine, because accounts are created by hand and
 * there is no public sign-up.
 */
function allowList(): string[] {
  return (process.env.ADMIN_UIDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(request: Request) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      {
        error:
          "Cloudinary is not configured — set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, " +
          "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. See SETUP.md.",
      },
      { status: 503 }
    );
  }

  let idToken: unknown;
  let folder: unknown;
  try {
    ({ idToken, folder } = (await request.json()) as {
      idToken?: unknown;
      folder?: unknown;
    });
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!FOLDERS.includes(folder as Folder)) {
    return NextResponse.json({ error: "Unknown folder." }, { status: 400 });
  }

  if (typeof idToken !== "string" || idToken === "") {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const uid = await verifyIdToken(idToken);
  if (!uid) {
    return NextResponse.json(
      {
        error:
          "Couldn't verify your session. Sign out and back in; if it keeps " +
          "happening, check the server log for the reason.",
      },
      { status: 401 }
    );
  }

  const allowed = allowList();
  if (allowed.length > 0 && !allowed.includes(uid)) {
    // The caller has already proven they hold a valid session for this project,
    // so naming their own UID leaks nothing and saves a console trip.
    console.error(
      `[cloudinary-sign] uid ${uid} is not in ADMIN_UIDS (${allowed.length} entr` +
        `${allowed.length === 1 ? "y" : "ies"} configured)`
    );
    return NextResponse.json(
      {
        error:
          `This account (${uid}) is not in ADMIN_UIDS. Add it to .env.local, ` +
          `or clear ADMIN_UIDS to allow any account in the Firebase project, ` +
          `then restart the server.`,
      },
      { status: 403 }
    );
  }

  // Cloudinary signs the sha1 of every upload param except file, api_key and
  // resource_type, sorted by key, with the API secret appended. The signed
  // folder must be the exact string sent with the upload.
  const target = fullFolder(folder as Folder);
  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${target}&timestamp=${timestamp}`;
  const signature = createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");

  return NextResponse.json({
    cloudName,
    apiKey,
    timestamp,
    folder: target,
    signature,
  });
}
