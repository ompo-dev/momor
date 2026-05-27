import { Cpu, Mic, Server } from "lucide-react";
import {
  SiGooglecloud,
  SiOpenai,
} from "react-icons/si";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { cn } from "@/lib/utils";

const GROQ_FAVICON = "https://groq.com/favicon.svg";
const DEEPGRAM_ICON = "https://cdn.simpleicons.org/deepgram/13EF93";
const ELEVENLABS_ICON = "https://cdn.simpleicons.org/elevenlabs/FFFFFF";
const SONIOX_ICON = "https://soniox.com/favicon.ico";
const AZURE_ICON = "https://cdn.simpleicons.org/microsoftazure/0078D4";

export type SttKindId =
  | "deepgram"
  | "groq"
  | "openai"
  | "google"
  | "local-whisper"
  | "elevenlabs"
  | "azure"
  | "soniox"
  | "ibmwatson"
  | string;

export interface SttBrandIconProps {
  kind: SttKindId;
  className?: string;
  size?: "sm" | "md";
}

export function SttBrandIcon({
  kind,
  className,
  size = "md",
}: SttBrandIconProps) {
  const theme = useResolvedTheme();
  const isLight = theme === "light";
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  switch (kind) {
    case "groq":
      return (
        <img
          src={GROQ_FAVICON}
          alt=""
          aria-hidden
          className={cn(dim, "object-contain", className)}
        />
      );
    case "openai":
      return (
        <SiOpenai
          aria-hidden
          className={cn(dim, isLight ? "text-black" : "text-white", className)}
        />
      );
    case "google":
      return (
        <SiGooglecloud
          aria-hidden
          className={cn(dim, "text-[#4285F4]", className)}
        />
      );
    case "deepgram":
      return (
        <img
          src={DEEPGRAM_ICON}
          alt=""
          aria-hidden
          className={cn(dim, "object-contain", className)}
        />
      );
    case "elevenlabs":
      return (
        <img
          src={ELEVENLABS_ICON}
          alt=""
          aria-hidden
          className={cn(dim, "object-contain invert dark:invert-0", className)}
        />
      );
    case "azure":
      return (
        <img
          src={AZURE_ICON}
          alt=""
          aria-hidden
          className={cn(dim, "object-contain", className)}
        />
      );
    case "soniox":
      return (
        <img
          src={SONIOX_ICON}
          alt=""
          aria-hidden
          className={cn(dim, "rounded-sm object-contain", className)}
        />
      );
    case "ibmwatson":
      return (
        <Server aria-hidden className={cn(dim, "text-[#0F62FE]", className)} />
      );
    case "local-whisper":
      return (
        <Cpu aria-hidden className={cn(dim, "text-muted-foreground", className)} />
      );
    default:
      return (
        <Mic aria-hidden className={cn(dim, "text-muted-foreground", className)} />
      );
  }
}

export function SttBrandIconBadge({ kind }: { kind: SttKindId }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/80">
      <SttBrandIcon kind={kind} size="md" />
    </div>
  );
}
