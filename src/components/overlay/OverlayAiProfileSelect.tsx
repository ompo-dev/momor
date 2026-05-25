import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  getActiveAiProfileId,
  loadUserSessionData,
  setActiveAiProfileId,
  USER_CONTEXT_CHANGED_EVENT,
  type AiBehaviorProfile,
} from "@/lib/userSessionContext";
import { syncUserSessionContextToMain } from "@/lib/syncUserSessionContextToMain";

interface OverlayAiProfileSelectProps {
  className?: string;
  controlStyle?: React.CSSProperties;
}

export function OverlayAiProfileSelect({
  className,
  controlStyle,
}: OverlayAiProfileSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<AiBehaviorProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() =>
    getActiveAiProfileId(),
  );

  const refresh = useCallback(() => {
    const data = loadUserSessionData();
    setProfiles(data.profiles);
    setActiveId(getActiveAiProfileId());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener("storage", onChange);
    window.addEventListener(USER_CONTEXT_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, onChange);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  const activeProfile =
    profiles.find((p) => p.id === activeId) ??
    profiles.find((p) => p.isDefault) ??
    profiles[0];

  const currentLabel = activeProfile?.name ?? t("userContext.profileFallback");

  const handleSelect = (profileId: string) => {
    setActiveAiProfileId(profileId);
    setActiveId(profileId);
    void syncUserSessionContextToMain();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-ai-profile-selector-toggle="true"
          className={cn(
            "h-7 max-w-[130px] gap-1.5 rounded-lg px-2.5 text-xs font-medium",
            className,
          )}
          style={controlStyle}
        >
          <Sparkles className="h-3 w-3 shrink-0 opacity-70" />
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={6}
        className="w-[220px] p-1"
        data-stealth-ignore="true"
      >
        {profiles.length === 0 ? (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground">
            {t("userContext.noProfiles")}
          </p>
        ) : (
          <ScrollArea className="max-h-[220px]">
            <div className="flex flex-col gap-0.5 p-0.5">
              {profiles.map((profile) => {
                const selected = activeId === profile.id;
                return (
                  <Button
                    key={profile.id}
                    type="button"
                    variant={selected ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-auto w-full justify-between py-1.5 px-2 font-normal",
                      selected && "bg-accent",
                    )}
                    onClick={() => handleSelect(profile.id)}
                  >
                    <span className="min-w-0 flex-1 truncate text-left text-[12px]">
                      {profile.name}
                      {profile.isDefault ? " ★" : ""}
                    </span>
                    {selected && (
                      <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-primary" />
                    )}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
