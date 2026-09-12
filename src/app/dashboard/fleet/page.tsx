"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useContentDraft } from "@/components/useContentDraft";
import { SaveBar } from "@/components/SaveBar";
import { ImagePicker } from "@/components/ImagePicker";
import { Card, Field, IconBtn, SectionHeader, TextInput } from "@/components/ui";
import type { Vehicle, VehicleImageSize } from "@/lib/content-schema";

const KEYS = ["fleet"] as const;

/** How tall the photo sits in the card. Sedans read better slightly smaller. */
const SIZES: { value: VehicleImageSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const newId = () => `vehicle-${Date.now().toString(36)}`;

export default function FleetPage() {
  const { draft, status, error, justSaved, update, isDirty, save, revert } =
    useContentDraft();

  if (!draft) return <p className="text-gray-500 text-sm">Loading…</p>;

  const keys = [...KEYS];
  const fleet = draft.fleet;

  const setFleet = (next: Vehicle[]) => update("fleet", next);

  const patch = (i: number, changes: Partial<Vehicle>) =>
    setFleet(fleet.map((v, idx) => (idx === i ? { ...v, ...changes } : v)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= fleet.length) return;
    const next = [...fleet];
    [next[i], next[j]] = [next[j], next[i]];
    setFleet(next);
  };

  const add = () =>
    setFleet([
      ...fleet,
      {
        id: newId(),
        src: "",
        name: "",
        type: "",
        capacity: "",
        tag: "",
        imgSize: "medium",
      },
    ]);

  return (
    <>
      <SectionHeader
        title="Fleet"
        blurb="The vehicle cards in the Fleet section. Photos with a transparent or black background sit best on the dark cards."
      />

      <div className="space-y-5">
        {fleet.map((v, i) => (
          <Card key={v.id}>
            <div className="grid sm:grid-cols-[240px_1fr] gap-6">
              <div>
                <ImagePicker
                  value={v.src}
                  folder="fleet"
                  aspect="4 / 3"
                  fit="contain"
                  onChange={(url) => patch(i, { src: url })}
                  label={v.src ? "Replace photo" : "Upload photo"}
                />

                <div className="mt-4">
                  <span className="block text-xs font-semibold text-gray-400 mb-2">
                    Photo size on card
                  </span>
                  <div className="flex gap-1.5">
                    {SIZES.map((s) => {
                      const active = v.imgSize === s.value;
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => patch(i, { imgSize: s.value })}
                          className="flex-1 text-xs font-semibold py-2 rounded-lg transition-colors"
                          style={{
                            background: active ? "#DC0000" : "#1d1d1d",
                            color: active ? "#ffffff" : "#9ca3af",
                            border: `1px solid ${
                              active ? "#DC0000" : "rgba(255,255,255,0.12)"
                            }`,
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
                    Vehicle {i + 1} of {fleet.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp size={15} />
                    </IconBtn>
                    <IconBtn
                      label="Move down"
                      disabled={i === fleet.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={15} />
                    </IconBtn>
                    <IconBtn
                      label="Remove vehicle"
                      danger
                      onClick={() => setFleet(fleet.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 size={15} />
                    </IconBtn>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Name">
                    <TextInput
                      value={v.name}
                      onChange={(e) => patch(i, { name: e.target.value })}
                      placeholder="Toyota Camry SE"
                    />
                  </Field>
                  <Field label="Class">
                    <TextInput
                      value={v.type}
                      onChange={(e) => patch(i, { type: e.target.value })}
                      placeholder="Executive Sedan"
                    />
                  </Field>
                  <Field label="Capacity">
                    <TextInput
                      value={v.capacity}
                      onChange={(e) => patch(i, { capacity: e.target.value })}
                      placeholder="Up to 3 passengers"
                    />
                  </Field>
                  <Field label="Badge" hint="The red pill in the corner of the card.">
                    <TextInput
                      value={v.tag}
                      onChange={(e) => patch(i, { tag: e.target.value })}
                      placeholder="Most Popular"
                    />
                  </Field>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {fleet.length === 0 ? (
          <Card>
            <p className="text-gray-400 text-sm text-center py-6">
              No vehicles yet. The site shows its original three while this list
              is empty.
            </p>
          </Card>
        ) : null}

        <button
          type="button"
          onClick={add}
          className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-300 py-4 rounded-2xl transition-colors hover:text-white"
          style={{ border: "1px dashed rgba(255,255,255,0.2)" }}
        >
          <Plus size={17} /> Add vehicle
        </button>

        <p className="text-gray-600 text-xs">
          The Fleet section lays out three cards per row. Adding a fourth wraps
          onto a second row.
        </p>
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
