import React, { useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { EMOJI_GROUPS } from "./iconUtils";

interface IconPickerProps {
  children: React.ReactNode; // trigger element
  hasIcon: boolean;
  onSelectEmoji: (emoji: string) => void;
  onUploadImage: (file: File) => void;
  onRemove: () => void;
}

const IconPicker: React.FC<IconPickerProps> = ({
  children,
  hasIcon,
  onSelectEmoji,
  onUploadImage,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border p-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-text-secondary hover:bg-accent/60"
          >
            <Upload size={13} />
            {t("workspace.uploadImage")}
          </button>
          {hasIcon && (
            <button
              type="button"
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-text-tertiary hover:bg-accent/60"
            >
              <Trash2 size={13} />
              {t("workspace.remove")}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUploadImage(file);
                setOpen(false);
              }
              e.target.value = "";
            }}
          />
        </div>
        <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                {group.label}
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSelectEmoji(emoji);
                      setOpen(false);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] hover:bg-accent/60"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default IconPicker;
