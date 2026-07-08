import React, { useEffect, useRef, useState } from "react";
import { ZedKeyBinding } from "@/components/zed/ZedKeyBinding";
import { cn } from "@/lib/utils";

interface KeyRecorderProps {
  currentKeys: string[];
  onSave: (keys: string[]) => void;
  className?: string;
}

const DISPLAY_KEY_MAP: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

const formatKeysForDisplay = (keys: string[]) =>
  keys.map((key) => DISPLAY_KEY_MAP[key] ?? key);

export const KeyRecorder: React.FC<KeyRecorderProps> = ({
  currentKeys,
  onSave,
  className,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isRecording && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRecording]);

  const stopRecording = () => {
    setIsRecording(false);
    setRecordedKeys([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();
    e.stopPropagation();

    if (
      e.key === "Escape" &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey
    ) {
      stopRecording();
      return;
    }

    const modifiers: string[] = [];
    if (e.metaKey) modifiers.push("⌘");
    if (e.ctrlKey) modifiers.push("⌃");
    if (e.altKey) modifiers.push("⌥");
    if (e.shiftKey) modifiers.push("⇧");

    let mainKey = "";
    if (
      e.key !== "Meta" &&
      e.key !== "Control" &&
      e.key !== "Alt" &&
      e.key !== "Shift"
    ) {
      if (e.code.startsWith("Key")) mainKey = e.key.toUpperCase();
      else if (e.code.startsWith("Digit")) mainKey = e.key;
      else if (e.code === "Space") mainKey = "Space";
      else if (e.key === "Enter") mainKey = "Enter";
      else if (e.key === "Backspace") mainKey = "Backspace";
      else if (e.key.startsWith("Arrow")) mainKey = e.key;
      else mainKey = e.key.toUpperCase();
    }

    if (mainKey) {
      const combo = [...modifiers, mainKey];
      setRecordedKeys(combo);
      setIsRecording(false);
      onSave(combo);
      return;
    }

    setRecordedKeys(modifiers);
  };

  const currentDisplayKeys = formatKeysForDisplay(currentKeys);
  const recordedDisplayKeys = formatKeysForDisplay(recordedKeys);

  return (
    <div className={cn("relative shrink-0", className)}>
      {isRecording ? (
        <div
          ref={inputRef}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onBlur={stopRecording}
          className="inline-flex min-h-8 min-w-[148px] items-center justify-center rounded-sm border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-primary outline-none"
        >
          {recordedDisplayKeys.length > 0 ? (
            <ZedKeyBinding keys={recordedDisplayKeys} />
          ) : (
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Press keys
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsRecording(true)}
          className="inline-flex min-h-8 min-w-[92px] items-center justify-center rounded-sm border border-border-subtle/80 bg-background/55 px-2 py-1.5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60"
        >
          {currentDisplayKeys.length > 0 ? (
            <ZedKeyBinding keys={currentDisplayKeys} />
          ) : (
            <span className="text-[11px] font-medium text-text-tertiary">
              Set shortcut
            </span>
          )}
        </button>
      )}
    </div>
  );
};
