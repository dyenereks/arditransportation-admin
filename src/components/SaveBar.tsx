"use client";

import { Check, RotateCcw, Save } from "lucide-react";

export function SaveBar({
  dirty,
  saving,
  justSaved,
  error,
  onSave,
  onRevert,
}: {
  dirty: boolean;
  saving: boolean;
  justSaved: boolean;
  error: string;
  onSave: () => void;
  onRevert: () => void;
}) {
  return (
    <div
      className="sticky bottom-0 mt-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 backdrop-blur"
      style={{
        background: "rgba(10,10,10,0.92)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm" role="status">
          {error ? (
            <span style={{ color: "#ff6b6b" }}>{error}</span>
          ) : saving ? (
            <span className="text-gray-400">Saving…</span>
          ) : justSaved && !dirty ? (
            <span className="inline-flex items-center gap-1.5 text-green-400">
              <Check size={15} /> Saved — the site will show this shortly.
            </span>
          ) : dirty ? (
            <span className="text-amber-400">Unsaved changes</span>
          ) : (
            <span className="text-gray-600">Up to date</span>
          )}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRevert}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-white px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:hover:text-gray-400"
          >
            <RotateCcw size={15} /> Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-2 bg-[#DC0000] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Save size={16} /> {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
