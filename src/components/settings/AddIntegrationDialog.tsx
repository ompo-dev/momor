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
import { ProviderBrandIcon } from "./ProviderBrandIcon";

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("providers.addIntegration")}</DialogTitle>
          <DialogDescription>
            {t("providers.addIntegrationDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {available.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("providers.allIntegrationsAdded")}
            </p>
          ) : (
            available.map((id) => {
              const meta = INTEGRATION_META[id];
              return (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  className="h-auto justify-start gap-3 px-4 py-3 text-left"
                  onClick={() => {
                    onSelect(id);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background">
                    <ProviderBrandIcon providerId={id} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {meta.category === "cloud"
                        ? t("providers.categoryCloud")
                        : t("providers.categoryLocal")}
                    </p>
                  </div>
                </Button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
