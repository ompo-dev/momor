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
import {
  INTEGRATION_META,
  type IntegrationId,
} from "./integrationTypes";
import { ProviderBrandIconBadge } from "./ProviderBrandIcon";

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
    (id) => !hiddenIds.includes(id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/50 px-5 py-4">
          <DialogTitle>{t("providers.addIntegration")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("providers.addIntegrationDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-3">
          {available.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              {t("providers.allIntegrationsAdded")}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((id) => {
                const meta = INTEGRATION_META[id];
                return (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    className="h-auto justify-start gap-3 px-3 py-3 text-left"
                    onClick={() => {
                      onSelect(id);
                      onOpenChange(false);
                    }}
                  >
                    <ProviderBrandIconBadge providerId={id} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {meta.category === "cloud"
                          ? t("providers.categoryCloud")
                          : t("providers.categoryLocal")}
                      </p>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
