import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Sparkles,
  FileText,
  Mic,
  Clock3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ZedKeyBinding } from "./zed/ZedKeyBinding";
import { ZedListItem } from "./zed/ZedListItem";
import { isMac } from "../utils/platformUtils";

interface Meeting {
  id: string;
  title: string;
  date: string;
  summary?: string;
}

interface SearchResult {
  id: string;
  type: "meeting" | "note";
  title: string;
  subtitle?: string;
  refId: string;
}

interface NoteHit {
  id: string;
  title: string;
  contentText: string;
}

interface TopSearchPillProps {
  meetings: Meeting[];
  onAIQuery: (query: string) => void;
  onLiteralSearch: (query: string) => void;
  onOpenMeeting: (meetingId: string) => void;
  onOpenNote?: (noteId: string) => void;
  onExpansionChange?: (isExpanded: boolean) => void;
}

function fuzzyMatch(text: string, query: string): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  return normalizedText.includes(normalizedQuery);
}

function searchMeetings(
  meetings: Meeting[],
  query: string,
  dateLocale: string,
): SearchResult[] {
  if (!query.trim()) return [];

  const results: SearchResult[] = [];
  const seen = new Set<string>();

  for (const meeting of meetings) {
    if (seen.has(meeting.id)) continue;

    const titleMatch = fuzzyMatch(meeting.title, query);
    const summaryMatch = meeting.summary && fuzzyMatch(meeting.summary, query);

    if (titleMatch || summaryMatch) {
      seen.add(meeting.id);
      results.push({
        id: `meeting:${meeting.id}`,
        type: "meeting",
        title: meeting.title,
        subtitle: new Date(meeting.date).toLocaleDateString(dateLocale, {
          month: "short",
          day: "numeric",
        }),
        refId: meeting.id,
      });
    }

    if (results.length >= 5) break;
  }

  return results;
}

