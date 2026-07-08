import React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mic } from "lucide-react";
import { SttBrandIconBadge } from "./SttBrandIcon";
import { sttKindLabel } from "./integrationDisplay";
import { ZedListItem } from "../zed/ZedListItem";

const STT_KINDS = [
  "deepgram",
  "groq",
  "openai",
  "google",
  "local-whisper",
  "elevenlabs",
  "azure",
  "soniox",
  "ibmwatson",
] as const;

const STT_KIND_DESC_KEY: Record<string, string> = {
  deepgram: "settings.audio.sttKindDeepgramDesc",
  groq: "settings.audio.sttKindGroqDesc",
  openai: "settings.audio.sttKindOpenaiDesc",
  google: "settings.audio.sttKindGoogleDesc",
  "local-whisper": "settings.audio.sttKindLocalWhisperDesc",
  elevenlabs: "settings.audio.sttKindElevenlabsDesc",
  azure: "settings.audio.sttKindAzureDesc",
  soniox: "settings.audio.sttKindSonioxDesc",
  ibmwatson: "settings.audio.sttKindIbmwatsonDesc",
};

interface AddSttProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingKinds: string[];
  onSelect: (kind: string) => void;
}

export function AddSttProfileDialog({
  open,
  onOpenChange,
  existingKinds,
  onSelect,
}: AddSttProfileDialogProps) {
  const { t } = useTranslation();
  const available = STT_KINDS.filter((kind) => !existingKinds.includes(kind));
  const kindCategory = (kind: string) =>
    kind === "local-whisper"
      ? t("providers.categoryLocal")
      : t("providers.categoryCloud");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] gap-0 overflow-hidden border-border-subtle/80 bg-card/96 p-0 shadow-[0_24px_64px_-42px_rgba(0,0,0,0.85)]">
        <DialogHeader className="border-b border-border-subtle/75 px-4 py-3.5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("settings.audio.sttAdd")}
          </p>
          <DialogTitle className="flex items-center gap-2 text-[15px] font-medium tracking-[-0.01em]">
            <Mic className="h-4 w-4" />
            {t("settings.audio.sttAddDialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-[11px] leading-5">
            {t("settings.audio.sttAddDialogDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-2 py-2">
          {available.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("settings.audio.sttAllAdded")}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {available.map((kind) => (
                <ZedListItem
                  key={kind}
                  spacing="sparse"
                  className="px-2.5 py-2"
                  onClick={() => {
                    onSelect(kind);
                    onOpenChange(false);
                  }}
                  startSlot={<SttBrandIconBadge kind={kind} />}
                  endSlot={
                    <span className="rounded-sm border border-border-subtle/70 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {kindCategory(kind)}
                    </span>
                  }
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground">
                      {sttKindLabel(kind)}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                      {t(STT_KIND_DESC_KEY[kind] ?? kind)}
                    </p>
                  </div>
                </ZedListItem>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
