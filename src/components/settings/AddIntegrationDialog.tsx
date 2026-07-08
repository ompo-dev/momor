import React from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  INTEGRATION_META,
  type IntegrationId,
} from "./integrationTypes";
import { ProviderBrandIconBadge } from "./ProviderBrandIcon";
import { ZedListItem } from "../zed/ZedListItem";

interface AddIntegrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hiddenIds: IntegrationId[];
  onSelect: (id: IntegrationId) => void;
}

export function AddIntegrationDialog({
  open,
  onOpenChange,
  hiddenIds,
  onSelect,
}: AddIntegrationDialogProps) {
  const { t } = useTranslation();
  const available = (Object.keys(INTEGRATION_META) as IntegrationId[]).filter(
    (id) => !hiddenIds.includes(id) && !INTEGRATION_META[id].hidden,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] gap-0 overflow-hidden border-border-subtle/80 bg-card/96 p-0 shadow-[0_24px_64px_-42px_rgba(0,0,0,0.85)]">
        <DialogHeader className="border-b border-border-subtle/75 px-4 py-3.5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("providers.addIntegration")}
          </p>
          <DialogTitle className="text-[15px] font-medium tracking-[-0.01em]">
            {t("providers.integrationsList")}
          </DialogTitle>
          <DialogDescription className="text-[11px] leading-5">
            {t("providers.addIntegrationDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-2 py-2">
          {available.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("providers.allIntegrationsAdded")}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {available.map((id) => {
                const meta = INTEGRATION_META[id];
                return (
                  <ZedListItem
                    key={id}
                    onClick={() => {
                      onSelect(id);
                      onOpenChange(false);
                    }}
                    spacing="sparse"
                    className="px-2.5 py-2"
                    startSlot={<ProviderBrandIconBadge providerId={id} chrome={false} />}
                    endSlot={
                      <span className="rounded-sm border border-border-subtle/70 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {meta.category === "cloud"
                          ? t("providers.categoryCloud")
                          : t("providers.categoryLocal")}
                      </span>
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-foreground">
                        {meta.label}
                      </p>
                      {meta.descriptionKey ? (
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                          {t(meta.descriptionKey)}
                        </p>
                      ) : null}
                    </div>
                  </ZedListItem>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
