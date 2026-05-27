import React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic } from "lucide-react";
import { SttBrandIconBadge } from "./SttBrandIcon";
import { sttKindLabel } from "./integrationDisplay";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/50 px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mic className="h-4 w-4" />
            {t("settings.audio.sttAddDialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("settings.audio.sttAddDialogDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-3">
          {available.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("settings.audio.sttAllAdded")}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-3 px-3 py-3 text-left"
                  onClick={() => {
                    onSelect(kind);
                    onOpenChange(false);
                  }}
                >
                  <SttBrandIconBadge kind={kind} />
                  <div className="min-w-0">
                    <span className="block text-sm font-medium">
                      {sttKindLabel(kind)}
                    </span>
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {t(STT_KIND_DESC_KEY[kind] ?? kind)}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
