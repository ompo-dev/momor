import React from "react";
import { useTranslation } from "react-i18next";
import { Image, Copy } from "lucide-react";

interface MessageRowProps {
  msg: any;
  isLightTheme: boolean;
  appearance: any;
  onCopy: (text: string) => void;
  renderMessageText: (msg: any) => React.ReactNode;
}

/** One chat message row (bubble + role chrome + copy button). Memoized. */
const MessageRow = React.memo(
  function MessageRow({
    msg,
    isLightTheme,
    appearance,
    onCopy,
    renderMessageText,
  }: MessageRowProps) {
    const { t } = useTranslation();
    const isCodeMsg =
      msg.role === "system" && (msg.isCode || msg.text.includes("```"));
    // bubbleMaxClass: user bubbles are tighter; system + code use the same width.
    const bubbleMaxClass =
      msg.role === "user" ? "max-w-[88%] px-3 py-2" : "max-w-full";
    return (
      <div
        className="w-full"
        {...(isCodeMsg ? { "data-code-msg": "true" } : {})}
      >
        <div className="flex justify-start animate-fade-in-up">
          <div
            className={`
              ${bubbleMaxClass} text-[13px] leading-relaxed relative group whitespace-pre-wrap
              ${
                msg.role === "user"
                  ? "overlay-subtle-surface border rounded-md overlay-text-primary"
                  : ""
              }
              ${msg.role === "system" ? "overlay-text-primary font-normal" : ""}
              ${
                msg.role === "interviewer"
                  ? "overlay-text-muted italic pl-0 text-[13px]"
                  : ""
              }
            `}
          >
            {msg.role === "interviewer" && (
              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-medium uppercase tracking-wider overlay-text-muted">
                {t("overlay.interviewer")}
                {msg.isStreaming && (
                  <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
            )}
            {msg.role === "user" && msg.hasScreenshot && (
              <div
                className={`flex items-center gap-1 text-[10px] opacity-70 mb-1 border-b pb-1 ${isLightTheme ? "border-black/10" : "border-white/10"}`}
              >
                <Image className="w-2.5 h-2.5" />
                <span>{t("overlay.screenshotAttached")}</span>
              </div>
            )}
            {msg.role === "system" && !msg.isStreaming && (
              <button
                onClick={() => onCopy(msg.text)}
                className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity overlay-icon-surface overlay-icon-surface-hover overlay-text-interactive"
                title={t("overlay.copyToClipboard")}
                style={appearance.iconStyle}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
            {renderMessageText(msg)}
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.msg === next.msg &&
    prev.isLightTheme === next.isLightTheme &&
    prev.appearance === next.appearance &&
    prev.renderMessageText === next.renderMessageText &&
    prev.onCopy === next.onCopy,
);

export default MessageRow;
