"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useContentDraft } from "@/components/useContentDraft";
import { SaveBar } from "@/components/SaveBar";
import { ImagePicker } from "@/components/ImagePicker";
import { Card, Field, IconBtn, SectionHeader, TextArea } from "@/components/ui";
import type { GalleryPhoto } from "@/lib/content-schema";

const KEYS = ["gallery"] as const;

const newId = () => `photo-${Date.now().toString(36)}`;

export default function GalleryPage() {
  const { draft, status, error, justSaved, update, isDirty, save, revert } =
    useContentDraft();

  if (!draft) return <p className="text-gray-500 text-sm">Loading…</p>;

  const keys = [...KEYS];
  const photos = draft.gallery;

  const setPhotos = (next: GalleryPhoto[]) => update("gallery", next);

  const patch = (i: number, changes: Partial<GalleryPhoto>) =>
    setPhotos(photos.map((p, idx) => (idx === i ? { ...p, ...changes } : p)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    setPhotos(next);
  };

  const remove = (i: number) => {
    // The Storage file is intentionally left in place — the same URL may still
    // be referenced by the version of the doc the live site is serving.
    setPhotos(photos.filter((_, idx) => idx !== i));
  };

  const add = () =>
    setPhotos([...photos, { id: newId(), src: "", caption: "" }]);

  return (
    <>
      <SectionHeader
        title="Happy Clients Gallery"
        blurb="The photo carousel in the “Why Choose Us” section. Order here is the order riders see."
      />

      <div className="space-y-5">
        {photos.map((photo, i) => (
          <Card key={photo.id}>
            <div className="grid sm:grid-cols-[220px_1fr] gap-6">
              <ImagePicker
                value={photo.src}
                folder="gallery"
                aspect="16 / 9"
                fit="cover"
                onChange={(url) => patch(i, { src: url })}
                label={photo.src ? "Replace photo" : "Upload photo"}
              />

              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-500 text-xs font-bold uppercase tracking-wider">
                    Slide {i + 1} of {photos.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <IconBtn
                      label="Move up"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      <ArrowUp size={15} />
                    </IconBtn>
                    <IconBtn
                      label="Move down"
                      disabled={i === photos.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown size={15} />
                    </IconBtn>
                    <IconBtn label="Remove photo" danger onClick={() => remove(i)}>
                      <Trash2 size={15} />
                    </IconBtn>
                  </div>
                </div>

                <Field
                  label="Caption"
                  hint="Shown over the bottom of the photo, and used as the alt text."
                >
                  <TextArea
                    rows={3}
                    value={photo.caption}
                    onChange={(e) => patch(i, { caption: e.target.value })}
                    placeholder="Family pickup — Heading to LAX from San Diego"
                  />
                </Field>
              </div>
            </div>
          </Card>
        ))}

        {photos.length === 0 ? (
          <Card>
            <p className="text-gray-400 text-sm text-center py-6">
              No photos yet. Add one below — the site falls back to its original
              nine photos while this list is empty.
            </p>
          </Card>
        ) : null}

        <button
          type="button"
          onClick={add}
          className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-gray-300 py-4 rounded-2xl transition-colors hover:text-white"
          style={{ border: "1px dashed rgba(255,255,255,0.2)" }}
        >
          <Plus size={17} /> Add photo
        </button>
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