function SectionLabel({
  children,
  meta,
}: {
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-1 flex items-center gap-2 px-2 pt-1">
      <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        {children}
      </span>
      <div className="h-px flex-1 bg-border-subtle/80" />
      {meta ? (
        <span className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

const TopSearchPill: React.FC<TopSearchPillProps> = ({
  meetings,
  onAIQuery,
  onLiteralSearch,
  onOpenMeeting,
  onOpenNote,
  onExpansionChange,
}) => {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith("pt") ? "pt-BR" : "en-US";
  const shortcutKeys = isMac ? ["Cmd", "K"] : ["Ctrl", "K"];
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [noteHits, setNoteHits] = useState<NoteHit[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onExpansionChange?.(isOpen);
  }, [isOpen, onExpansionChange]);

  useEffect(() => {
    if (
      !isOpen ||
      !query.trim() ||
      !window.electronAPI?.notesSearch
    ) {
      setNoteHits([]);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(() => {
      window.electronAPI
        .notesSearch(query)
        .then((hits) => {
          if (!cancelled) {
            setNoteHits(Array.isArray(hits) ? hits.slice(0, 5) : []);
          }
        })
        .catch(() => {
          if (!cancelled) setNoteHits([]);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [isOpen, query]);

  const noteResults = useMemo<SearchResult[]>(
    () =>
      query.trim()
        ? noteHits.map((note) => ({
            id: `note:${note.id}`,
            type: "note",
            title: note.title || t("workspace.untitled"),
            refId: note.id,
          }))
        : [],
    [noteHits, query, t],
  );

  const meetingResults = useMemo<SearchResult[]>(
    () =>
      query.trim() ? searchMeetings(meetings, query, dateLocale) : [],
    [dateLocale, meetings, query],
  );

  const recentMeetings = useMemo(() => meetings.slice(0, 6), [meetings]);
  const hasQuery = query.trim().length > 0;
  const latestMeeting = recentMeetings[0];
  const hasSearchResults =
    noteResults.length > 0 || meetingResults.length > 0;
  const quickActionCount = 2;
  const totalItems = hasQuery
    ? quickActionCount + noteResults.length + meetingResults.length
    : quickActionCount + recentMeetings.length;

  const open = useCallback(() => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 20);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(-1);
    setNoteHits([]);
  }, []);

  const handleSelect = useCallback(
    (index: number) => {
      if (hasQuery) {
        if (index === 0) {
          onAIQuery(query);
          close();
          return;
        }
        if (index === 1) {
          onLiteralSearch(query);
          close();
          return;
        }

        if (index < 2 + noteResults.length) {
          const result = noteResults[index - 2];
          if (!result) return;
          onOpenNote?.(result.refId);
          close();
          return;
        }

        const result =
          meetingResults[index - 2 - noteResults.length];
        if (!result) return;
        onOpenMeeting(result.refId);
        close();
        return;
      }

      if (index === 0) {
        onAIQuery("");
        close();
        return;
      }

      if (index === 1) {
        if (latestMeeting) {
          onOpenMeeting(latestMeeting.id);
          close();
        }
        return;
      }

      const meeting = recentMeetings[index - 2];
      if (!meeting) return;
      onOpenMeeting(meeting.id);
      close();
    },
    [
      close,
      hasQuery,
      onAIQuery,
      onLiteralSearch,
      onOpenMeeting,
      onOpenNote,
      query,
      latestMeeting,
      recentMeetings,
      noteResults,
      meetingResults,
    ],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
        return;
      }

      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (totalItems > 0) {
          setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1));
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSelect(selectedIndex);
        } else if (hasQuery) {
          onAIQuery(query);
          close();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    close,
    handleSelect,
    hasQuery,
    isOpen,
    onAIQuery,
    open,
    query,
    selectedIndex,
    totalItems,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        close();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 40);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [close, isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[540px] no-drag"
    >
      {!isOpen ? (
        <button
          type="button"
          onClick={open}
          className="group flex h-7 w-full items-center gap-2 rounded-sm border border-border-subtle/80 bg-background/42 px-2.5 text-left text-[11.5px] text-text-secondary shadow-[0_10px_28px_-26px_rgba(0,0,0,0.88)] transition-colors hover:border-border-muted hover:bg-background/62"
        >
          <Search className="h-3.5 w-3.5 shrink-0 text-text-tertiary transition-colors group-hover:text-text-secondary" />
          <span className="min-w-0 flex-1 truncate text-[12px]">
            {t("launcher.searchPlaceholder")}
          </span>
          <ZedKeyBinding keys={shortcutKeys} className="opacity-90" />
        </button>
      ) : null}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="absolute left-1/2 top-[calc(100%+6px)] z-[240] -translate-x-1/2"
            style={{ width: "min(700px, calc(100vw - 40px))" }}
          >
            <div className="overflow-hidden rounded-sm border border-border-subtle/80 bg-background/98 shadow-[0_26px_64px_-46px_rgba(0,0,0,0.92)] backdrop-blur-sm">
              <div className="border-b border-border-subtle/80 px-2.5 py-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
                    {t("globalSearch.title")}
                  </span>
                  <div className="flex items-center gap-1">
                    <ZedKeyBinding keys={["↑"]} />
                    <ZedKeyBinding keys={["↓"]} />
                    <ZedKeyBinding keys={["Esc"]} />
                  </div>
                </div>
                <div className="flex h-9 items-center gap-2 rounded-sm border border-border-subtle/80 bg-background/38 px-2.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedIndex(-1);
                    }}
                    placeholder={t("globalSearch.placeholder")}
                    className="h-full w-full bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-tertiary"
                  />
                  <div className="flex items-center gap-1">
                    <ZedKeyBinding keys={["↑"]} />
                    <ZedKeyBinding keys={["↓"]} />
                    <ZedKeyBinding keys={["Esc"]} />
                  </div>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto px-1.5 py-1.5">
                {hasQuery ? (
                  <div className="space-y-1.5">
                    <section className="space-y-0.5">
                      <SectionLabel meta="2">{t("launcher.searchQuickActions")}</SectionLabel>
                      <ZedListItem
                        onClick={() => handleSelect(0)}
                        onMouseEnter={() => setSelectedIndex(0)}
                        selected={selectedIndex === 0}
                        startSlot={<Sparkles className="h-3.5 w-3.5" />}
                        endSlot={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">AI</span>}
                        spacing="dense"
                        className="rounded-sm px-2 py-1.5 text-text-primary"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5 pr-2">
                          <span className="truncate text-[12.5px] font-medium text-text-primary">
                            {query}
                          </span>
                          <span className="truncate text-[11px] text-text-tertiary">
                            {t("launcher.searchAskSubtitle")}
                          </span>
                        </div>
                      </ZedListItem>

                      <ZedListItem
                        onClick={() => handleSelect(1)}
                        onMouseEnter={() => setSelectedIndex(1)}
                        selected={selectedIndex === 1}
                        startSlot={<Search className="h-3.5 w-3.5" />}
                        endSlot={
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                            {t("launcher.openAction")}
                          </span>
                        }
                        spacing="dense"
                        className="rounded-sm px-2 py-1.5 text-text-primary"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5 pr-2">
                          <span className="truncate text-[12.5px] font-medium text-text-primary">
                            {t("launcher.searchFor")} "{query}"
                          </span>
                          <span className="truncate text-[11px] text-text-tertiary">
                            {t("launcher.searchLiteralSubtitle")}
                          </span>
                        </div>
                      </ZedListItem>
                    </section>

                    {noteResults.length > 0 ? (
                      <section className="space-y-0.5">
                        <SectionLabel meta={noteResults.length}>
                          {t("launcher.searchNotes")}
                        </SectionLabel>
                        {noteResults.map((result, index) => (
                          <ZedListItem
                            key={result.id}
                            onClick={() => handleSelect(index + 2)}
                            onMouseEnter={() => setSelectedIndex(index + 2)}
                            selected={selectedIndex === index + 2}
                            startSlot={<FileText className="h-3.5 w-3.5" />}
                            endSlot={
                              <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                {t("workspace.noteDocument")}
                              </span>
                            }
                            spacing="dense"
                            className="rounded-sm px-2 py-1.5 text-text-primary"
                          >
                            <div className="flex min-w-0 flex-col gap-0.5 pr-2">
                              <span className="truncate text-[12.5px] font-medium text-text-primary">
                                {result.title}
                              </span>
                              {result.subtitle ? (
                                <span className="truncate text-[11px] text-text-tertiary">
                                  {result.subtitle}
                                </span>
                              ) : null}
                            </div>
                          </ZedListItem>
                        ))}
                      </section>
                    ) : null}

                    {meetingResults.length > 0 ? (
                      <section className="space-y-0.5">
                        <SectionLabel meta={meetingResults.length}>
                          {t("launcher.searchMeetings")}
                        </SectionLabel>
                        {meetingResults.map((result, index) => {
                          const itemIndex = index + 2 + noteResults.length;
                          return (
                            <ZedListItem
                              key={result.id}
                              onClick={() => handleSelect(itemIndex)}
                              onMouseEnter={() => setSelectedIndex(itemIndex)}
                              selected={selectedIndex === itemIndex}
                              startSlot={<Mic className="h-3.5 w-3.5" />}
                              endSlot={
                                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                                  {t("workspace.meetingDocument")}
                                </span>
                              }
                              spacing="dense"
                              className="rounded-sm px-2 py-1.5 text-text-primary"
                            >
                              <div className="flex min-w-0 flex-col gap-0.5 pr-2">
                                <span className="truncate text-[12.5px] font-medium text-text-primary">
                                  {result.title}
                                </span>
                                {result.subtitle ? (
                                  <span className="truncate text-[11px] text-text-tertiary">
                                    {result.subtitle}
                                  </span>
                                ) : null}
                              </div>
                            </ZedListItem>
                          );
                        })}
                      </section>
                    ) : null}

                    {!hasSearchResults ? (
                      <section className="space-y-0.5">
                        <SectionLabel meta="0">{t("launcher.searchSessions")}</SectionLabel>
                        <div className="rounded-sm border border-dashed border-border-subtle/80 bg-background/18 px-3 py-3 text-[12px] leading-6 text-text-tertiary">
                          {t("launcher.searchEmptyState")}
                        </div>
                      </section>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <section className="space-y-0.5">
                      <SectionLabel meta="2">{t("launcher.searchQuickActions")}</SectionLabel>
                      <ZedListItem
                        onClick={() => handleSelect(0)}
                        onMouseEnter={() => setSelectedIndex(0)}
                        selected={selectedIndex === 0}
                        startSlot={<Sparkles className="h-3.5 w-3.5" />}
                        endSlot={<span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">AI</span>}
                        spacing="dense"
                        className="rounded-sm px-2 py-1.5 text-text-primary"
                      >
                        <div className="flex min-w-0 flex-col gap-0.5 pr-2">
                          <span className="truncate text-[12.5px] font-medium text-text-primary">
                            {t("launcher.searchAskAnywhere")}
                          </span>
                          <span className="truncate text-[11px] text-text-tertiary">
                            {t("launcher.searchAskAnywhereSubtitle")}
                          </span>
                        </div>
                      </ZedListItem>

                      <ZedListItem
                        onClick={() => handleSelect(1)}
                        onMouseEnter={() => setSelectedIndex(1)}
                        selected={selectedIndex === 1}
                        startSlot={<Clock3 className="h-3.5 w-3.5" />}
                        endSlot={
                          latestMeeting ? (
                            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                              {t("launcher.openAction")}
                            </span>
                          ) : null
                        }
                        spacing="dense"
                        className={cn(
                          "rounded-sm px-2 py-1.5 text-text-primary",
                          !latestMeeting && "opacity-55",
                        )}
                      >
                        <div className="flex min-w-0 flex-col gap-0.5 pr-2">
                          <span className="truncate text-[12.5px] font-medium text-text-primary">
                            {t("launcher.searchLatestMeeting")}
                          </span>
                          <span className="truncate text-[11px] text-text-tertiary">
                            {latestMeeting
                              ? latestMeeting.title
                              : t("launcher.noRecentMeetings")}
                          </span>
                        </div>
                      </ZedListItem>
                    </section>

                    <section className="space-y-0.5">
                      <SectionLabel meta={recentMeetings.length}>{t("launcher.searchSessions")}</SectionLabel>
                      {recentMeetings.length > 0 ? (
                        recentMeetings.map((meeting, index) => {
                        const timestamp = new Date(meeting.date);
                        const timeLabel = Number.isNaN(timestamp.getTime())
                          ? ""
                          : timestamp.toLocaleDateString(dateLocale, {
                              month: "short",
                              day: "numeric",
                            });
                        const itemIndex = index + 2;

                        return (
                          <ZedListItem
                            key={meeting.id}
                            onClick={() => handleSelect(itemIndex)}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            selected={selectedIndex === itemIndex}
                            startSlot={<Clock3 className="h-3.5 w-3.5" />}
                            spacing="dense"
                            className={cn(
                              "rounded-sm px-2 py-1.5 text-text-primary",
                              selectedIndex === itemIndex && "bg-bg-item-active/90",
                            )}
                          >
                            <div className="flex min-w-0 items-center justify-between gap-3">
                              <div className="flex min-w-0 flex-col gap-0.5 pr-2">
                                <span className="truncate text-[12.5px] font-medium text-text-primary">
                                  {meeting.title}
                                </span>
                                {meeting.summary ? (
                                  <span className="truncate text-[11px] text-text-tertiary">
                                    {meeting.summary}
                                  </span>
                                ) : null}
                              </div>
                              {timeLabel ? (
                                <span className="shrink-0 text-[11px] text-text-tertiary">
                                  {timeLabel}
                                </span>
                              ) : null}
                            </div>
                          </ZedListItem>
                        );
                        })
                      ) : (
                        <div className="rounded-sm border border-dashed border-border-subtle/80 bg-background/18 px-3 py-3 text-[12px] leading-6 text-text-tertiary">
                          {t("launcher.noRecentMeetings")}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border-subtle/80 bg-background/14 px-3 py-1.5">
                <span className="text-[11px] text-text-tertiary">
                  {hasQuery
                    ? t("launcher.searchAskSubtitle")
                    : t("launcher.searchRecentHint")}
                </span>
                <div className="flex items-center gap-1.5">
                  <ZedKeyBinding keys={["Enter"]} />
                  <ZedKeyBinding keys={["Esc"]} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopSearchPill;
