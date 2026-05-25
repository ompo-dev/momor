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

const STT_KIND_META: Record<
  string,
  { label: string; description: string }
> = {
  deepgram: { label: "Deepgram", description: "Streaming, baixa latência" },
  groq: { label: "Groq Whisper", description: "Whisper na nuvem Groq" },
  openai: { label: "OpenAI Whisper", description: "API Whisper / Realtime" },
  google: { label: "Google Cloud", description: "Conta de serviço JSON" },
  "local-whisper": {
    label: "Local Whisper",
    description: "100% no dispositivo",
  },
  elevenlabs: { label: "ElevenLabs", description: "Scribe / streaming" },
  azure: { label: "Azure Speech", description: "Região + chave" },
  soniox: { label: "Soniox", description: "Streaming multilíngue" },
  ibmwatson: { label: "IBM Watson", description: "Speech to Text" },
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
  const available = Object.entries(STT_KIND_META).filter(
    ([kind]) => !existingKinds.includes(kind),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
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
              {available.map(([kind, meta]) => (
                <Button
                  key={kind}
                  type="button"
                  variant="outline"
                  className="h-auto flex-col items-start gap-1 px-3 py-3 text-left"
                  onClick={() => {
                    onSelect(kind);
                    onOpenChange(false);
                  }}
                >
                  <span className="text-sm font-medium">{meta.label}</span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {meta.description}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
