import React from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Code, MessageSquare, RefreshCw, HelpCircle } from "lucide-react";
import { NegotiationCoachingCard } from "../../../premium";
import HighlightedCode from "../molecules/HighlightedCode";

const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS = [rehypeKatex];

type Props = {
  msg: any;
  isLightTheme: boolean;
  appearance: any;
  subtleSurfaceClass: string;
  codeTheme: any;
  codeBlockClass: string;
  codeHeaderClass: string;
  codeHeaderTextClass: string;
  codeLineNumberColor: string;
  /** Hoisted ReactMarkdown component maps (per intent) — see parent useMemo. */
  mdComponents: any;
  onNegotiationSilenceEnd: (msgId: string) => void;
};

/** Renders one chat message's body: negotiation card / code / labelled intents / markdown. */
export default function OverlayMessageContent({
  msg,
  isLightTheme,
  appearance,
  subtleSurfaceClass,
  codeTheme,
  codeBlockClass,
  codeHeaderClass,
  codeHeaderTextClass,
  codeLineNumberColor,
  mdComponents,
  onNegotiationSilenceEnd,
}: Props) {
  const { t } = useTranslation();

  const codeBlock = (code: string, lang: string, key: React.Key) => (
    <HighlightedCode
      key={key}
      code={code}
      lang={lang}
      isLightTheme={isLightTheme}
      codeTheme={codeTheme}
      codeBlockClass={codeBlockClass}
      codeHeaderClass={codeHeaderClass}
      codeHeaderTextClass={codeHeaderTextClass}
      codeLineNumberColor={codeLineNumberColor}
      appearance={appearance}
    />
  );

  const md = (text: string, components: any, key?: React.Key) => (
    <div key={key} className="markdown-content">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );

  // Negotiation coaching card takes priority
  if (msg.isNegotiationCoaching && msg.negotiationCoachingData) {
    return (
      <NegotiationCoachingCard
        {...msg.negotiationCoachingData}
        phase={msg.negotiationCoachingData.phase as any}
        onSilenceTimerEnd={() => onNegotiationSilenceEnd(msg.id)}
      />
    );
  }

  // Code-containing messages
  if (msg.isCode || (msg.role === "system" && msg.text.includes("```"))) {
    const parts = msg.text.split(/(```[\s\S]*?```)/g);
    return (
      <div
        className={`rounded-lg p-3 my-1 border ${subtleSurfaceClass}`}
        style={appearance.subtleStyle}
      >
        <div
          className={`flex items-center gap-2 mb-2 font-semibold text-xs uppercase tracking-wide ${isLightTheme ? "text-violet-600" : "text-purple-300"}`}
        >
          <Code className="w-3.5 h-3.5" />
          <span>{t("overlay.codeSolution")}</span>
        </div>
        <div
          className={`space-y-2 text-[13px] leading-relaxed ${isLightTheme ? "text-slate-800" : "text-slate-200"}`}
        >
          {parts.map((part: string, i: number) => {
            if (part.startsWith("```")) {
              const match = part.match(/```(\w+)?\n?([\s\S]*?)```/);
              if (match) {
                return codeBlock(match[2].trim(), match[1] || "python", i);
              }
            }
            return md(part, mdComponents.codeText, i);
          })}
        </div>
      </div>
    );
  }

  const labelled = (
    iconColor: string,
    icon: React.ReactNode,
    label: string,
    components: any,
  ) => (
    <div
      className={`rounded-lg p-3 my-1 border ${subtleSurfaceClass}`}
      style={appearance.subtleStyle}
    >
      <div
        className={`flex items-center gap-2 mb-2 font-semibold text-xs uppercase tracking-wide ${iconColor}`}
      >
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`text-[13px] leading-relaxed markdown-content ${isLightTheme ? "text-slate-800" : "text-slate-200"}`}
      >
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={components}
        >
          {msg.text}
        </ReactMarkdown>
      </div>
    </div>
  );

  if (msg.intent === "shorten") {
    return labelled(
      isLightTheme ? "text-cyan-700" : "text-cyan-300",
      <MessageSquare className="w-3.5 h-3.5" />,
      t("overlay.shortened"),
      mdComponents.shortenText,
    );
  }
  if (msg.intent === "recap") {
    return labelled(
      isLightTheme ? "text-indigo-700" : "text-indigo-300",
      <RefreshCw className="w-3.5 h-3.5" />,
      t("overlay.recap"),
      mdComponents.recapText,
    );
  }
  if (msg.intent === "follow_up_questions") {
    return labelled(
      isLightTheme ? "text-amber-700" : "text-[#FFD60A]",
      <HelpCircle className="w-3.5 h-3.5" />,
      t("overlay.followUpQuestions"),
      mdComponents.followUpQuestionsText,
    );
  }

  if (msg.intent === "what_to_answer") {
    const parts = msg.text.split(/(```[\s\S]*?(?:```|$))/g);
    return (
      <div
        className={`rounded-lg p-3 my-1 border ${subtleSurfaceClass}`}
        style={appearance.subtleStyle}
      >
        <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-xs uppercase tracking-wide">
          <span>{t("overlay.sayThis")}</span>
        </div>
        <div className="text-[14px] leading-relaxed overlay-text-primary">
          {parts.map((part: string, i: number) => {
            if (part.startsWith("```")) {
              const match = part.match(/```(\w*)\s+([\s\S]*?)(?:```|$)/);
              if (match || part.startsWith("```")) {
                const lang = match && match[1] ? match[1] : "python";
                const code =
                  match && match[2]
                    ? match[2].trim()
                    : part.replace(/^```\w*\s*/, "").replace(/```$/, "").trim();
                return codeBlock(code, lang, i);
              }
            }
            return md(part, mdComponents.whatToAnswerText, i);
          })}
        </div>
      </div>
    );
  }

  // Standard text messages
  return md(msg.text, mdComponents.standard);
}
