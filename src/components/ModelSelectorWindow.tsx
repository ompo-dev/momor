import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  loadAvailableModels,
  readCachedModels,
  type ModelOption,
} from "../lib/loadAvailableModels";
import { useResolvedTheme } from "../hooks/useResolvedTheme";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import { cn } from "@/lib/utils";

const ModelSelectorWindow = () => {
  const isLight = useResolvedTheme() === "light";
  const [currentModel, setCurrentModel] = useState<string>(
    () => localStorage.getItem("cached-current-model") || "",
  );
  const [availableModels, setAvailableModels] =
    useState<ModelOption[]>(readCachedModels);
  const [isLoading, setIsLoading] = useState<boolean>(
    () => availableModels.length === 0,
  );

  // Load Data
  useEffect(() => {
    const loadModels = async () => {
      try {
        if (availableModels.length === 0) {
          setIsLoading(true);
        }

        const models = await loadAvailableModels();
        setAvailableModels(models);

        const config = await window.electronAPI?.getCurrentLlmConfig?.();
        if (config?.model) {
          setCurrentModel(config.model);
          localStorage.setItem("cached-current-model", config.model);
        }
      } catch (err) {
        console.error("Failed to load models:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
    window.addEventListener("focus", loadModels);

    // Listen for changes
    const unsubscribe = window.electronAPI?.onModelChanged?.(
      (modelId: string) => {
        setCurrentModel(modelId);
      },
    );
    return () => {
      unsubscribe?.();
      window.removeEventListener("focus", loadModels);
    };
  }, []);

  const handleSelectFn = (modelId: string) => {
    setCurrentModel(modelId);
    localStorage.setItem("cached-current-model", modelId);

    window.electronAPI
      ?.setModel(modelId)
      .catch((err: any) => console.error("Failed to set model:", err));
  };

  return (
    <div className="w-fit h-fit bg-transparent flex flex-col">
      <Card className="w-[160px] h-[220px] border-border bg-card/95 backdrop-blur-md shadow-2xl p-1 flex flex-col animate-scale-in origin-top-left">
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-xs">Loading models...</span>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="flex flex-col gap-0.5 p-1">
            {availableModels.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-muted-foreground">
                No models connected.
                <br />
                Check Settings.
              </p>
            ) : (
              availableModels.map((model) => {
                const isSelected = currentModel === model.id;
                return (
                  <Button
                    key={model.id}
                    variant={isSelected ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => handleSelectFn(model.id)}
                    className={cn(
                      "w-full justify-between h-auto py-2 px-3 font-normal",
                      isSelected && "bg-accent",
                    )}
                  >
                    <span className="text-[12px] truncate flex-1 min-w-0 text-left">
                      {model.name}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0 ml-2 text-primary" />
                    )}
                  </Button>
                );
              })
            )}
            </div>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
};

export default ModelSelectorWindow;
