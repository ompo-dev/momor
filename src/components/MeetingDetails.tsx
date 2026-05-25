import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useResolvedTheme } from "../hooks/useResolvedTheme";
import {
  ArrowLeft,
  Search,
  Mail,
  Link,
  ChevronDown,
  Play,
  ArrowUp,
  Copy,
  Check,
  MoreHorizontal,
  Settings,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MeetingChatOverlay from "./MeetingChatOverlay";
import EditableTextBlock from "./EditableTextBlock";
import momorLogo from "./icon.png";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

function isSelfSpeaker(speaker: string | undefined): boolean {
  const s = speaker?.toLowerCase() ?? "";
  return s === "user" || s === "me" || s === "mic";
}

const formatTime = (
  ms: number,
  locale: string,
  hour12: boolean,
) => {
  const date = new Date(ms);
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12,
  });
};

const formatDuration = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${Number(seconds) < 10 ? "0" : ""}${seconds}`;
};

const cleanMarkdown = (content: string) => {
  if (!content) return "";
  // Ensure code blocks are on new lines to fix rendering issues
  return content.replace(/([^\n])```/g, "$1\n\n```");
};

/** Maps legacy English section titles stored in the DB to i18n when UI is pt-BR. */
const LEGACY_SECTION_TITLE_KEYS: Record<string, string> = {
  "Action Items": "meetingDetails.actionItems",
  "Action items": "meetingDetails.actionItems",
  "Key Points": "meetingDetails.keyPoints",
  "Key points": "meetingDetails.keyPoints",
  Summary: "meetingDetails.tabSummary",
  "Follow-up actions": "meetingDetails.actionItems",
  "Next Steps": "meetingDetails.nextSteps",
  "Next steps": "meetingDetails.nextSteps",
};

function localizeFollowUpDraftForDisplay(
  draft: string,
  isPt: boolean,
): string {
  if (!isPt) return draft;
  return draft
    .replace(/^Hi team,$/m, "Olá, equipe,")
    .replace(/^Hi,$/m, "Olá,")
    .replace(
      /^Thanks for the conversation today\.$/m,
      "Obrigado pela conversa de hoje.",
    )
    .replace(/^Next steps:$/m, "Próximos passos:")
    .replace(
      /^I will follow up if anything else is needed\.$/m,
      "Entro em contato se precisar de algo mais.",
    )
    .replace(/^Best,$/m, "Atenciosamente,")
    .replace(/\s+by\s+/g, " até ");
}

interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  summary: string;
  detailedSummary?: {
    overview?: string;
    actionItems: string[];
    keyPoints: string[];
    actionItemsTitle?: string;
    keyPointsTitle?: string;
    sections?: Array<{ title: string; bullets: string[] }>;
    // Phase 7 — PostCallWorkflow enhancements (schema v2). Backend writes
    // these via buildPostCallEnhancements(); UI renders them when present.
    schemaVersion?: 2;
    actionItemsStructured?: Array<{
      id: string;
      text: string;
      owner?: string;
      deadline?: string;
      sourceTimestamp?: number;
    }>;
    followUpDraft?: string;
    coachingInsights?: Array<{
      id: string;
      type: string;
      title: string;
      detail: string;
      severity: "info" | "opportunity" | "warning";
      evidence?: string;
    }>;
  };
  transcript?: Array<{
    speaker: string;
    text: string;
    timestamp: number;
  }>;
  usage?: Array<{
    type: "assist" | "followup" | "chat" | "followup_questions";
    timestamp: number;
    question?: string;
    answer?: string;
    items?: string[];
  }>;
}

interface MeetingDetailsProps {
  meeting: Meeting;
  onBack: () => void;
  onOpenSettings: () => void;
}

