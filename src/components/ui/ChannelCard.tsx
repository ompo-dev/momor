import React, { useState } from "react";
import type { SttErrorCategory } from "../../lib/sttErrorMapper";

interface ChannelCardProps {
  /** Channel name displayed in header */
  name: string;
  /** Channel status */
  status: "connected" | "reconnecting" | "failed";
  /** STT provider name (e.g. 'google', 'openai', 'deepgram') */
  provider?: string;
  /** Raw error string */
  error?: string;
  /** Categorized error info (title + body) */
  errorCategory?: SttErrorCategory | null;
  /** SVG icon for each status */
  iconConnected: React.ReactNode;
  iconReconnecting: React.ReactNode;
  iconFailed: React.ReactNode;
}

const providerLabel = (provider?: string): string => {
  if (!provider || provider === "none") return "";
  const labels: Record<string, string> = {
    google: "Google",
    groq: "Groq",
    openai: "OpenAI",
    deepgram: "Deepgram",
    elevenlabs: "ElevenLabs",
    azure: "Azure",
    ibmwatson: "IBM Watson",
    soniox: "Soniox",
    momor: "Momor Pro",
  };
  return labels[provider.toLowerCase()] || provider;
};

const ChannelCard: React.FC<ChannelCardProps> = ({
  name,
  status,
  provider,
  error,
  errorCategory,
  iconConnected,
  iconReconnecting,
  iconFailed,
}) => {
  const [copied, setCopied] = useState(false);

  const cleanedError = error?.replace(/\s*\(\d+ consecutive errors\):?/gi, "");

  const handleCopy = () => {
    if (cleanedError) {
      navigator.clipboard.writeText(cleanedError);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const icon =
    status === "failed"
      ? iconFailed
      : status === "reconnecting"
        ? iconReconnecting
        : iconConnected;

  const statusLabel =
    status === "connected"
      ? "Operational"
      : status === "reconnecting"
        ? "Reconnecting..."
        : "Error";
  const label = providerLabel(provider);

  return (
    <div
      className={`rounded-md border transition-all duration-300 ${
        status === "failed"
          ? "border-red-500/20 bg-red-500/[0.05]"
          : status === "reconnecting"
            ? "border-amber-500/20 bg-amber-500/[0.045]"
            : "border-border-subtle/80 bg-background/45"
      }`}
    >
      <div className="space-y-2.5 p-3">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-sm border ${
              status === "failed"
                ? "border-red-500/20 bg-red-500/10"
                : status === "reconnecting"
                  ? "border-amber-500/20 bg-amber-500/10"
                  : "border-border-subtle/80 bg-background/55"
            }`}
          >
            <div
              className={`w-4 h-4 ${
                status === "failed"
                  ? "text-red-400"
                  : status === "reconnecting"
                    ? "text-amber-400 animate-spin"
                    : "text-sky-400"
              }`}
            >
              {icon}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`text-[11px] font-semibold ${
                status === "failed"
                  ? "text-red-400/90"
                  : status === "reconnecting"
                    ? "text-amber-400/90"
                    : "overlay-text-primary"
              }`}
            >
              {name}
            </p>
            <p className="truncate text-[10px] overlay-text-muted">
              {statusLabel}
            </p>
            {label && (
              <p className="mt-0.5 text-[9px] overlay-text-muted opacity-60">
                via {label}
              </p>
            )}
          </div>
        </div>

        {status === "failed" && errorCategory && (
          <div className="space-y-1">
            <p className="text-[12px] font-medium overlay-text-primary leading-snug">
              {errorCategory.title}
            </p>
            <p className="text-[10.5px] leading-relaxed overlay-text-secondary">
              {errorCategory.body}
            </p>
          </div>
        )}

        {error && (
          <div className="border-t border-border-subtle/70 pt-1.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] font-medium tracking-wide overlay-text-muted opacity-60">
                Details
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className="rounded-sm p-1 transition-all opacity-60 hover:bg-background/65 hover:opacity-100"
                title={copied ? "Copied" : "Copy details"}
              >
                <svg
                  className="w-3 h-3 overlay-text-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
            <code className="block max-h-12 overflow-y-auto break-words rounded-sm border border-border-subtle/70 bg-background/60 px-2 py-1.5 font-mono text-[10px] leading-relaxed overlay-text-secondary overflow-wrap-anywhere scrollbar-none">
              {cleanedError}
            </code>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelCard;
