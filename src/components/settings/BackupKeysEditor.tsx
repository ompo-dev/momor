import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BackupKeysEditorProps {
  maskedKeys?: string[];
  onSave: (keys: string[]) => Promise<void>;
  disabled?: boolean;
}

function isMaskedKey(value: string): boolean {
  return !value.trim() || value.includes("...");
}

export function BackupKeysEditor({
  maskedKeys = [],
  onSave,
  disabled = false,
}: BackupKeysEditorProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(maskedKeys.length > 0 ? maskedKeys : [""]);
  }, [maskedKeys]);

  const updateRow = (index: number, value: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? value : row)));
  };

  const addRow = () => setRows((prev) => [...prev, ""]);

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length <= 1 ? [""] : prev.filter((_, i) => i !== index)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const keys = rows.map((row) => row.trim()).filter((row) => row && !isMaskedKey(row));
      await onSave(keys);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-bg-input/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          {t("providers.backupKeys.title")}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={addRow}
          disabled={disabled}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t("providers.backupKeys.add")}
        </Button>
      </div>
      <p className="text-[11px] leading-snug text-text-secondary">
        {t("providers.backupKeys.hint")}
      </p>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={row}
              onChange={(e) => updateRow(index, e.target.value)}
              placeholder={t("providers.backupKeys.placeholder", {
                index: index + 1,
              })}
              className="h-8 font-mono text-xs"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive"
              onClick={() => removeRow(index)}
              disabled={disabled}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8 text-xs"
        onClick={() => void handleSave()}
        disabled={disabled || saving}
      >
        {saving ? t("providers.backupKeys.saving") : t("providers.backupKeys.save")}
      </Button>
    </div>
  );
}