const MeetingDetails: React.FC<MeetingDetailsProps> = ({
  meeting: initialMeeting,
}) => {
  const { t, i18n } = useTranslation();
  const isPt = i18n.language.startsWith("pt");
  const dateLocale = isPt ? "pt-BR" : "en-US";
  const use24h = isPt;
  const isLight = useResolvedTheme() === "light";

  const formatTranscriptTime = useCallback(
    (ms: number) => formatTime(ms, dateLocale, !use24h),
    [dateLocale, use24h],
  );

  const displaySectionTitle = useCallback(
    (title: string | undefined, fallbackKey: string) => {
      const fallback = t(fallbackKey);
      if (!title?.trim()) return fallback;
      if (isPt) {
        const key = LEGACY_SECTION_TITLE_KEYS[title.trim()];
        if (key) return t(key);
      }
      return title;
    },
    [t, isPt],
  );
  // We need local state for the meeting object to reflect optimistic updates
  const [meeting, setMeeting] = useState<Meeting>(initialMeeting);
  const [activeTab, setActiveTab] = useState<
    "summary" | "transcript" | "usage"
  >("summary");
  const [query, setQuery] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");

  const handleSubmitQuestion = () => {
    if (query.trim()) {
      setSubmittedQuery(query);
      if (!isChatOpen) {
        setIsChatOpen(true);
      }
      setQuery("");
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && query.trim()) {
      e.preventDefault();
      handleSubmitQuestion();
    }
  };

  const handleCopy = async () => {
    let textToCopy = "";

    if (activeTab === "summary" && meeting.detailedSummary) {
      textToCopy = `
${t("meetingDetails.exportMeeting")}: ${meeting.title}
${t("meetingDetails.exportDate")}: ${new Date(meeting.date).toLocaleDateString(dateLocale)}

${t("meetingDetails.exportOverview")}:
${meeting.detailedSummary.overview || ""}

${t("meetingDetails.exportActionItems")}:
${meeting.detailedSummary.actionItems?.map((item) => `- ${item}`).join("\n") || t("meetingDetails.exportNone")}

${t("meetingDetails.exportKeyPoints")}:
${meeting.detailedSummary.keyPoints?.map((item) => `- ${item}`).join("\n") || t("meetingDetails.exportNone")}
            `.trim();
    } else if (activeTab === "transcript" && meeting.transcript) {
      textToCopy = meeting.transcript
        .map(
          (entry) =>
            `[${formatTranscriptTime(entry.timestamp)}] ${isSelfSpeaker(entry.speaker) ? t("meetingDetails.speakerMe") : t("meetingDetails.speakerThem")}: ${entry.text}`,
        )
        .join("\n");
    } else if (activeTab === "usage" && meeting.usage) {
      textToCopy = meeting.usage
        .map((u) => `Q: ${u.question || ""}\nA: ${u.answer || ""}`)
        .join("\n\n");
    }

    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy content:", err);
    }
  };

  // UPDATE HANDLERS
  const handleTitleSave = async (newTitle: string) => {
    setMeeting((prev) => ({ ...prev, title: newTitle }));
    if (window.electronAPI?.updateMeetingTitle) {
      await window.electronAPI.updateMeetingTitle(meeting.id, newTitle);
    }
  };

  const handleOverviewSave = async (newOverview: string) => {
    setMeeting((prev) => ({
      ...prev,
      detailedSummary: {
        ...prev.detailedSummary!,
        overview: newOverview,
      },
    }));
    if (window.electronAPI?.updateMeetingSummary) {
      await window.electronAPI.updateMeetingSummary(meeting.id, {
        overview: newOverview,
      });
    }
  };

  const handleActionItemSave = async (index: number, newVal: string) => {
    const newItems = [...(meeting.detailedSummary?.actionItems || [])];
    if (!newVal.trim()) {
      // Optional: Remove empty items? For now just keep empty or update
    }
    newItems[index] = newVal;

    setMeeting((prev) => ({
      ...prev,
      detailedSummary: {
        ...prev.detailedSummary!,
        actionItems: newItems,
      },
    }));

    if (window.electronAPI?.updateMeetingSummary) {
      await window.electronAPI.updateMeetingSummary(meeting.id, {
        actionItems: newItems,
      });
    }
  };

  const handleKeyPointSave = async (index: number, newVal: string) => {
    const newItems = [...(meeting.detailedSummary?.keyPoints || [])];
    newItems[index] = newVal;

    setMeeting((prev) => ({
      ...prev,
      detailedSummary: {
        ...prev.detailedSummary!,
        keyPoints: newItems,
      },
    }));

    if (window.electronAPI?.updateMeetingSummary) {
      await window.electronAPI.updateMeetingSummary(meeting.id, {
        keyPoints: newItems,
      });
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground font-sans overflow-hidden">
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="max-w-4xl mx-auto px-8 py-8 pb-32" // Added pb-32 for floating footer clearance
        >
          {/* Meta Info & Actions Row */}
          <div className="flex items-start justify-between mb-6">
            <div className="w-full pr-4">
              {/* Date formatting could be improved to use meeting.date if it's an ISO string */}
              <div className="text-xs text-text-tertiary font-medium mb-1">
                {new Date(meeting.date).toLocaleDateString(dateLocale, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </div>

              {/* Editable Title */}
              <EditableTextBlock
                initialValue={meeting.title}
                onSave={handleTitleSave}
                tagName="h1"
                className="text-3xl font-bold text-text-primary tracking-tight -ml-2 px-2 py-1 rounded-md transition-colors"
                multiline={false}
              />
            </div>

            {/* Moved Actions: Follow-up & Share (REMOVED per user request) */}
            {/* <div className="flex items-center gap-2 mt-1"> ... </div> */}
          </div>

          <div className="flex items-center justify-between mb-8">
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "summary" | "transcript" | "usage")}
            >
              <TabsList>
                <TabsTrigger value="summary">
                  {t("meetingDetails.tabSummary")}
                </TabsTrigger>
                <TabsTrigger value="transcript">
                  {t("meetingDetails.tabTranscript")}
                </TabsTrigger>
                <TabsTrigger value="usage">
                  {t("meetingDetails.tabUsage")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-2">
              {isCopied ? (
                <Check size={14} className="text-emerald-500" />
              ) : (
                <Copy size={14} />
              )}
              {isCopied
                ? t("meetingDetails.copied")
                : activeTab === "summary"
                  ? t("meetingDetails.copyFullSummary")
                  : activeTab === "transcript"
                    ? t("meetingDetails.copyFullTranscript")
                    : t("meetingDetails.copyUsage")}
            </Button>
          </div>

          {/* Tab Content */}
          <div className="space-y-8">
            {/* Using standard divs for content, framer motion for layout */}
            {activeTab === "summary" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Overview - Rendered as Markdown */}
                {meeting.detailedSummary?.overview && (
                  <div className="mb-6 pb-6 border-b border-border-subtle prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ node, ...props }) => (
                          <h1
                            className="text-xl font-bold text-text-primary mt-4 mb-2"
                            {...props}
                          />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2
                            className="text-lg font-semibold text-text-primary mt-4 mb-2"
                            {...props}
                          />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3
                            className="text-base font-semibold text-text-primary mt-3 mb-1"
                            {...props}
                          />
                        ),
                        p: ({ node, ...props }) => (
                          <p
                            className="text-sm text-text-secondary leading-relaxed mb-2"
                            {...props}
                          />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul
                            className="list-disc ml-4 mb-2 space-y-1"
                            {...props}
                          />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol
                            className="list-decimal ml-4 mb-2 space-y-1"
                            {...props}
                          />
                        ),
                        li: ({ node, ...props }) => (
                          <li
                            className="text-sm text-text-secondary"
                            {...props}
                          />
                        ),
                        strong: ({ node, ...props }) => (
                          <strong
                            className="font-semibold text-text-primary"
                            {...props}
                          />
                        ),
                        a: ({ node, ...props }) => (
                          <a
                            className="text-blue-500 hover:underline"
                            {...props}
                          />
                        ),
                      }}
                    >
                      {meeting.detailedSummary?.overview || ""}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Action Items - Only show if there are items */}
                {meeting.detailedSummary?.actionItems &&
                  meeting.detailedSummary.actionItems.length > 0 && (
                    <section className="mb-8">
                      <div className="flex items-center justify-between mb-4">
                        <EditableTextBlock
                          initialValue={displaySectionTitle(
                            meeting.detailedSummary?.actionItemsTitle,
                            "meetingDetails.actionItems",
                          )}
                          onSave={(val) => {
                            setMeeting((prev) => ({
                              ...prev,
                              detailedSummary: {
                                ...prev.detailedSummary!,
                                actionItemsTitle: val,
                              },
                            }));
                            window.electronAPI?.updateMeetingSummary(
                              meeting.id,
                              { actionItemsTitle: val },
                            );
                          }}
                          tagName="h2"
                          className="text-lg font-semibold text-text-primary -ml-2 px-2 py-1 rounded-sm transition-colors"
                          multiline={false}
                        />
                      </div>
                      <ul className="space-y-3">
                        {meeting.detailedSummary.actionItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 group">
                            <div className="mt-2 w-1.5 h-1.5 rounded-full bg-text-secondary group-hover:bg-blue-500 transition-colors shrink-0" />
                            <div className="flex-1">
                              <EditableTextBlock
                                initialValue={item}
                                onSave={(val) => handleActionItemSave(i, val)}
                                tagName="p"
                                className="text-sm text-text-secondary leading-relaxed -ml-2 px-2 rounded-sm transition-colors"
                                placeholder={t(
                                  "meetingDetails.actionItemPlaceholder",
                                )}
                                onEnter={() => {
                                  const newItems = [
                                    ...(meeting.detailedSummary?.actionItems ||
                                      []),
                                  ];
                                  newItems.splice(i + 1, 0, "");
                                  setMeeting((prev) => ({
                                    ...prev,
                                    detailedSummary: {
                                      ...prev.detailedSummary!,
                                      actionItems: newItems,
                                    },
                                  }));
                                }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                {/* Key Points - Only show if there are items */}
                {meeting.detailedSummary?.keyPoints &&
                  meeting.detailedSummary.keyPoints.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <EditableTextBlock
                          initialValue={displaySectionTitle(
                            meeting.detailedSummary?.keyPointsTitle,
                            "meetingDetails.keyPoints",
                          )}
                          onSave={(val) => {
                            setMeeting((prev) => ({
                              ...prev,
                              detailedSummary: {
                                ...prev.detailedSummary!,
                                keyPointsTitle: val,
                              },
                            }));
                            window.electronAPI?.updateMeetingSummary(
                              meeting.id,
                              { keyPointsTitle: val },
                            );
                          }}
                          tagName="h2"
                          className="text-lg font-semibold text-text-primary -ml-2 px-2 py-1 rounded-sm transition-colors"
                          multiline={false}
                        />
                      </div>
                      <ul className="space-y-3">
                        {meeting.detailedSummary.keyPoints.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 group">
                            <div className="mt-2 w-1.5 h-1.5 rounded-full bg-text-secondary group-hover:bg-purple-500 transition-colors shrink-0" />
                            <div className="flex-1">
                              <EditableTextBlock
                                initialValue={item}
                                onSave={(val) => handleKeyPointSave(i, val)}
                                tagName="p"
                                className="text-sm text-text-secondary leading-relaxed -ml-2 px-2 rounded-sm transition-colors"
                                placeholder={t(
                                  "meetingDetails.keyPointPlaceholder",
                                )}
                                onEnter={() => {
                                  const newItems = [
                                    ...(meeting.detailedSummary?.keyPoints ||
                                      []),
                                  ];
                                  newItems.splice(i + 1, 0, "");
                                  setMeeting((prev) => ({
                                    ...prev,
                                    detailedSummary: {
                                      ...prev.detailedSummary!,
                                      keyPoints: newItems,
                                    },
                                  }));
                                }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                {/* Phase 7 — Structured action items (with owner / deadline).
                                    Rendered ONLY when PostCallWorkflow has produced them
                                    (schemaVersion === 2). Falls through silently otherwise so
                                    pre-Phase-7 meetings still look the same. */}
                {meeting.detailedSummary?.actionItemsStructured &&
                  meeting.detailedSummary.actionItemsStructured.length > 0 && (
                    <section className="mb-8">
                      <h2 className="text-lg font-semibold text-text-primary mb-4">
                        {t("meetingDetails.nextSteps")}
                      </h2>
                      <ul className="space-y-2">
                        {meeting.detailedSummary.actionItemsStructured.map(
                          (item) => (
                            <li
                              key={item.id}
                              className="flex items-start gap-3 group"
                            >
                              <div className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500/70 group-hover:bg-emerald-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-text-secondary leading-relaxed">
                                  {item.text}
                                </p>
                                {(item.owner || item.deadline) && (
                                  <p className="text-[11px] text-text-tertiary mt-0.5">
                                    {item.owner && (
                                      <span className="font-medium">
                                        {item.owner}
                                      </span>
                                    )}
                                    {item.owner && item.deadline && (
                                      <span> · </span>
                                    )}
                                    {item.deadline && (
                                      <span>
                                        {t("meetingDetails.deadlineBy", {
                                          date: item.deadline,
                                        })}
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            </li>
                          ),
                        )}
                      </ul>
                    </section>
                  )}

                {/* Phase 7 — Coaching insights (mode-specific opportunities). */}
                {meeting.detailedSummary?.coachingInsights &&
                  meeting.detailedSummary.coachingInsights.length > 0 && (
                    <section className="mb-8">
                      <h2 className="text-lg font-semibold text-text-primary mb-4">
                        {t("meetingDetails.coaching")}
                      </h2>
                      <ul className="space-y-3">
                        {meeting.detailedSummary.coachingInsights.map(
                          (insight) => {
                            const tone =
                              insight.severity === "warning"
                                ? "border-amber-400/40 bg-amber-500/5"
                                : insight.severity === "opportunity"
                                  ? "border-blue-400/40 bg-blue-500/5"
                                  : "border-text-tertiary/30 bg-transparent";
                            return (
                              <li
                                key={insight.id}
                                className={`p-3 rounded-[10px] border ${tone}`}
                              >
                                <p className="text-sm font-semibold text-text-primary">
                                  {insight.title}
                                </p>
                                <p className="text-[12.5px] text-text-secondary mt-1 leading-relaxed">
                                  {insight.detail}
                                </p>
                                {insight.evidence && (
                                  <p className="text-[11px] text-text-tertiary mt-1.5 italic">
                                    "{insight.evidence}"
                                  </p>
                                )}
                              </li>
                            );
                          },
                        )}
                      </ul>
                    </section>
                  )}

                {/* Phase 7 — Follow-up email draft. Selectable + copy-friendly. */}
                {meeting.detailedSummary?.followUpDraft &&
                  meeting.detailedSummary.followUpDraft.trim() && (
                    <section className="mb-8">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-text-primary">
                          {t("meetingDetails.followUpDraft")}
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard
                              ?.writeText(
                                meeting.detailedSummary?.followUpDraft || "",
                              )
                              .catch(() => {
                                /* swallow */
                              });
                          }}
                          className="text-[11px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-text-secondary border border-white/10 transition-colors"
                        >
                          {t("meetingDetails.copy")}
                        </button>
                      </div>
                      <pre className="text-[12.5px] text-text-secondary leading-relaxed whitespace-pre-wrap font-sans select-text cursor-text p-3 rounded-[10px] border border-white/10 bg-white/[0.02]">
                        {localizeFollowUpDraftForDisplay(
                          meeting.detailedSummary.followUpDraft,
                          isPt,
                        )}
                      </pre>
                    </section>
                  )}

                {/* Mode-specific sections (when active mode has a notes template) */}
                {meeting.detailedSummary?.sections &&
                  meeting.detailedSummary.sections.length > 0 && (
                    <div className="space-y-8">
                      {meeting.detailedSummary.sections.map(
                        (section, si) =>
                          section.bullets.length > 0 && (
                            <section key={si}>
                              <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-text-primary">
                                  {displaySectionTitle(
                                    section.title,
                                    "meetingDetails.tabSummary",
                                  )}
                                </h2>
                              </div>
                              <ul className="space-y-3">
                                {section.bullets.map((bullet, bi) => (
                                  <li
                                    key={bi}
                                    className="flex items-start gap-3 group"
                                  >
                                    <div className="mt-2 w-1.5 h-1.5 rounded-full bg-text-secondary shrink-0" />
                                    <p className="text-sm text-text-secondary leading-relaxed">
                                      {bullet}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ),
                      )}
                    </div>
                  )}
              </motion.div>
            )}

            {activeTab === "transcript" && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="space-y-3">
                  {(() => {
                    const filteredTranscript =
                      meeting.transcript?.filter((entry) => {
                        const isHidden = [
                          "system",
                          "ai",
                          "assistant",
                          "model",
                        ].includes(entry.speaker?.toLowerCase());
                        return !isHidden;
                      }) || [];

                    if (filteredTranscript.length === 0) {
                      return (
                        <p className="text-text-tertiary">
                          {t("meetingDetails.noTranscript")}
                        </p>
                      );
                    }

                    return filteredTranscript.map((entry, i) => {
                      const isSelf = isSelfSpeaker(entry.speaker);
                      return (
                        <div
                          key={i}
                          className={cn(
                            "flex w-full",
                            isSelf ? "justify-end" : "justify-start",
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[min(100%,42rem)] rounded-2xl border px-4 py-3 shadow-sm select-text",
                              isSelf
                                ? "rounded-tr-md bg-accent-primary/12 border-accent-primary/25"
                                : "rounded-tl-md bg-muted/50 border-border/80",
                            )}
                          >
                            <div
                              className={cn(
                                "flex items-center gap-2 mb-1.5",
                                isSelf ? "justify-end" : "justify-start",
                              )}
                            >
                              <span
                                className={cn(
                                  "text-[11px] font-semibold uppercase tracking-wide",
                                  isSelf
                                    ? "text-accent-primary"
                                    : "text-text-secondary",
                                )}
                              >
                                {isSelf
                                  ? t("meetingDetails.speakerMe")
                                  : t("meetingDetails.speakerThem")}
                              </span>
                              <span className="text-[11px] text-text-tertiary font-mono tabular-nums">
                                {entry.timestamp
                                  ? formatTranscriptTime(entry.timestamp)
                                  : "0:00"}
                              </span>
                            </div>
                            <p
                              className={cn(
                                "text-[15px] leading-relaxed",
                                isSelf
                                  ? "text-text-primary"
                                  : "text-text-secondary",
                              )}
                            >
                              {entry.text}
                            </p>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </motion.section>
            )}

            {activeTab === "usage" && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8 pb-10"
              >
                {meeting.usage?.map((interaction, i) => (
                  <div key={i} className="space-y-4">
                    {/* User Question */}
                    {interaction.question && (
                      <div className="flex justify-end">
                        <div className="bg-accent-primary text-white px-5 py-2.5 rounded-2xl rounded-tr-sm max-w-[80%] text-[15px] leading-relaxed shadow-sm">
                          {interaction.question}
                        </div>
                      </div>
                    )}

                    {/* AI Answer */}
                    {interaction.answer && (
                      <div className="flex items-start gap-4">
                        <div className="mt-1 w-6 h-6 rounded-full bg-bg-input flex items-center justify-center border border-border-subtle shrink-0">
                          <img
                            src={momorLogo}
                            alt="AI"
                            className="w-4 h-4 opacity-50 object-contain force-black-icon"
                          />
                        </div>
                        <div>
                          <div className="text-[11px] text-text-tertiary mb-1.5 font-medium">
                            {formatTranscriptTime(interaction.timestamp)}
                          </div>
                          <div className="text-text-secondary text-[15px] leading-relaxed max-w-none">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                h1: ({ node, ...props }) => (
                                  <p
                                    className="text-[15px] text-text-secondary font-normal leading-relaxed mb-2 whitespace-pre-wrap"
                                    {...props}
                                  />
                                ),
                                h2: ({ node, ...props }) => (
                                  <p
                                    className="text-[15px] text-text-secondary font-normal leading-relaxed mb-2 whitespace-pre-wrap"
                                    {...props}
                                  />
                                ),
                                h3: ({ node, ...props }) => (
                                  <p
                                    className="text-[15px] text-text-secondary font-normal leading-relaxed mb-2 whitespace-pre-wrap"
                                    {...props}
                                  />
                                ),
                                p: ({ node, ...props }) => (
                                  <p
                                    className="text-[15px] text-text-secondary font-normal leading-relaxed mb-2 whitespace-pre-wrap"
                                    {...props}
                                  />
                                ),
                                ul: ({ node, ...props }) => (
                                  <ul
                                    className="list-disc ml-4 mb-2 space-y-1"
                                    {...props}
                                  />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol
                                    className="list-decimal ml-4 mb-2 space-y-1"
                                    {...props}
                                  />
                                ),
                                li: ({ node, ...props }) => (
                                  <li
                                    className="text-[15px] text-text-secondary font-normal"
                                    {...props}
                                  />
                                ),
                                strong: ({ node, ...props }) => (
                                  <span
                                    className="font-normal text-text-secondary"
                                    {...props}
                                  />
                                ),
                                a: ({ node, ...props }: any) => (
                                  <a
                                    className="text-blue-500 hover:underline"
                                    {...props}
                                  />
                                ),
                                pre: ({ children }: any) => (
                                  <div className="not-prose mb-4">
                                    {children}
                                  </div>
                                ),
                                code: ({
                                  node,
                                  inline,
                                  className,
                                  children,
                                  ...props
                                }: any) => {
                                  const match = /language-(\w+)/.exec(
                                    className || "",
                                  );
                                  const isInline = inline ?? false;
                                  const lang = match ? match[1] : "";

                                  return !isInline ? (
                                    <div className="my-3 rounded-xl overflow-hidden border border-white/[0.08] shadow-lg bg-zinc-800/60 backdrop-blur-md">
                                      <div className="bg-white/[0.04] px-3 py-1.5 border-b border-white/[0.08]">
                                        <span className="text-[10px] uppercase tracking-widest font-semibold text-white/40 font-mono">
                                          {lang || "CODE"}
                                        </span>
                                      </div>
                                      <div className="bg-transparent">
                                        <SyntaxHighlighter
                                          language={lang || "text"}
                                          style={vscDarkPlus}
                                          customStyle={{
                                            margin: 0,
                                            borderRadius: 0,
                                            fontSize: "13px",
                                            lineHeight: "1.6",
                                            background: "transparent",
                                            padding: "16px",
                                            fontFamily:
                                              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                          }}
                                          wrapLongLines={true}
                                          showLineNumbers={true}
                                          lineNumberStyle={{
                                            minWidth: "2.5em",
                                            paddingRight: "1.2em",
                                            color: "rgba(255,255,255,0.2)",
                                            textAlign: "right",
                                            fontSize: "11px",
                                          }}
                                          {...props}
                                        >
                                          {String(children).replace(/\n$/, "")}
                                        </SyntaxHighlighter>
                                      </div>
                                    </div>
                                  ) : (
                                    <code
                                      className="bg-bg-tertiary px-1.5 py-0.5 rounded text-[13px] font-mono text-text-primary border border-border-subtle whitespace-pre-wrap"
                                      {...props}
                                    >
                                      {children}
                                    </code>
                                  );
                                },
                              }}
                            >
                              {cleanMarkdown(interaction.answer || "")}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {!meeting.usage?.length && (
                  <p className="text-text-tertiary">
                    {t("meetingDetails.noUsage")}
                  </p>
                )}
              </motion.section>
            )}
          </div>
        </motion.div>
      </main>

      {/* Floating Footer (Ask Bar) — hidden while chat overlay is open */}
      {!isChatOpen && (
      <div className="absolute bottom-0 left-0 right-0 z-20 flex justify-center p-6 pointer-events-none">
        <div className="w-full max-w-[440px] relative group pointer-events-auto">
          {/* Dark Glass Effect Input (Matching Reference) */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t("meetingDetails.askPlaceholder")}
            className="w-full rounded-full border border-border bg-card py-3 pl-5 pr-12 text-sm text-foreground shadow-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleSubmitQuestion}
            disabled={!query.trim()}
            className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full"
          >
            <ArrowUp size={16} className="rotate-45" />
          </Button>
        </div>
      </div>
      )}

      {/* Chat Overlay */}
      <MeetingChatOverlay
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setQuery("");
          setSubmittedQuery("");
        }}
        meetingContext={{
          id: meeting.id, // Required for RAG queries
          title: meeting.title,
          summary: meeting.detailedSummary?.overview,
          keyPoints: meeting.detailedSummary?.keyPoints,
          actionItems: meeting.detailedSummary?.actionItems,
          transcript: meeting.transcript,
        }}
        initialQuery={submittedQuery}
        onNewQuery={(newQuery) => {
          setSubmittedQuery(newQuery);
        }}
      />
    </div>
  );
};

export default MeetingDetails;
