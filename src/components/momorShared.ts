import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useMemo,
  useCallback,
  startTransition as reactStartTransition,
} from "react";
import { Image, Copy } from "lucide-react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import {
  oneLight,
  vscDarkPlus,
} from "react-syntax-highlighter/dist/esm/styles/prism";
// import { ModelSelector } from './ui/ModelSelector'; // REMOVED
import TopPill from "./ui/TopPill";
import CollapsedWidget from "./overlay/CollapsedWidget";
import OverlayComposer from "./overlay/organisms/OverlayComposer";
import OverlayActionBar from "./overlay/organisms/OverlayActionBar";
import AgentToolChips from "./overlay/molecules/AgentToolChips";
import OverlayWarningBanners from "./overlay/molecules/OverlayWarningBanners";
import OverlayStealthBanners from "./overlay/molecules/OverlayStealthBanners";
import AttachedScreenshotPreview from "./overlay/molecules/AttachedScreenshotPreview";
import OverlayMessageContent from "./overlay/organisms/OverlayMessageContent";
import { useComposerMentions } from "./overlay/hooks/useComposerMentions";
import { useOverlayGeneralShortcuts } from "./overlay/hooks/useOverlayGeneralShortcuts";
import { useOverlayScrollAndChatShortcuts } from "./overlay/hooks/useOverlayScrollAndChatShortcuts";
import { useStealthGlobalShortcuts } from "./overlay/hooks/useStealthGlobalShortcuts";
import { useLiveMeetingListeners } from "./overlay/hooks/useLiveMeetingListeners";
import { useAgentStreamListeners } from "./overlay/hooks/useAgentStreamListeners";
import { useInertialScroll } from "./overlay/hooks/useInertialScroll";
import { useStealthTap } from "./overlay/hooks/useStealthTap";
import { useClarifyStream } from "./overlay/hooks/useClarifyStream";
import { useSessionReset } from "./overlay/hooks/useSessionReset";
import { useStealthAutoEngage } from "./overlay/hooks/useStealthAutoEngage";
import { useCaptureAndProcess } from "./overlay/hooks/useCaptureAndProcess";
import { useSttStatusListener } from "./overlay/hooks/useSttStatusListener";
import { useAgentToolChips } from "./overlay/hooks/useAgentToolChips";
import { useOverlayModeInit } from "./overlay/hooks/useOverlayModeInit";
import { useQuickActions } from "./overlay/hooks/useQuickActions";
import { useAnswerCall } from "./overlay/hooks/useAnswerCall";
import { useTokenBuffer } from "./overlay/hooks/useTokenBuffer";
import {
  useOverlayFx1,
  useOverlayFx2,
  useOverlayFx3,
  useOverlayFx4,
  useOverlayFx5,
  useOverlayFx6,
  useOverlayFx7,
  useOverlayFx8,
  useOverlayFx9,
  useOverlayFx10,
  useOverlayFx11,
  useOverlayFx12,
  useOverlayFx13,
  useOverlayFx14,
  useOverlayFx15,
  useOverlayFx16,
  useOverlayFx17,
  useOverlayFx18,
  useOverlayFx19,
  useOverlayFx20,
  useOverlayFx21,
  useOverlayFx22,
  useOverlayFx23,
  useOverlayFx24,
  useOverlayFx25,
  useOverlayFx26,
  useOverlayFx27,
} from "./overlay/hooks/useOverlayFx";
import {
  useDefaultModelLoader,
  useSttConfigListener,
  useScrollCodeVisibility,
  useOverlayUnmountCleanup,
  useUserContextSync,
  useAnswerEndpointWatcher,
} from "./overlay/hooks/useOverlayEffects";
import RollingTranscript from "./ui/RollingTranscript";
import "katex/dist/katex.min.css";

import {
  analytics,
  detectProviderType,
} from "../lib/analytics/analytics.service";
import { useShortcuts } from "../hooks/useShortcuts";
import { useResolvedTheme } from "../hooks/useResolvedTheme";
import {
  getOverlayAppearance,
  OVERLAY_OPACITY_DEFAULT,
  getGlassOverlayAppearance,
} from "../lib/overlayAppearance";
import type { MeetingInterfaceTheme } from "../lib/meetingInterfaceTheme";
import GlassEffectLayer from "./ui/GlassEffectLayer";
import { DynamicActionBar } from "./dynamic-actions/DynamicActionBar";
import type { DynamicActionPayload } from "../types/electron";
import { useTranslation } from "react-i18next";
import { getAnswerCallEndpointPauseMs } from "../lib/callVadEndpoint";
import {
  enrichSystemPromptWithUserContext,
  getActiveAiProfileId,
  getActiveProfile,
  getActiveProfileListeningFlags,
  loadUserSessionData,
  mergeConversationContextWithUserSession,
  USER_CONTEXT_CHANGED_EVENT,
} from "../lib/userSessionContext";
import { syncUserSessionContextToMain } from "../lib/syncUserSessionContextToMain";
import {
  commitRollingWithLive,
  mergeRollingPreview,
} from "../lib/rollingTranscript";

