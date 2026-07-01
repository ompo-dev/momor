import React, { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import type { PartialBlock } from "@blocknote/core";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./blocknote-theme.css";
import { ImagePlus, Smile } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useResolvedTheme } from "../../hooks/useResolvedTheme";
import { momorDarkTheme, momorLightTheme } from "./blocknote-theme";
import IconPicker from "./IconPicker";
import { isImageIcon, fileToDataUrl } from "./iconUtils";

const AUTOSAVE_MS = 600;

interface NoteEditorProps {
  noteId: string;
}

/**
 * Loads a note then mounts the BlockNote editor with its content as
 * initialContent. The editor lives in a child component (BlockNoteSurface)
 * because useCreateBlockNote needs the content at creation time, and the
 * note loads asynchronously.
 */
const NoteEditor: React.FC<NoteEditorProps> = ({ noteId }) => {
  const { t } = useTranslation();
  const { data: note, isLoading } = useQuery({
    queryKey: ["note", noteId],
    queryFn: () => window.electronAPI.noteGet(noteId),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
        {t("workspace.loading")}
      </div>
    );
  }

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
        {t("workspace.noteNotFound")}
      </div>
    );
  }

  let initialContent: PartialBlock[] | undefined;
  try {
    const parsed = JSON.parse(note.contentJson || "[]");
    initialContent = Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    initialContent = undefined;
  }

  return (
    <BlockNoteSurface
      key={noteId}
      noteId={noteId}
      initialTitle={note.title}
      initialIcon={note.icon}
      initialCover={note.cover}
      initialContent={initialContent}
    />
  );
};

interface BlockNoteSurfaceProps {
  noteId: string;
  initialTitle: string;
  initialIcon: string | null;
  initialCover: string | null;
  initialContent: PartialBlock[] | undefined;
}

const BlockNoteSurface: React.FC<BlockNoteSurfaceProps> = ({
  noteId,
  initialTitle,
  initialIcon,
  initialCover,
  initialContent,
}) => {
  const { t } = useTranslation();
  const isLight = useResolvedTheme() === "light";
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initialTitle);
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const [cover, setCover] = useState<string | null>(initialCover);

  const editor = useCreateBlockNote({ initialContent });

  const contentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const invalidateTree = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["workspace-tree"] }),
    [queryClient],
  );

  const persistContent = useCallback(async () => {
    try {
      const blocks = editor.document;
      const markdown = await editor.blocksToMarkdownLossy(blocks);
      await window.electronAPI.noteUpdate(noteId, {
        contentJson: JSON.stringify(blocks),
        contentText: markdown,
      });
    } catch (err) {
      console.error("[NoteEditor] Failed to persist content:", err);
    }
  }, [editor, noteId]);

  const handleContentChange = useCallback(() => {
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(persistContent, AUTOSAVE_MS);
  }, [persistContent]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      if (titleTimer.current) clearTimeout(titleTimer.current);
      titleTimer.current = setTimeout(async () => {
        await window.electronAPI.noteUpdate(noteId, {
          title: value.trim() || "Untitled",
        });
        invalidateTree();
      }, AUTOSAVE_MS);
    },
    [noteId, invalidateTree],
  );

  const setIconValue = useCallback(
    async (value: string | null) => {
      setIcon(value);
      await window.electronAPI.noteUpdate(noteId, { icon: value });
      invalidateTree(); // sidebar shows the icon
    },
    [noteId, invalidateTree],
  );

  const setCoverValue = useCallback(
    async (value: string | null) => {
      setCover(value);
      await window.electronAPI.noteUpdate(noteId, { cover: value });
    },
    [noteId],
  );

  const onPickCoverFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        const url = await fileToDataUrl(file);
        void setCoverValue(url);
      } catch (err) {
        console.error("[NoteEditor] cover read failed:", err);
      }
    },
    [setCoverValue],
  );

  const onUploadIconFile = useCallback(
    async (file: File) => {
      try {
        const url = await fileToDataUrl(file);
        void setIconValue(url);
      } catch (err) {
        console.error("[NoteEditor] icon read failed:", err);
      }
    },
    [setIconValue],
  );

  // Flush pending saves on unmount / note switch.
  useEffect(() => {
    return () => {
      if (contentTimer.current) {
        clearTimeout(contentTimer.current);
        void persistContent();
      }
      if (titleTimer.current) clearTimeout(titleTimer.current);
    };
  }, [persistContent]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      {/* Cover banner */}
      {cover && (
        <div className="group/cover relative h-52 w-full overflow-hidden bg-bg-secondary">
          <img src={cover} alt="" className="h-full w-full object-cover" />
          <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover/cover:opacity-100">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="rounded-md bg-black/50 px-2 py-1 text-[11px] font-medium text-white backdrop-blur hover:bg-black/70"
            >
              {t("workspace.changeCover")}
            </button>
            <button
              type="button"
              onClick={() => void setCoverValue(null)}
              className="rounded-md bg-black/50 px-2 py-1 text-[11px] font-medium text-white backdrop-blur hover:bg-black/70"
            >
              {t("workspace.remove")}
            </button>
          </div>
        </div>
      )}

      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void onPickCoverFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      <div className="momor-note-editor max-w-3xl mx-auto px-12 pb-16">
        {/* Icon (emoji or image), overlapping the cover when present.
            relative+z-10 so it paints ABOVE the positioned cover banner. */}
        {icon && (
          <div className={`relative z-10 ${cover ? "-mt-12 mb-2" : "pt-12 mb-2"}`}>
            <IconPicker
              hasIcon
              onSelectEmoji={(e) => void setIconValue(e)}
              onUploadImage={onUploadIconFile}
              onRemove={() => void setIconValue(null)}
            >
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg hover:bg-accent/40 p-1 transition-colors"
                title={t("workspace.changeIcon")}
              >
                {isImageIcon(icon) ? (
                  <img
                    src={icon}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ) : (
                  <span className="text-[64px] leading-none">{icon}</span>
                )}
              </button>
            </IconPicker>
          </div>
        )}

        {/* Add icon / add cover toolbar (shows on hover, like Notion) */}
        <div className={`group/meta ${icon ? "" : cover ? "pt-6" : "pt-12"}`}>
          <div className="flex items-center gap-2 h-7 mb-1 opacity-0 transition-opacity group-hover/meta:opacity-100">
            {!icon && (
              <IconPicker
                hasIcon={false}
                onSelectEmoji={(e) => void setIconValue(e)}
                onUploadImage={onUploadIconFile}
                onRemove={() => void setIconValue(null)}
              >
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-text-tertiary hover:bg-accent/60 hover:text-text-secondary"
                >
                  <Smile size={14} />
                  {t("workspace.addIcon")}
                </button>
              </IconPicker>
            )}
            {!cover && (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-text-tertiary hover:bg-accent/60 hover:text-text-secondary"
              >
                <ImagePlus size={14} />
                {t("workspace.addCover")}
              </button>
            )}
          </div>

          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder={t("workspace.untitled")}
            className="w-full bg-transparent text-4xl font-bold text-text-primary placeholder:text-text-tertiary outline-none mb-6"
          />
        </div>

        <div className="-mx-3">
          <BlockNoteView
            editor={editor}
            theme={isLight ? momorLightTheme : momorDarkTheme}
            onChange={handleContentChange}
          />
        </div>
      </div>
    </div>
  );
};

export default NoteEditor;
