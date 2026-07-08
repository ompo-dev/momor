import React from "react";
import { useTranslation } from "react-i18next";
import { Image, Copy } from "lucide-react";
import { ZedThreadMessage } from "../zed/ZedThreadMessage";
import { ZedIconButton } from "../zed/ZedIconButton";

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
    onCopy,
    renderMessageText,
  }: MessageRowProps) {
    const { t } = useTranslation();
    const isCodeMsg =
      msg.role === "system" && (msg.isCode || msg.text.includes("```"));
    const copyAction =
      msg.role === "system" && !msg.isStreaming ? (
        <ZedIconButton
          icon={<Copy />}
          size="sm"
          styleVariant="subtle"
          onClick={() => onCopy(msg.text)}
          aria-label={t("overlay.copyToClipboard")}
          title={t("overlay.copyToClipboard")}
        />
      ) : null;

    if (msg.role === "interviewer") {
      return (
        <div
          className="w-full"
          {...(isCodeMsg ? { "data-code-msg": "true" } : {})}
        >
          <div className="animate-fade-in-up rounded-sm border-l border-border-subtle/80 pl-3 pr-1 py-0.5 text-[12.5px] leading-6 overlay-text-secondary">
            <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] overlay-text-muted">
              {t("overlay.interviewer")}
              {msg.isStreaming && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            {renderMessageText(msg)}
          </div>
        </div>
      );
    }

    if (msg.role === "user") {
      return (
        <div
          className="w-full"
          {...(isCodeMsg ? { "data-code-msg": "true" } : {})}
        >
          <div className="animate-fade-in-up">
            <ZedThreadMessage
              role="user"
              label={t("overlay.youLabel", { defaultValue: "You" })}
              className="max-w-full"
            >
              {msg.hasScreenshot && (
                <div className="mb-2 flex items-center gap-1.5 border-b border-border/70 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  <Image className="h-3 w-3" />
                  <span>{t("overlay.screenshotAttached")}</span>
                </div>
              )}
              {renderMessageText(msg)}
            </ZedThreadMessage>
          </div>
        </div>
      );
    }

    return (
      <div
        className="w-full"
        {...(isCodeMsg ? { "data-code-msg": "true" } : {})}
      >
        <div className="animate-fade-in-up">
          <ZedThreadMessage
            role="agent"
            label={
              <span className="inline-flex items-center gap-1.5">
                <span>{t("overlay.agentLabel", { defaultValue: "Momor" })}</span>
                {msg.isStreaming && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </span>
            }
            actions={copyAction}
            className="max-w-full"
          >
            {renderMessageText(msg)}
          </ZedThreadMessage>
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