export interface Message {
  id: string;
  role: "user" | "system" | "interviewer";
  text: string;
  isStreaming?: boolean;
  hasScreenshot?: boolean;
  screenshotPreview?: string;
  isCode?: boolean;
  intent?: string;
  isNegotiationCoaching?: boolean;
  negotiationCoachingData?: {
    tacticalNote: string;
    exactScript: string;
    showSilenceTimer: boolean;
    phase: string;
    theirOffer: number | null;
    yourTarget: number | null;
    currency: string;
  };
}

export interface momorInterfaceProps {
  onEndMeeting?: () => void;
  overlayOpacity?: number;
  interfaceTheme?: MeetingInterfaceTheme;
}

export const AUTO_SUGGEST_COOLDOWN_MS = 3000;

export function hasInterviewerQuestionSignal(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith("?")) return true;
  return (
    /\b(o que|como|por que|porque|qual|quais|quando|onde|quem|pode|poderia|me diga|me conte|explique|descreva|fale sobre)\b/i.test(
      trimmed,
    ) ||
    /\b(what|how|why|where|when|which|who|can you|could you|tell me|explain|describe|walk me through)\b/i.test(
      trimmed,
    )
  );
}

// PERF: HighlightedCode renders a single fenced code block. Hoisted to module
// scope and wrapped in React.memo so a parent re-render does not re-tokenize
// existing code blocks. SyntaxHighlighter (Prism) has no internal render
// bailout — without this, every streaming token re-runs Prism over every code
// block in history. The customStyle / lineNumberStyle objects are also at
// module scope so their referential identity stays stable too.
// HighlightedCode + HC_CUSTOM_STYLE moved to overlay/molecules/HighlightedCode.tsx

// PERF: MessageRow renders one chat-message bubble. Module-scope + React.memo
// so a parent re-render does NOT re-render every prior message — only the
// streaming row whose `msg` reference actually changed gets reconciled.
//
// The combination of (this memo) + (HighlightedCode memo) + (rAF token
// coalescing) + (hoisted ReactMarkdown components) eliminates the streaming
// re-render storm: prior messages stay structurally identical between renders
// and bail out at this boundary, preserving their entire Markdown / code-block
// subtrees including expensive Prism tokenization.
//
// Stable-identity contract for the comparator to actually fire:
//   - msg: setMessages always returns a new array, but the per-message OBJECT
//     identity is preserved for non-changing rows (the streaming-row pattern
//     does `[...prev]` then mutates only `prev.length - 1`). So === on msg
//     correctly detects "this row is unchanged."
//   - appearance: useMemo'd in parent on [overlayOpacity, isLightTheme].
//   - onCopy / renderMessageText: useCallback'd in parent.
export const formatProviderLabel = (provider?: string | null): string => {
  if (!provider) return "not set";
  return provider
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const isUserMicSpeaker = (speaker?: string | null): boolean => {
  if (!speaker) return false;
  const normalized = speaker.toLowerCase();
  return normalized === "user" || normalized === "mic" || normalized === "me";
};

export const getSttSummary = (
  userStatus: "connected" | "reconnecting" | "failed",
  interviewerStatus: "connected" | "reconnecting" | "failed",
  userProvider: string,
  interviewerProvider: string,
  notConfigured: boolean,
): { labelKey: string; tone: "ok" | "warn" | "error"; detail: string } => {
  if (notConfigured) {
    return {
      labelKey: "overlay.sttNotConfigured",
      tone: "error",
      detail: "overlay.sttOpenAudioSettings",
    };
  }
  if (userStatus === "failed" || interviewerStatus === "failed") {
    return {
      labelKey: "overlay.sttNeedsAttention",
      tone: "error",
      detail: `${formatProviderLabel(userProvider)} mic · ${formatProviderLabel(interviewerProvider)} system`,
    };
  }
  if (userStatus === "reconnecting" || interviewerStatus === "reconnecting") {
    return {
      labelKey: "overlay.sttReconnecting",
      tone: "warn",
      detail: `${formatProviderLabel(userProvider)} mic · ${formatProviderLabel(interviewerProvider)} system`,
    };
  }
  return {
    labelKey: "overlay.sttHealthy",
    tone: "ok",
    detail: `${formatProviderLabel(userProvider)} mic · ${formatProviderLabel(interviewerProvider)} system`,
  };
};

export const getStatusToneClass = (tone: "ok" | "warn" | "error"): string => {
  if (tone === "error")
    return "text-rose-600 dark:text-rose-300 border-rose-500/20 bg-rose-500/10";
  if (tone === "warn")
    return "text-amber-600 dark:text-amber-300 border-amber-500/20 bg-amber-500/10";
  return "text-emerald-600 dark:text-emerald-300 border-emerald-500/20 bg-emerald-500/10";
};
