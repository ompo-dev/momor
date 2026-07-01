import React, { useEffect, useState } from "react";
import {
  ChevronsUpDown,
  Settings,
  UserCog,
  Sparkles,
  Check,
  Plug,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  loadUserSessionData,
  getActiveProfile,
  getActiveAiProfileId,
  setActiveAiProfileId,
  USER_CONTEXT_CHANGED_EVENT,
} from "../../lib/userSessionContext";

interface WorkspaceUserFooterProps {
  onOpenSettings: (tab?: string) => void;
  onOpenUserContext: () => void;
}

interface ProfileLite {
  id: string;
  name: string;
}

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AI";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

/**
 * NavUser-style footer pinned to the bottom of the workspace sidebar.
 * Holds what used to live in the top header: the AI profile switcher,
 * the user context, and settings. Menu opens upward.
 */
const WorkspaceUserFooter: React.FC<WorkspaceUserFooterProps> = ({
  onOpenSettings,
  onOpenUserContext,
}) => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [activeName, setActiveName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = () => {
    try {
      const data = loadUserSessionData();
      setProfiles(data.profiles.map((p) => ({ id: p.id, name: p.name })));
      setActiveName(getActiveProfile(data).name);
      setActiveId(getActiveAiProfileId());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(USER_CONTEXT_CHANGED_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(USER_CONTEXT_CHANGED_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  return (
    <div className="px-2 py-2 border-t border-border-subtle">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left",
              "hover:bg-accent/60 data-[state=open]:bg-accent transition-colors",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-semibold text-white">
              {initialsOf(activeName || "AI")}
            </span>
            <span className="grid flex-1 min-w-0 leading-tight">
              <span className="truncate text-[13px] font-medium text-text-primary">
                {activeName || t("workspace.aiProfile")}
              </span>
              <span className="truncate text-[11px] text-text-tertiary">
                {t("workspace.aiProfile")}
              </span>
            </span>
            <ChevronsUpDown size={14} className="ml-auto shrink-0 text-text-tertiary" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={6}
          className="w-56"
        >
          {profiles.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[11px] text-text-tertiary">
                {t("workspace.switchProfile")}
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                {profiles.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setActiveAiProfileId(p.id)}
                  >
                    <Sparkles size={14} className="mr-2 text-text-secondary" />
                    <span className="flex-1 truncate">{p.name}</span>
                    {p.id === activeId && (
                      <Check size={14} className="ml-2 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onOpenUserContext}>
              <UserCog size={14} className="mr-2" />
              {t("workspace.userContext")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenSettings("api")}>
              <Plug size={14} className="mr-2" />
              {t("workspace.aiProviders")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenSettings()}>
              <Settings size={14} className="mr-2" />
              {t("workspace.settings")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default WorkspaceUserFooter;
