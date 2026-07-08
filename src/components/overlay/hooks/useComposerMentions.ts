import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { MentionItem } from "../MentionPopup";
import {
  detectMention,
  applyMention,
  type MentionMatch,
} from "../mentionUtils";

interface Options {
  inputValue: string;
  setInputValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

function normalizeMentionText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeMentionDescription(value: unknown): string | undefined {
  const text = normalizeMentionText(value);
  if (!text) return undefined;
  if (/^>+$/.test(text)) return undefined;
  if (/^[-:]+$/.test(text)) return undefined;
  return text;
}

function formatMcpTransportLabel(value: unknown): string | undefined {
  const normalized = normalizeMentionText(value).toLowerCase();
  switch (normalized) {
    case "stdio":
      return "Runs locally";
    case "sse":
      return "Remote stream";
    case "http":
      return "Remote endpoint";
    default:
      return normalizeMentionDescription(value);
  }
}

/**
 * Owns the composer's "/" (skills) + "@" (mcps) autocomplete state.
 * Keeps `inputValue` in the parent (used widely) and only manages mentions.
 */
export function useComposerMentions({
  inputValue,
  setInputValue,
  inputRef,
}: Options) {
  const [skills, setSkills] = useState<MentionItem[]>([]);
  const [mcps, setMcps] = useState<MentionItem[]>([]);
  const [mention, setMention] = useState<MentionMatch | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const load = useCallback(() => {
    window.electronAPI
      ?.skillGetAll?.()
      .then((s: any[]) =>
        setSkills(
          (s || []).map((x) => ({
            id: x.id,
            name: normalizeMentionText(x.name),
            description: normalizeMentionDescription(x.description),
            enabled: x.enabled,
          })),
        ),
      )
      .catch(() => {});
    window.electronAPI
      ?.mcpGetAll?.()
      .then((m: any[]) =>
        setMcps(
          (m || []).map((x) => ({
            id: x.id,
            name: normalizeMentionText(x.name),
            description: formatMcpTransportLabel(x.transport),
            enabled: x.enabled,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const unsub = window.electronAPI?.onAbilitiesUpdated?.(() => load());
    return () => unsub?.();
  }, [load]);

  const mentionItems = useMemo<MentionItem[]>(() => {
    if (!mention) return [];
    const base = mention.trigger === "/" ? skills : mcps;
    const q = mention.query.toLowerCase();
    return base.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, skills, mcps]);

  const onComposerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      setInputValue(v);
      const caret = e.target.selectionStart ?? v.length;
      setMention(detectMention(v, caret));
      setMentionIndex(0);
    },
    [setInputValue],
  );

  const selectMention = useCallback(
    (item: MentionItem) => {
      if (!mention) return;
      const { text, caret } = applyMention(inputValue, mention, item.name);
      setInputValue(text);
      setMention(null);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(caret, caret);
          } catch {
            /* ignore */
          }
        }
      });
    },
    [mention, inputValue, setInputValue, inputRef],
  );

  return {
    mention,
    mentionItems,
    mentionIndex,
    setMention,
    setMentionIndex,
    onComposerChange,
    selectMention,
    reloadMentions: load,
  };
}
