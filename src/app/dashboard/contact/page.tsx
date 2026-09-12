"use client";

import { useContentDraft } from "@/components/useContentDraft";
import { SaveBar } from "@/components/SaveBar";
import { Card, Field, SectionHeader, TextInput } from "@/components/ui";

const KEYS = ["contact", "address", "social"] as const;

export default function ContactPage() {
  const { draft, status, error, justSaved, update, isDirty, save, revert } =
    useContentDraft();

  if (!draft) {
    return <p className="text-gray-500 text-sm">Loading…</p>;
  }

  const keys = [...KEYS];
  const { contact, address, social } = draft;

  return (
    <>
      <SectionHeader
        title="Contact & Location"
        blurb="Phone number, office address, and Facebook page. These appear in the hero, the contact section, the CTA banner, and the footer."
      />

      <div className="space-y-6">
        <Card>
          <h2 className="text-white font-bold mb-5">Phone & hours</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Phone (as displayed)" hint="Shown on the page exactly as typed.">
              <TextInput
                value={contact.phoneDisplay}
                onChange={(e) =>
                  update("contact", { ...contact, phoneDisplay: e.target.value })
                }
                placeholder="(858) 288-1777"
              />
            </Field>

            <Field
              label="Phone (dial number)"
              hint="Digits only — this is what the Call buttons dial."
            >
              <TextInput
                inputMode="tel"
                value={contact.phoneHref}
                onChange={(e) =>
                  update("contact", {
                    ...contact,
                    phoneHref: e.target.value.replace(/[^\d+]/g, ""),
                  })
                }
                placeholder="8582881777"
              />
            </Field>

            <Field label="Hours">
              <TextInput
                value={contact.hours}
                onChange={(e) => update("contact", { ...contact, hours: e.target.value })}
                placeholder="24 / 7 — Always Available"
              />
            </Field>

            <Field label="Email" hint="Optional. Leave blank to hide it.">
              <TextInput
                type="email"
                value={contact.email}
                onChange={(e) => update("contact", { ...contact, email: e.target.value })}
                placeholder="bookings@example.com"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-white font-bold mb-5">Office address</h2>
          <div className="space-y-5">
            <Field label="Building / suite" hint="Optional first line. Leave blank to hide it.">
              <TextInput
                value={address.name}
                onChange={(e) => update("address", { ...address, name: e.target.value })}
                placeholder="Carolino Business Center"
              />
            </Field>
            <Field label="Street">
              <TextInput
                value={address.street}
                onChange={(e) => update("address", { ...address, street: e.target.value })}
                placeholder="3035 E 8th Street"
              />
            </Field>
            <Field label="City, state, ZIP" hint="Also used in the footer copyright line.">
              <TextInput
                value={address.cityStateZip}
                onChange={(e) =>
                  update("address", { ...address, cityStateZip: e.target.value })
                }
                placeholder="National City, CA 91950"
              />
            </Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-white font-bold mb-5">Facebook</h2>
          <div className="space-y-5">
            <Field label="Page URL" hint="Where the “Message Us on Facebook” button goes.">
              <TextInput
                type="url"
                value={social.facebookUrl}
                onChange={(e) =>
                  update("social", { ...social, facebookUrl: e.target.value })
                }
                placeholder="https://www.facebook.com/arditransportation"
              />
            </Field>
            <Field label="Handle" hint="Shown as “@handle” beneath the button. No @ needed.">
              <TextInput
                value={social.facebookHandle}
                onChange={(e) =>
                  update("social", {
                    ...social,
                    facebookHandle: e.target.value.replace(/^@/, ""),
                  })
                }
                placeholder="arditransportation"
              />
            </Field>
          </div>
        </Card>
      </div>

      <SaveBar
        dirty={isDirty(keys)}
        saving={status === "saving"}
        justSaved={justSaved}
        error={error}
        onSave={() => void save(keys)}
        onRevert={revert}
      />
    </>
  );
}
