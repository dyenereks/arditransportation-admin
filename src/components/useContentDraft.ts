"use client";

import { useCallback, useEffect, useState } from "react";
import { loadContent, savePartial } from "@/lib/content-store";
import type { SiteContent } from "@/lib/content-schema";

type Status = "loading" | "ready" | "saving";

const pick = (c: SiteContent, keys: (keyof SiteContent)[]) =>
  JSON.stringify(keys.map((k) => c[k]));

/**
 * Loads the live document once, then hands back a local draft.
 *
 * Each dashboard tab edits its own slice of the draft and saves just those
 * keys, so the tabs never overwrite each other's sections.
 */
export function useContentDraft() {
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [saved, setSaved] = useState<SiteContent | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    loadContent()
      .then((c) => {
        if (!alive) return;
        setDraft(c);
        setSaved(c);
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(
          e instanceof Error
            ? `Couldn't load content: ${e.message}`
            : "Couldn't load content."
        );
        setStatus("ready");
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Apply a change to one top-level section of the draft. */
  const update = useCallback(
    <K extends keyof SiteContent>(key: K, value: SiteContent[K]) => {
      setDraft((d) => (d ? { ...d, [key]: value } : d));
      setJustSaved(false);
    },
    []
  );

  const isDirty = useCallback(
    (keys: (keyof SiteContent)[]) =>
      !!draft && !!saved && pick(draft, keys) !== pick(saved, keys),
    [draft, saved]
  );

  const save = useCallback(
    async (keys: (keyof SiteContent)[]) => {
      if (!draft) return;
      setStatus("saving");
      setError("");
      try {
        const patch = Object.fromEntries(
          keys.map((k) => [k, draft[k]])
        ) as Partial<SiteContent>;
        await savePartial(patch);
        setSaved(draft);
        setJustSaved(true);
      } catch (e: unknown) {
        setError(
          e instanceof Error ? `Save failed: ${e.message}` : "Save failed."
        );
      } finally {
        setStatus("ready");
      }
    },
    [draft]
  );

  const revert = useCallback(() => {
    setDraft(saved);
    setJustSaved(false);
    setError("");
  }, [saved]);

  return { draft, status, error, setError, justSaved, update, isDirty, save, revert };
}
