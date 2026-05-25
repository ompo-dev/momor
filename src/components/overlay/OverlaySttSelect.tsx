import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Loader2, Mic } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  loadAvailableSttProfiles,
  readCachedSttProfiles,
  type SttProfileOption,
} from "@/lib/loadAvailableSttProfiles";

interface OverlaySttSelectProps {
  currentProfileId: string | null;
  currentLabel: string;
  onSelect: (profileId: string) => void;
  className?: string;
  controlStyle?: React.CSSProperties;
}

export function OverlaySttSelect({
  currentProfileId,
  currentLabel,
  onSelect,
  className,
  controlStyle,
}: OverlaySttSelectProps) {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<SttProfileOption[]>(
    readCachedSttProfiles,
  );
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setProfiles(await loadAvailableSttProfiles());
    } catch (e) {
      console.error("Failed to load STT profiles:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  const configured = profiles.filter((p) => p.configured);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-stt-selector-toggle="true"
          className={cn(
            "h-7 max-w-[130px] gap-1.5 rounded-lg px-2.5 text-xs font-medium",
            className,
          )}
          style={controlStyle}
        >
          <Mic className="h-3 w-3 shrink-0 opacity-70" />
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
        {isLoading && configured.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            …
          </div>
        ) : configured.length === 0 ? (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground">
            Nenhum STT configurado.
          </p>
        ) : (
          <ScrollArea className="max-h-[220px]">
            <div className="flex flex-col gap-0.5 p-0.5">
              {configured.map((profile) => {
                const selected = currentProfileId === profile.id;
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
                    onClick={() => {
                      onSelect(profile.id);
                      setOpen(false);
                    }}
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
