import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  IntegrationCardDivider,
  IntegrationCardSection,
} from "./IntegrationCardSection";

interface SttLiveTestPanelProps {
  profileId: string;
  disabled?: boolean;
}

export function SttLiveTestPanel({ profileId, disabled }: SttLiveTestPanelProps) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const unsubsRef = useRef<Array<() => void>>([]);

  const cleanupListeners = useCallback(() => {
    for (const u of unsubsRef.current) u();
    unsubsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      cleanupListeners();
      void window.electronAPI?.stopSttLiveTest?.();
    };
  }, [cleanupListeners]);

  const stopRecording = useCallback(async () => {
    setRecording(false);
    cleanupListeners();
    await window.electronAPI?.stopSttLiveTest?.();
  }, [cleanupListeners]);

  const startRecording = useCallback(async () => {
    if (disabled || recording) return;
    setError("");
    setTranscript("");
    setLevel(0);

    try {
      const result = await window.electronAPI?.startSttLiveTest?.(profileId);
      if (!result?.success) {
        setError(result?.error || t("common.connectionFailed"));
        return;
      }

      setRecording(true);

      if (window.electronAPI?.onSttLiveTestLevel) {
        unsubsRef.current.push(
          window.electronAPI.onSttLiveTestLevel((lvl: number) => {
            setLevel(Math.max(0, Math.min(1, lvl)));
          }),
        );
      }
      if (window.electronAPI?.onSttLiveTestTranscript) {
        unsubsRef.current.push(
          window.electronAPI.onSttLiveTestTranscript(
            (data: { text: string; final: boolean }) => {
              if (data.text) {
                setTranscript((prev) =>
                  data.final ? data.text : prev ? `${prev} ${data.text}` : data.text,
                );
              }
              if (data.final) void stopRecording();
            },
          ),
        );
      }
      if (window.electronAPI?.onSttLiveTestError) {
        unsubsRef.current.push(
          window.electronAPI.onSttLiveTestError((msg: string) => {
            setError(msg);
            void stopRecording();
          }),
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.connectionFailed"));
      await stopRecording();
    }
  }, [disabled, profileId, recording, stopRecording, t]);

  const bars = Array.from({ length: 12 }, (_, i) => {
    const threshold = (i + 1) / 12;
    return level >= threshold * 0.85;
  });

  return (
    <>
      <IntegrationCardDivider />
      <IntegrationCardSection
        title={t("integrations.testTranscription")}
        description={t("integrations.testTranscriptHint", {
          defaultValue: "Fale normalmente por alguns segundos para validar o STT.",
        })}
      >
        <div className="rounded-sm border border-border-subtle/80 bg-background/16 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-sm border transition-colors",
                  recording
                    ? "border-primary/35 bg-primary/10 text-primary"
                    : "border-border-subtle/80 bg-background/24 text-muted-foreground",
                )}
              >
                {recording ? (
                  <Volume2 className="h-4 w-4 animate-pulse" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </div>
              <div className="flex items-end gap-0.5 h-6">
                {bars.map((active, i) => (
                  <span
                    key={i}
                    className={cn(
                      "w-1 rounded-full transition-all duration-75",
                      active
                        ? "h-full bg-primary"
                        : "h-1.5 bg-border-subtle",
                    )}
                  />
                ))}
              </div>
            </div>

            {recording ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-sm border-border-subtle/80 bg-background/20 text-[11px]"
                onClick={() => void stopRecording()}
              >
                <Square className="mr-1.5 h-3 w-3 fill-current" />
                {t("integrations.stopRecording")}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-8 rounded-sm text-[11px]"
                disabled={disabled}
                onClick={() => void startRecording()}
              >
                <Mic className="mr-1.5 h-3 w-3" />
                {t("integrations.startRecording")}
              </Button>
            )}
          </div>

          <div
            className={cn(
              "mt-3 min-h-[3rem] rounded-sm border px-3 py-2.5 text-sm leading-relaxed",
              transcript
                ? "border-border-subtle/80 bg-background/20 text-foreground"
                : "border-border-subtle/70 bg-background/8 text-[11px] italic text-muted-foreground",
              error && "border-destructive/40 text-destructive",
            )}
          >
            {error || transcript || t("integrations.testTranscriptPlaceholder")}
          </div>
        </div>
      </IntegrationCardSection>
    </>
  );
}
