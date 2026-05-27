import { Cpu, Terminal } from "lucide-react";
import {
  SiAnthropic,
  SiGooglegemini,
  SiOllama,
  SiOpenai,
} from "react-icons/si";
import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { cn } from "@/lib/utils";
import type { IntegrationId } from "./integrationTypes";

const GROQ_FAVICON = "https://groq.com/favicon.svg";
const DEEPSEEK_ICON = "https://cdn.simpleicons.org/deepseek/4D6BFE";

export interface ProviderBrandIconProps {
  providerId: IntegrationId | string;
  className?: string;
  size?: "sm" | "md";
}

export function ProviderBrandIcon({
  providerId,
  className,
  size = "md",
}: ProviderBrandIconProps) {
  const theme = useResolvedTheme();
  const isLight = theme === "light";
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  switch (providerId) {
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
    case "codex-cli":
      return (
        <SiOpenai
          aria-hidden
          className={cn(dim, isLight ? "text-black" : "text-white", className)}
        />
      );
    case "claude":
    case "openclaude":
      return (
        <SiAnthropic
          aria-hidden
          className={cn(dim, isLight ? "text-black" : "text-white", className)}
        />
      );
    case "gemini":
      return (
        <SiGooglegemini
          aria-hidden
          className={cn(dim, "text-[#4285F4]", className)}
        />
      );
    case "deepseek":
      return (
        <img
          src={DEEPSEEK_ICON}
          alt=""
          aria-hidden
          className={cn(dim, "object-contain", className)}
        />
      );
    case "ollama":
      return <SiOllama aria-hidden className={cn(dim, className)} />;
    case "custom":
      return (
        <Terminal
          aria-hidden
          className={cn(dim, "text-muted-foreground", className)}
        />
      );
    default:
      return (
        <Cpu aria-hidden className={cn(dim, "text-muted-foreground", className)} />
      );
  }
}

export function ProviderBrandIconBadge({
  providerId,
}: {
  providerId: IntegrationId | string;
}) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/80">
      <ProviderBrandIcon providerId={providerId} size="md" />
    </div>
  );
}
