import React, { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ScrollArea } from "../ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  loadAvailableModels,
  readCachedModels,
  type ModelOption,
} from "@/lib/loadAvailableModels";
import { getCodexCliModelDisplayName } from "@/utils/modelUtils";

function formatModelLabel(modelId: string): string {
  const codexCliName = getCodexCliModelDisplayName(modelId);
  if (codexCliName) return codexCliName;
  if (modelId.startsWith("ollama-")) return modelId.replace("ollama-", "");
  if (modelId === "gemini-3.1-flash-lite-preview") return "Gemini 3.1 Flash";
  if (modelId === "gemini-3.1-pro-preview") return "Gemini 3.1 Pro";
  if (modelId === "llama-3.3-70b-versatile") return "Groq Llama 3.3";
  if (modelId === "gpt-5.4") return "GPT 5.4";
  if (modelId === "claude-sonnet-4-6") return "Sonnet 4.6";
  return modelId;
}

interface OverlayModelSelectProps {
  currentModel: string;
  onSelect: (modelId: string) => void;
  className?: string;
  controlStyle?: React.CSSProperties;
}

export function OverlayModelSelect({
  currentModel,
  onSelect,
  className,
  controlStyle,
}: OverlayModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelOption[]>(readCachedModels);
  const [isLoading, setIsLoading] = useState(false);

  const refreshModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await loadAvailableModels();
      setModels(loaded);
    } catch (err) {
      console.error("Failed to load models:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshModels();
  }, [open, refreshModels]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-model-selector-toggle="true"
          className={cn(
            "h-7 max-w-[140px] gap-1.5 rounded-lg px-2.5 text-xs font-medium",
            className,
          )}
          style={controlStyle}
        >
          <span className="truncate">{formatModelLabel(currentModel)}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={6}
        className="w-[200px] p-1"
        data-stealth-ignore="true"
      >
        {isLoading && models.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : models.length === 0 ? (
          <p className="px-3 py-3 text-center text-xs text-muted-foreground">
            Nenhum modelo conectado.
          </p>
        ) : (
          <ScrollArea className="max-h-[220px]">
            <div className="flex flex-col gap-0.5 p-0.5">
              {models.map((model) => {
                const selected = currentModel === model.id;
                return (
                  <Button
                    key={model.id}
                    type="button"
                    variant={selected ? "secondary" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-auto w-full justify-between py-1.5 px-2 font-normal",
                      selected && "bg-accent",
                    )}
                    onClick={() => {
                      onSelect(model.id);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate text-left text-[12px]">
                      {model.name}
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
