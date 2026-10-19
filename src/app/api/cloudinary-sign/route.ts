import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isFailure, requireAdmin } from "@/lib/require-admin";

/**
 * Hands out a short-lived Cloudinary upload signature — but only to an admin.
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

  // Same allow-list that governs saving content: a document in `admins`.
  const caller = await requireAdmin(request);
  if (isFailure(caller)) return caller.response;

  let folder: unknown;
  try {
    ({ folder } = (await request.json()) as { folder?: unknown });
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!FOLDERS.includes(folder as Folder)) {
    return NextResponse.json({ error: "Unknown folder." }, { status: 400 });
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
