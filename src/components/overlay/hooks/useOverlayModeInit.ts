import { useEffect } from "react";

type Setter = (value: any) => void;

interface Deps {
  setActiveModeLabel: Setter;
  setLlmProviderLabel: Setter;
  setLlmPrivacyLabel: Setter;
  setActionButtonMode: Setter;
  formatProviderLabel: (...args: any[]) => any;
}

/** Mount-time init + live listeners: active mode label, LLM route label, action-button mode. Verbatim bodies (each deps []). */
export function useOverlayModeInit({
  setActiveModeLabel,
  setLlmProviderLabel,
  setLlmPrivacyLabel,
  setActionButtonMode,
  formatProviderLabel,
}: Deps) {
  useEffect(() => {
    // Load initial active mode name
    window.electronAPI
      ?.modesGetActive?.()
      .then((mode: { name: string } | null) =>
        setActiveModeLabel(mode?.name ?? null),
      )
      .catch(() => {});
    // Live-update whenever mode is activated/deactivated
    const unsub = window.electronAPI?.onModeChanged?.(
      (data: { id: string | null; name: string | null }) => {
        setActiveModeLabel(data.name);
      },
    );
    return () => unsub?.();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadLlmRoute = async () => {
      const config = await window.electronAPI
        ?.getCurrentLlmConfig?.()
        .catch(() => null);
      if (!mounted || !config) return;
      setLlmProviderLabel(formatProviderLabel(config.provider));
      setLlmPrivacyLabel(
        config.provider === "ollama" || config.provider === "codex-cli"
          ? "Local/private route"
          : config.provider === "custom"
            ? "Custom endpoint route"
            : "Cloud LLM route",
      );
    };
    loadLlmRoute();
    const unsub = window.electronAPI?.onModelChanged?.(() => {
      loadLlmRoute();
    });
    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    // Load persisted mode
    window.electronAPI
      ?.getActionButtonMode?.()
      ?.then((mode: "recap" | "brainstorm") => {
        if (mode) setActionButtonMode(mode);
      })
      .catch(() => {});

    // Listen for live changes from SettingsPopup / IPC
    const unsubscribe = window.electronAPI?.onActionButtonModeChanged?.(
      (mode: "recap" | "brainstorm") => {
        setActionButtonMode(mode);
      },
    );
    return () => {
      unsubscribe?.();
    };
  }, []);
}
