import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, CheckCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ApiKeyTestRowStatus = "idle" | "testing" | "success" | "error";

interface ApiKeysListEditorProps {
  /** Persisted keys from backend — used to reset the editor after load/save. */
  keys: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
  testResults?: ApiKeyTestRowStatus[];
  testErrors?: string[];
}

function toPersistedKeys(rows: string[]): string[] {
  return rows.map((row) => row.trim()).filter(Boolean);
}

function toEditorRows(keys: string[]): string[] {
  return keys.length > 0 ? [...keys] : [""];
}

export function ApiKeysListEditor({
  keys,
  onChange,
  disabled = false,
  testResults = [],
  testErrors = [],
}: ApiKeysListEditorProps) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<string[]>(() => toEditorRows(keys));
  const keysSignature = toPersistedKeys(keys).join("\u0000");

  useEffect(() => {
    setRows(toEditorRows(keys));
  }, [keysSignature]);

  const emitPersistedKeys = (nextRows: string[]) => {
    onChange(toPersistedKeys(nextRows));
  };

  const updateRow = (index: number, value: string) => {
    const next = rows.map((row, i) => (i === index ? value : row));
    setRows(next);
    emitPersistedKeys(next);
  };

  const addRow = () => {
    setRows((prev) => [...prev, ""]);
  };

  const removeRow = (index: number) => {
    const next = rows.length <= 1 ? [""] : rows.filter((_, i) => i !== index);
    setRows(next);
    emitPersistedKeys(next);
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium text-foreground">
          {t("providers.apiKeysList.title")}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {t("providers.apiKeysList.hint")}
        </p>
      </div>

      {rows.map((row, index) => {
        const rowStatus = testResults[index] ?? "idle";
        const rowError = testErrors[index];
        return (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-5 shrink-0 text-center text-[10px] font-medium text-muted-foreground">
                {index + 1}
              </span>
              <Input
                type="text"
                value={row}
                onChange={(e) => updateRow(index, e.target.value)}
                placeholder={t("providers.apiKeysList.placeholder", {
                  index: index + 1,
                })}
                className="h-9 flex-1 font-mono text-xs"
                disabled={disabled}
                spellCheck={false}
                autoComplete="off"
              />
              {rowStatus === "testing" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : rowStatus === "success" ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : rowStatus === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(index)}
                disabled={disabled}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            {rowError ? (
              <p className="pl-6 text-[10px] text-destructive">{rowError}</p>
            ) : null}
          </div>
        );
      })}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2 text-xs text-muted-foreground")}
        onClick={addRow}
        disabled={disabled}
      >
        <Plus className="mr-1 h-3 w-3" />
        {t("providers.apiKeysList.add")}
      </Button>
    </div>
  );
}

/** @deprecated Use ApiKeysListEditor */
export { ApiKeysListEditor as BackupKeysEditor };
