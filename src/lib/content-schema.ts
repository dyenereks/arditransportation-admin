/**
 * The single source of truth for editable site content.
 *
 * This file is intentionally duplicated in the public site
 * (arditransportation/src/lib/content-schema.ts). Keep the two in sync —
 * the admin writes this shape to Firestore, the site reads it back.
 *
 * Firestore location: collection "site", document "content".
 */

import defaults from "./default-content.json";

export type GalleryPhoto = {
  id: string;
  src: string;
  caption: string;
};

export type Vehicle = {
  id: string;
  src: string;
  name: string;
  type: string;
  capacity: string;
  tag: string;
  /** How tall the photo sits in its card. Resolved to a pixel height by the site. */
  imgSize: VehicleImageSize;
};

export const VEHICLE_IMAGE_SIZES = ["small", "medium", "large"] as const;
export type VehicleImageSize = (typeof VEHICLE_IMAGE_SIZES)[number];

export type SiteContent = {
  contact: {
    /** Human-readable, e.g. "(858) 288-1777" */
    phoneDisplay: string;
    /** Digits only for tel: links, e.g. "8582881777" */
    phoneHref: string;
    hours: string;
    email: string;
  };
  address: {
    /** Building / business center name — optional line 1 */
    name: string;
    street: string;
    cityStateZip: string;
  };
  social: {
    facebookUrl: string;
    /** Shown as "@handle" under the Facebook button */
    facebookHandle: string;
  };
  gallery: GalleryPhoto[];
  fleet: Vehicle[];
};

/**
 * Fallback content — matches what the site shipped with before the CMS existed.
 * The site renders these whenever Firestore is unreachable or a field is blank,
 * so a bad deploy or a dropped network never blanks out the page.
 *
 * Kept as JSON so the seed script can load the same values without a build step.
 */
export const DEFAULT_CONTENT: SiteContent = defaults as SiteContent;

/**
 * Merge a partial Firestore document over the defaults.
 *
 * Missing keys and empty strings fall back, so an operator who clears a field
 * by accident gets the original copy back rather than an empty page. Arrays are
 * taken wholesale when present and non-empty (an empty gallery is more likely a
 * mistake than an intent), with each item's fields defaulted individually.
 */
export function mergeContent(raw: unknown): SiteContent {
  const d = DEFAULT_CONTENT;
  if (!raw || typeof raw !== "object") return d;
  const c = raw as Partial<SiteContent>;

  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : fallback;

  /** Fields an operator may legitimately want blank (a suite line, an email). */
  const strOpt = (v: unknown, fallback: string) =>
    typeof v === "string" ? v.trim() : fallback;

  const arr = <T,>(v: unknown, fallback: T[], map: (item: Record<string, unknown>, i: number) => T): T[] => {
    if (!Array.isArray(v) || v.length === 0) return fallback;
    return v
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      .map(map);
  };

  const gallery = arr(c.gallery, d.gallery, (p, i) => ({
    id: str(p.id, `photo-${i + 1}`),
    src: str(p.src, ""),
    caption: str(p.caption, ""),
  })).filter((p) => p.src !== "");

  const fleet = arr(c.fleet, d.fleet, (v, i) => ({
    id: str(v.id, `vehicle-${i + 1}`),
    src: str(v.src, ""),
    name: str(v.name, ""),
    type: str(v.type, ""),
    capacity: str(v.capacity, ""),
    tag: str(v.tag, ""),
    imgSize: (VEHICLE_IMAGE_SIZES as readonly string[]).includes(
      String(v.imgSize)
    )
      ? (v.imgSize as VehicleImageSize)
      : "medium",
  })).filter((v) => v.src !== "" && v.name !== "");

  return {
    contact: {
      phoneDisplay: str(c.contact?.phoneDisplay, d.contact.phoneDisplay),
      phoneHref: str(c.contact?.phoneHref, d.contact.phoneHref),
      hours: str(c.contact?.hours, d.contact.hours),
      email: strOpt(c.contact?.email, d.contact.email),
    },
    address: {
      name: strOpt(c.address?.name, d.address.name),
      street: str(c.address?.street, d.address.street),
      cityStateZip: str(c.address?.cityStateZip, d.address.cityStateZip),
    },
    social: {
      facebookUrl: str(c.social?.facebookUrl, d.social.facebookUrl),
      facebookHandle: str(c.social?.facebookHandle, d.social.facebookHandle),
    },
    gallery: gallery.length ? gallery : d.gallery,
    fleet: fleet.length ? fleet : d.fleet,
  };
}
