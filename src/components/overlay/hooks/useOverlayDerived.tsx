import { useMemo } from "react";

import {
  getOverlayAppearance,
  getGlassOverlayAppearance,
} from "../../../lib/overlayAppearance";
import { mergeRollingPreview } from "../../../lib/rollingTranscript";

export function useOverlayDerived({
  overlayOpacity,
  isGlassTheme,
  isLightTheme,
  rollingCommitted,
  rollingLive,
  userRollingCommitted,
  userRollingLive,
}: any) {
  const mdComponents = useMemo(
    () => ({
      standard: {
        p: ({ node, ...props }: any) => (
          <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />
        ),
        strong: ({ node, ...props }: any) => (
          <strong
            className="font-bold opacity-100 overlay-text-strong"
            {...props}
          />
        ),
        em: ({ node, ...props }: any) => (
          <em className="italic opacity-90 overlay-text-secondary" {...props} />
        ),
        ul: ({ node, ...props }: any) => (
          <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />
        ),
        ol: ({ node, ...props }: any) => (
          <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />
        ),
        li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
        code: ({ node, ...props }: any) => (
          <code
            className={`overlay-inline-code-surface rounded px-1 py-0.5 text-xs font-mono ${isLightTheme ? "text-slate-800" : ""}`}
            {...props}
          />
        ),
        a: ({ node, ...props }: any) => (
          <a
            className="underline hover:opacity-80"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),
      },
      codeText: {
        p: ({ node, ...props }: any) => (
          <p className="mb-2 last:mb-0 whitespace-pre-wrap" {...props} />
        ),
        strong: ({ node, ...props }: any) => (
          <strong className="font-bold overlay-text-strong" {...props} />
        ),
        em: ({ node, ...props }: any) => (
          <em className="italic overlay-text-secondary" {...props} />
        ),
        ul: ({ node, ...props }: any) => (
          <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />
        ),
        ol: ({ node, ...props }: any) => (
          <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />
        ),
        li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
        h1: ({ node, ...props }: any) => (
          <h1
            className="text-lg font-bold mb-2 mt-3 overlay-text-strong"
            {...props}
          />
        ),
        h2: ({ node, ...props }: any) => (
          <h2
            className="text-base font-bold mb-2 mt-3 overlay-text-strong"
            {...props}
          />
        ),
        h3: ({ node, ...props }: any) => (
          <h3
            className="text-sm font-bold mb-1 mt-2 overlay-text-primary"
            {...props}
          />
        ),
        code: ({ node, ...props }: any) => (
          <code
            className={`overlay-inline-code-surface rounded px-1 py-0.5 text-xs font-mono whitespace-pre-wrap ${isLightTheme ? "text-violet-700" : "text-purple-200"}`}
            {...props}
          />
        ),
        blockquote: ({ node, ...props }: any) => (
          <blockquote
            className={`border-l-2 pl-3 italic my-2 ${isLightTheme ? "border-violet-500/30 text-slate-600" : "border-purple-500/50 text-slate-400"}`}
            {...props}
          />
        ),
        a: ({ node, ...props }: any) => (
          <a
            className={`hover:underline ${isLightTheme ? "text-blue-600 hover:text-blue-700" : "text-blue-400 hover:text-blue-300"}`}
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          />
        ),
      },
      whatToAnswerText: {
        p: ({ node, ...props }: any) => (
          <p className="mb-2 last:mb-0" {...props} />
        ),
        strong: ({ node, ...props }: any) => (
          <strong
            className={`font-bold ${isLightTheme ? "text-emerald-700" : "text-emerald-100"}`}
            {...props}
          />
        ),
        em: ({ node, ...props }: any) => (
          <em
            className={`italic ${isLightTheme ? "text-emerald-700/80" : "text-emerald-200/80"}`}
            {...props}
          />
        ),
        ul: ({ node, ...props }: any) => (
          <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />
        ),
        ol: ({ node, ...props }: any) => (
          <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />
        ),
        li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
      },
      recapText: {
        p: ({ node, ...props }: any) => (
          <p className="mb-2 last:mb-0" {...props} />
        ),
        strong: ({ node, ...props }: any) => (
          <strong
            className={`font-bold ${isLightTheme ? "text-indigo-800" : "text-indigo-100"}`}
            {...props}
          />
        ),
        ul: ({ node, ...props }: any) => (
          <ul className="list-disc ml-4 mb-2" {...props} />
        ),
        li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
      },
      followUpQuestionsText: {
        p: ({ node, ...props }: any) => (
          <p className="mb-2 last:mb-0" {...props} />
        ),
        strong: ({ node, ...props }: any) => (
          <strong
            className={`font-bold ${isLightTheme ? "text-amber-800" : "text-[#FFF9C4]"}`}
            {...props}
          />
        ),
        ul: ({ node, ...props }: any) => (
          <ul className="list-disc ml-4 mb-2" {...props} />
        ),
        li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
      },
      shortenText: {
        p: ({ node, ...props }: any) => (
          <p className="mb-2 last:mb-0" {...props} />
        ),
        strong: ({ node, ...props }: any) => (
          <strong
            className={`font-bold ${isLightTheme ? "text-cyan-800" : "text-cyan-100"}`}
            {...props}
          />
        ),
        ul: ({ node, ...props }: any) => (
          <ul className="list-disc ml-4 mb-2" {...props} />
        ),
        li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
      },
    }),
    [isLightTheme],
  );

  const appearance = useMemo(
    () =>
      isGlassTheme
        ? getGlassOverlayAppearance()
        : getOverlayAppearance(overlayOpacity, isLightTheme ? "light" : "dark"),
    [overlayOpacity, isLightTheme, isGlassTheme],
  );

  const rollingTranscriptPreview = useMemo(
    () => mergeRollingPreview(rollingCommitted, rollingLive),
    [rollingCommitted, rollingLive],
  );

  const userRollingTranscriptPreview = useMemo(
    () => mergeRollingPreview(userRollingCommitted, userRollingLive),
    [userRollingCommitted, userRollingLive],
  );

  return {
    mdComponents,
    appearance,
    rollingTranscriptPreview,
    userRollingTranscriptPreview,
  };
}
