import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle,
  Save,
  ChevronDown,
  Check,
  RefreshCw,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  CODEX_CLI_MODEL,
  CODEX_CLI_MODEL_PRESETS,
  codexCliSelectorId,
  STANDARD_CLOUD_MODELS,
  prettifyModelId,
} from "../../utils/modelUtils";
import { validateCurl } from "../../lib/curl-validator";
import { ProviderCard } from "./ProviderCard";
import { CliProviderCard } from "./CliProviderCard";
import { DeepSeekProviderCard } from "./DeepSeekProviderCard";
import { AddIntegrationDialog } from "./AddIntegrationDialog";
import {
  readPinnedIntegrations,
  writePinnedIntegrations,
  type IntegrationId,
} from "./integrationTypes";
import { SettingsSection } from "./layout/SettingsSection";
import {
  SettingsToolbar,
  SETTINGS_CONTROL_CLASS,
} from "./layout/SettingsToolbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CustomProvider {
  id: string;
  name: string;
  curlCommand: string;
  responsePath: string;
}

interface ModelOption {
  id: string;
  name: string;
}

interface ModelSelectProps {
  value: string;
  options: ModelOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

const ModelSelect: React.FC<ModelSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = "Select model",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.id === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-40 bg-bg-input border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary flex items-center justify-between hover:bg-bg-elevated transition-colors"
        type="button"
      >
        <span className="truncate pr-2">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-full bg-bg-elevated border border-border-subtle rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto animated fadeIn">
          <div className="p-1 space-y-0.5">
            {options.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs rounded-md flex items-center justify-between group transition-colors ${value === option.id ? "bg-bg-input hover:bg-bg-elevated text-text-primary" : "text-text-secondary hover:bg-bg-input hover:text-text-primary"}`}
                type="button"
              >
                <span className="truncate">{option.name}</span>
                {value === option.id && (
                  <Check
                    size={14}
                    className="text-accent-primary shrink-0 ml-2"
                  />
                )}
              </button>
            ))}
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-gray-500 italic">
                No models available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CodexCliModelField: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  onSave: () => void;
}> = ({ label, value, placeholder, onChange, onSelect, onSave }) => (
  <label className="space-y-1">
    <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wide">
      {label}
    </span>
    <div className="flex gap-2">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
        className="min-w-0 flex-1 bg-bg-input border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary"
        placeholder={placeholder}
      />
      <ModelSelect
        value={value}
        options={
          value &&
          !CODEX_CLI_MODEL_PRESETS.some((option) => option.id === value)
            ? [
                { id: value, name: prettifyModelId(value) },
                ...CODEX_CLI_MODEL_PRESETS,
              ]
            : CODEX_CLI_MODEL_PRESETS
        }
        onChange={(modelId) => {
          onChange(modelId);
          onSelect(modelId);
        }}
        placeholder="Preset"
      />
    </div>
  </label>
);

interface AIProvidersSettingsProps {
  isOpen?: boolean;
}

export const AIProvidersSettings: React.FC<AIProvidersSettingsProps> = ({
  isOpen = true,
}) => {
  const { t } = useTranslation();
  // --- Standard Providers ---
  const [apiKey, setApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [claudeApiKey, setClaudeApiKey] = useState("");
  const [deepseekApiKey, setDeepseekApiKey] = useState("");
  const [deepseekModel, setDeepseekModel] = useState("deepseek-chat");
  const [deepseekSaved, setDeepseekSaved] = useState(false);
  const [deepseekSaving, setDeepseekSaving] = useState(false);
  const [deepseekHasKey, setDeepseekHasKey] = useState(false);

  // Status
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
  const [hasStoredKey, setHasStoredKey] = useState<Record<string, boolean>>({});
  const [backupKeysMasked, setBackupKeysMasked] = useState<
    Record<string, string[]>
  >({});
  const [testStatus, setTestStatus] = useState<
    Record<string, "idle" | "testing" | "success" | "error">
  >({});
  const [testError, setTestError] = useState<Record<string, string>>({});

  // --- Custom Providers ---
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(
    null,
  );
  const [customName, setCustomName] = useState("");
  const [customCurl, setCustomCurl] = useState("");
  const [customResponsePath, setCustomResponsePath] = useState("");
  const [curlError, setCurlError] = useState<string | null>(null);

  // --- Local (Ollama) ---
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<
    "checking" | "detected" | "not-found" | "fixing"
  >("checking");
  const [ollamaRestarted, setOllamaRestarted] = useState(false);
  const [isRefreshingOllama, setIsRefreshingOllama] = useState(false);

  // --- Local (Codex CLI) ---
  const [codexCliConfig, setCodexCliConfig] = useState({
    enabled: false,
    path: "codex",
    model: "gpt-5.4",
    fastModel: "gpt-5.3-codex-spark",
    timeoutMs: 60000,
  });
  const [codexCliStatus, setCodexCliStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [codexCliError, setCodexCliError] = useState("");

  // --- OpenClaude ---
  const [openClaudeConfig, setOpenClaudeConfig] = useState({
    path: "C:\\Projects\\Teste\\openclaude\\dist\\cli.mjs",
    enabled: false,
    model: "claude-sonnet-4-6",
  });
  const [openClaudeSaving, setOpenClaudeSaving] = useState(false);
  const [openClaudeSaved, setOpenClaudeSaved] = useState(false);
  const [openClaudeTestStatus, setOpenClaudeTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [openClaudeTestError, setOpenClaudeTestError] = useState("");
  const [openClaudeAuth, setOpenClaudeAuth] = useState({
    loggedIn: false,
    authMethod: "none",
    email: null as string | null,
    orgName: null as string | null,
  });
  const [openClaudeAuthBusy, setOpenClaudeAuthBusy] = useState(false);
  const [openClaudeAuthMessage, setOpenClaudeAuthMessage] = useState("");
  const [openClaudeModelOptions, setOpenClaudeModelOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // --- Default Model ---
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [visionDefaultModel, setVisionDefaultModel] = useState<string>("");
  const [fastResponseMode, setFastResponseMode] = useState(false);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  const [visibleIntegrations, setVisibleIntegrations] = useState<IntegrationId[]>(
    () => readPinnedIntegrations(),
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const canUseFastMode = !!(
    hasStoredKey.groq || codexCliConfig.enabled
  );

  // --- Dynamic Model Discovery ---
  const [preferredModels, setPreferredModels] = useState<
    Record<string, string>
  >({});

  const openClaudeConfigRef = useRef(openClaudeConfig);
  const codexCliConfigRef = useRef(codexCliConfig);
  openClaudeConfigRef.current = openClaudeConfig;
  codexCliConfigRef.current = codexCliConfig;

  const loadCredentials = useCallback(async () => {
    try {
      const cliConfig = await window.electronAPI?.getCodexCliConfig?.();
      if (cliConfig) setCodexCliConfig(cliConfig);

      let ocConfig: typeof openClaudeConfig | null = null;
      try {
        ocConfig = await window.electronAPI?.getOpenClaudeConfig?.();
        if (ocConfig) setOpenClaudeConfig(ocConfig);
      } catch {
        /* non-fatal */
      }

      const creds = await window.electronAPI?.getStoredCredentials?.();
      const keys = creds
        ? {
            gemini: creds.hasGeminiKey,
            groq: creds.hasGroqKey,
            openai: creds.hasOpenaiKey,
            claude: creds.hasClaudeKey,
          }
        : null;

      if (keys) setHasStoredKey(keys);

      let deepseekConfigured = false;
      try {
        const ds = await window.electronAPI?.getDeepseekApiKey?.();
        deepseekConfigured = !!ds;
        setDeepseekHasKey(deepseekConfigured);
      } catch {
        setDeepseekHasKey(false);
      }

      const autoVisible: IntegrationId[] = [];
      if (keys?.gemini) autoVisible.push("gemini");
      if (keys?.groq) autoVisible.push("groq");
      if (keys?.openai) autoVisible.push("openai");
      if (keys?.claude) autoVisible.push("claude");
      if (deepseekConfigured) autoVisible.push("deepseek");
      if (cliConfig?.enabled) autoVisible.push("codex-cli");
      if (ocConfig?.enabled) autoVisible.push("openclaude");

      const pinned = readPinnedIntegrations();
      if (pinned.length > 0) {
        setVisibleIntegrations(pinned);
      } else if (autoVisible.length > 0) {
        setVisibleIntegrations(autoVisible);
        writePinnedIntegrations(autoVisible);
      } else {
        setVisibleIntegrations([]);
      }

      if (creds) {
        const pm: Record<string, string> = {};
        if (creds.geminiPreferredModel) pm.gemini = creds.geminiPreferredModel;
        if (creds.groqPreferredModel) pm.groq = creds.groqPreferredModel;
        if (creds.openaiPreferredModel) pm.openai = creds.openaiPreferredModel;
        if (creds.claudePreferredModel) pm.claude = creds.claudePreferredModel;
        setPreferredModels(pm);
        setBackupKeysMasked({
          gemini: creds.geminiBackupKeys ?? [],
          groq: creds.groqBackupKeys ?? [],
          openai: creds.openaiBackupKeys ?? [],
          claude: creds.claudeBackupKeys ?? [],
          deepseek: creds.deepseekBackupKeys ?? [],
        });
      }

      const custom = await window.electronAPI?.getCustomProviders?.();
      if (custom) setCustomProviders(custom);

      const result = await window.electronAPI?.getDefaultModel?.();
      if (result?.model) setDefaultModel(result.model);

      const visionResult = await window.electronAPI?.getVisionDefaultModel?.();
      if (visionResult?.model) setVisionDefaultModel(visionResult.model);

      const fastMode = await window.electronAPI?.getGroqFastTextMode?.();
      if (fastMode) setFastResponseMode(fastMode.enabled);

      checkOllama();
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setCredentialsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void loadCredentials();

    const unsubCred = window.electronAPI?.onCredentialsChanged?.(() => {
      void loadCredentials();
    });

    const unsubFast = window.electronAPI?.onGroqFastTextChanged?.(
      (enabled: boolean) => {
        setFastResponseMode(enabled);
        localStorage.setItem("momor_groq_fast_text", String(enabled));
      },
    );

    return () => {
      unsubCred?.();
      unsubFast?.();
    };
  }, [isOpen, loadCredentials]);

  // Effect to enforce fast mode disabled if neither Groq key nor Momor API is configured.
  // Guard with credentialsLoaded so this never fires during the initial async load phase
  // (when hasStoredKey is still empty and canUseFastMode is incorrectly false).
  useEffect(() => {
    if (!credentialsLoaded) return;
    if (!canUseFastMode && fastResponseMode) {
      setFastResponseMode(false);
      localStorage.setItem("momor_groq_fast_text", "false");
      // @ts-ignore
      window.electronAPI?.setGroqFastTextMode(false);
    }
  }, [credentialsLoaded, canUseFastMode, fastResponseMode]);

  const buildModelOptions = (): { id: string; name: string }[] => {
    const opts: { id: string; name: string }[] = [];
    for (const [prov, cfg] of Object.entries(STANDARD_CLOUD_MODELS)) {
      if (!hasStoredKey[prov as keyof typeof hasStoredKey]) continue;
      cfg.ids.forEach((id, i) => opts.push({ id, name: cfg.names[i] }));
      const pm = preferredModels[prov as keyof typeof preferredModels];
      if (pm && !cfg.ids.includes(pm)) {
        opts.push({ id: pm, name: prettifyModelId(pm) });
      }
    }
    if (deepseekHasKey) {
      opts.push({
        id: deepseekModel,
        name: `DeepSeek (${deepseekModel})`,
      });
    }
    if (openClaudeConfig.enabled) {
      opts.push({
        id: openClaudeConfig.model,
        name: `Claude Code (${prettifyModelId(openClaudeConfig.model)})`,
      });
    }
    if (codexCliConfig.enabled) {
      opts.push({
        id: CODEX_CLI_MODEL.id,
        name: `${CODEX_CLI_MODEL.name} (${prettifyModelId(codexCliConfig.model)})`,
      });
      CODEX_CLI_MODEL_PRESETS.forEach((model) => {
        const id = codexCliSelectorId(model.id);
        if (!opts.find((o) => o.id === id)) {
          opts.push({ id, name: `${CODEX_CLI_MODEL.name}: ${model.name}` });
        }
      });
    }
    customProviders.forEach((p) => opts.push({ id: p.id, name: p.name }));
    ollamaModels.forEach((m) =>
      opts.push({ id: `ollama-${m}`, name: `${m} (Local)` }),
    );
    return opts;
  };

  useEffect(() => {
    if (!credentialsLoaded || !defaultModel) return;
    const opts = buildModelOptions();
    if (opts.length === 0) return;
    if (!opts.some((o) => o.id === defaultModel)) {
      const next = opts[0].id;
      setDefaultModel(next);
      window.electronAPI?.setDefaultModel(next).catch(console.error);
    }
  }, [
    credentialsLoaded,
    hasStoredKey,
    preferredModels,
    codexCliConfig,
    openClaudeConfig,
    deepseekHasKey,
    deepseekModel,
    customProviders,
    ollamaModels,
    defaultModel,
  ]);

  useEffect(() => {
    if (!credentialsLoaded || !visionDefaultModel) return;
    const opts = buildModelOptions();
    if (opts.length === 0) return;
    if (!opts.some((o) => o.id === visionDefaultModel)) {
      const next = defaultModel || opts[0].id;
      setVisionDefaultModel(next);
      window.electronAPI?.setVisionDefaultModel(next).catch(console.error);
    }
  }, [
    credentialsLoaded,
    hasStoredKey,
    preferredModels,
    codexCliConfig,
    openClaudeConfig,
    deepseekHasKey,
    deepseekModel,
    customProviders,
    ollamaModels,
    visionDefaultModel,
    defaultModel,
  ]);

  const pinIntegration = (id: IntegrationId) => {
    setVisibleIntegrations((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      writePinnedIntegrations(next);
      return next;
    });
  };

  const unpinIntegration = (id: IntegrationId) => {
    setVisibleIntegrations((prev) => {
      const next = prev.filter((x) => x !== id);
      writePinnedIntegrations(next);
      return next;
    });
  };

  const isVisible = (id: IntegrationId) => visibleIntegrations.includes(id);

  // Poll for Ollama status every 3 seconds requesting smart start on mount
  useEffect(() => {
    // Immediate "Smart Start" check
    ensureOllamaStartup();

    // Background polling for maintenance
    const interval = setInterval(() => {
      checkOllama(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const ensureOllamaStartup = async () => {
    setOllamaStatus("checking");
    try {
      // @ts-ignore
      const result = await window.electronAPI?.invoke?.(
        "ensure-ollama-running",
      );
      if (result && result.success) {
        // It's running (or just started), now fetch models
        checkOllama(true);
      } else {
        setOllamaStatus("not-found");
      }
    } catch (e) {
      console.warn("Ollama ensure startup failed:", e);
      setOllamaStatus("not-found");
    }
  };

  const checkOllama = async (_isInitial = true) => {
    // Don't override 'checking' if we are already in smart-start mode
    // if (isInitial) setOllamaStatus('checking');

    try {
      // @ts-ignore
      const models = await window.electronAPI?.getAvailableOllamaModels?.();
      if (models && models.length > 0) {
        setOllamaModels(models);
        setOllamaStatus("detected");
      } else {
        // Silent failure on background checks
        // Only set not-found if we haven't detected it yet
        if (ollamaStatus !== "detected") {
          setOllamaStatus("not-found");
        }
      }
    } catch (e) {
      // console.warn(`Ollama check failed:`, e);
      if (ollamaStatus !== "detected") {
        setOllamaStatus("not-found");
      }
    }
  };

  const handleFixOllama = async () => {
    setOllamaStatus("fixing");
    try {
      // @ts-ignore
      const result = await window.electronAPI?.invoke?.("force-restart-ollama");
      if (result && result.success) {
        setOllamaRestarted(true);
        // Wait for server to be ready
        setTimeout(() => checkOllama(false), 2000);
      } else {
        setOllamaStatus("not-found");
      }
    } catch (e) {
      console.error("Fix failed", e);
      setOllamaStatus("not-found");
    }
  };

  const saveCodexCliConfig = async (next = codexCliConfigRef.current) => {
    const normalized = { ...next, timeoutMs: Number(next.timeoutMs) || 60000 };
    setCodexCliConfig(normalized);
    const result = await window.electronAPI?.setCodexCliConfig?.(normalized);
    if (result?.config) setCodexCliConfig(result.config);
    return result;
  };

  const persistOpenClaudeConfig = async (
    patch: Partial<typeof openClaudeConfig>,
  ) => {
    const next = { ...openClaudeConfigRef.current, ...patch };
    setOpenClaudeConfig(next);
    await window.electronAPI?.setOpenClaudeConfig?.(next);
    if (patch.enabled) pinIntegration("openclaude");
    return next;
  };

  const refreshOpenClaudeModels = async () => {
    try {
      const res = await window.electronAPI?.getOpenClaudeModels?.();
      if (res?.success && res.models?.length) {
        setOpenClaudeModelOptions(
          res.models.map((m) => ({ value: m.value, label: m.label })),
        );
        setOpenClaudeConfig((prev) => {
          const hasCurrent = res.models!.some((m) => m.value === prev.model);
          if (hasCurrent) return prev;
          return { ...prev, model: res.models![0].value };
        });
      }
    } catch {
      /* non-fatal */
    }
  };

  const refreshOpenClaudeAuth = async (cliPath?: string) => {
    try {
      const res = await window.electronAPI?.getOpenClaudeAuthStatus?.(
        cliPath ?? openClaudeConfig.path,
      );
      if (res?.success && res.status) {
        setOpenClaudeAuth({
          loggedIn: res.status.loggedIn,
          authMethod: res.status.authMethod,
          email: res.status.email ?? null,
          orgName: res.status.orgName ?? null,
        });
      }
    } catch {
      /* non-fatal */
    }
  };

  const handleCliOAuthLogin = async (kind: "openclaude" | "codex") => {
    const cliPath =
      kind === "openclaude" ? openClaudeConfig.path : codexCliConfig.path;
    if (kind === "openclaude") {
      setOpenClaudeAuthBusy(true);
      setOpenClaudeAuthMessage("");
      setOpenClaudeTestError("");
    } else {
      setCodexCliStatus("idle");
      setCodexCliError("");
    }
    const result = await window.electronAPI?.startCliOAuthLogin?.({
      kind,
      executablePath: cliPath,
    });
    if (kind === "openclaude") {
      setOpenClaudeAuthBusy(false);
      if (result?.success) {
        setOpenClaudeAuthMessage(result.message ?? "");
        await refreshOpenClaudeAuth(cliPath);
        await refreshOpenClaudeModels();
      } else if (result?.error) {
        setOpenClaudeTestStatus("error");
        setOpenClaudeTestError(result.error);
      }
    } else if (!result?.success && result?.error) {
      setCodexCliStatus("error");
      setCodexCliError(result.error);
    } else if (result?.success) {
      setCodexCliError("");
      setCodexCliStatus("success");
      setTimeout(() => setCodexCliStatus("idle"), 5000);
    }
  };

  const handleOpenClaudeLogout = async () => {
    setOpenClaudeAuthBusy(true);
    setOpenClaudeAuthMessage("");
    const result = await window.electronAPI?.openClaudeAuthLogout?.(
      openClaudeConfig.path,
    );
    setOpenClaudeAuthBusy(false);
    if (result?.success) {
      setOpenClaudeAuth({
        loggedIn: false,
        authMethod: "none",
        email: null,
        orgName: null,
      });
      setOpenClaudeAuthMessage(result.message ?? "");
    } else if (result?.error) {
      setOpenClaudeTestStatus("error");
      setOpenClaudeTestError(result.error);
    }
  };

  useEffect(() => {
    if (!visibleIntegrations.includes("openclaude")) return;
    void refreshOpenClaudeAuth(openClaudeConfig.path);
    void refreshOpenClaudeModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openClaudeConfig.path, visibleIntegrations]);

  const handleTestCodexCli = async () => {
    setCodexCliStatus("testing");
    setCodexCliError("");
    try {
      const saveResult = await saveCodexCliConfig();
      const configToTest = saveResult?.config || codexCliConfig;
      const result = await window.electronAPI?.testCodexCli?.(configToTest);
      if (result?.success) {
        // If the main process auto-detected an install, reflect the
        // resolved path in the form so the user sees what got picked.
        if (result.config) setCodexCliConfig(result.config);
        setCodexCliStatus("success");
        setTimeout(() => setCodexCliStatus("idle"), 3000);
      } else {
        setCodexCliStatus("error");
        setCodexCliError(result?.error || "Codex CLI test failed");
      }
    } catch (e: any) {
      setCodexCliStatus("error");
      setCodexCliError(e.message || "Codex CLI test failed");
    }
  };

  const saveBackupKeys = async (
    provider: "gemini" | "groq" | "openai" | "claude" | "deepseek",
    keys: string[],
  ) => {
    await window.electronAPI?.setLlmBackupKeys?.(provider, keys);
    await loadCredentials();
  };

  const handleSaveKey = async (
    provider: string,
    key: string,
    setter: (val: string) => void,
  ) => {
    if (!key.trim()) return;
    setSavingStatus((prev) => ({ ...prev, [provider]: true }));
    try {
      let result;
      // @ts-ignore
      if (provider === "gemini")
        result = await window.electronAPI.setGeminiApiKey(key);
      // @ts-ignore
      if (provider === "groq")
        result = await window.electronAPI.setGroqApiKey(key);
      // @ts-ignore
      if (provider === "openai")
        result = await window.electronAPI.setOpenaiApiKey(key);
      // @ts-ignore
      if (provider === "claude")
        result = await window.electronAPI.setClaudeApiKey(key);

      if (result && result.success) {
        setSavedStatus((prev) => ({ ...prev, [provider]: true }));
        setHasStoredKey((prev) => ({ ...prev, [provider]: true }));
        setter("");
        setTimeout(
          () => setSavedStatus((prev) => ({ ...prev, [provider]: false })),
          2000,
        );
      }
    } catch (e) {
      console.error(`Failed to save ${provider} key:`, e);
    } finally {
      setSavingStatus((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleRemoveKey = async (
    provider: string,
    setter: (val: string) => void,
  ) => {
    if (!confirm(t('providers.removeKeyConfirm', { provider })))
      return;
    try {
      let result;
      // @ts-ignore
      if (provider === "gemini")
        result = await window.electronAPI.setGeminiApiKey("");
      // @ts-ignore
      if (provider === "groq")
        result = await window.electronAPI.setGroqApiKey("");
      // @ts-ignore
      if (provider === "openai")
        result = await window.electronAPI.setOpenaiApiKey("");
      // @ts-ignore
      if (provider === "claude")
        result = await window.electronAPI.setClaudeApiKey("");

      if (result && result.success) {
        setHasStoredKey((prev) => ({ ...prev, [provider]: false }));
        setter("");
      }
    } catch (e) {
      console.error(`Failed to remove ${provider} key:`, e);
    }
  };

  const handleTestConnection = async (provider: string, key: string) => {
    // Allow testing if key is provided OR if we have a stored key
    if (!key.trim() && !hasStoredKey[provider]) {
      return;
    }
    setTestStatus((prev) => ({ ...prev, [provider]: "testing" }));
    setTestError((prev) => ({ ...prev, [provider]: "" }));

    try {
      // @ts-ignore
      const result = await window.electronAPI.testLlmConnection(provider, key);
      if (result.success) {
        setTestStatus((prev) => ({ ...prev, [provider]: "success" }));
        setTimeout(
          () => setTestStatus((prev) => ({ ...prev, [provider]: "idle" })),
          3000,
        );
      } else {
        setTestStatus((prev) => ({ ...prev, [provider]: "error" }));
        setTestError((prev) => ({
          ...prev,
          [provider]: result.error || "Connection failed",
        }));
      }
    } catch (e: any) {
      setTestStatus((prev) => ({ ...prev, [provider]: "error" }));
      setTestError((prev) => ({
        ...prev,
        [provider]: e.message || "Connection failed",
      }));
    }
  };

  const openKeyUrl = (provider: string) => {
    const urls: Record<string, string> = {
      gemini: "https://aistudio.google.com/app/apikey",
      groq: "https://console.groq.com/keys",
      openai: "https://platform.openai.com/api-keys",
      claude: "https://console.anthropic.com/settings/keys",
    };
    // @ts-ignore
    window.electronAPI?.openExternal(urls[provider]);
  };

  // --- Custom Provider Handlers ---

  const handleEditProvider = (provider: CustomProvider) => {
    setEditingProvider(provider);
    setCustomName(provider.name);
    setCustomCurl(provider.curlCommand);
    setCustomResponsePath(provider.responsePath || "");
    setIsEditingCustom(true);
    setCurlError(null);
  };

  const handleNewProvider = () => {
    setEditingProvider(null);
    setCustomName("");
    setCustomCurl("");
    setCustomResponsePath("");
    setIsEditingCustom(true);
    setCurlError(null);
  };

  const handleSaveCustom = async () => {
    setCurlError(null);
    if (!customName.trim()) {
      setCurlError("Provider Name is required.");
      return;
    }

    const validation = validateCurl(customCurl);
    if (!validation.isValid) {
      setCurlError(validation.message || "Invalid cURL command.");
      return;
    }

    const newProvider: CustomProvider = {
      id: editingProvider ? editingProvider.id : crypto.randomUUID(),
      name: customName,
      curlCommand: customCurl,
      responsePath: customResponsePath,
    };

    try {
      // @ts-ignore
      const result = await window.electronAPI.saveCustomProvider(newProvider);
      if (result.success) {
        // Refresh list
        // @ts-ignore
        const updated = await window.electronAPI.getCustomProviders();
        setCustomProviders(updated);
        setIsEditingCustom(false);
      } else {
        setCurlError(result.error ?? null);
      }
    } catch (e: any) {
      setCurlError(e.message);
    }
  };

  const handleDeleteCustom = async (id: string) => {
    if (!confirm(t('providers.deleteProviderConfirm'))) return;
    try {
      // @ts-ignore
      const result = await window.electronAPI.deleteCustomProvider(id);
      if (result.success) {
        // @ts-ignore
        const updated = await window.electronAPI.getCustomProviders();
        setCustomProviders(updated);
      }
    } catch (e) {
      console.error("Failed to delete provider:", e);
    }
  };

  const modelOptions = buildModelOptions();

  return (
    <div className="space-y-6">
      <AddIntegrationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        hiddenIds={visibleIntegrations}
        onSelect={pinIntegration}
      />

      <SettingsSection
        title={t("providers.activeModels")}
        description={t("providers.activeModelsDesc")}
      >
        <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
          {modelOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("providers.configureProviderFirst")}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("providers.defaultChatModel")}
                </p>
                <SettingsToolbar>
                  <Select
                    value={defaultModel}
                    onValueChange={(val) => {
                      setDefaultModel(val);
                      window.electronAPI?.setDefaultModel(val).catch(console.error);
                    }}
                  >
                    <SelectTrigger
                      className={`w-full ${SETTINGS_CONTROL_CLASS} text-sm`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id} className="text-sm">
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsToolbar>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("providers.defaultVisionModel")}
                </p>
                <SettingsToolbar>
                  <Select
                    value={visionDefaultModel}
                    onValueChange={(val) => {
                      setVisionDefaultModel(val);
                      window.electronAPI
                        ?.setVisionDefaultModel(val)
                        .catch(console.error);
                    }}
                  >
                    <SelectTrigger
                      className={`w-full ${SETTINGS_CONTROL_CLASS} text-sm`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((o) => (
                        <SelectItem key={o.id} value={o.id} className="text-sm">
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsToolbar>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("providers.integrationsList")}
        description={t("providers.integrationsListDesc")}
        action={
          <Button type="button" size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("providers.addIntegration")}
          </Button>
        }
      >

        {visibleIntegrations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("providers.noIntegrationsYet")}
              </p>
              <Button type="button" onClick={() => setAddDialogOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("providers.addIntegration")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
          {isVisible("gemini") && (
          <ProviderCard
            providerId="gemini"
            providerName="Gemini"
            apiKey={apiKey}
            preferredModel={preferredModels.gemini}
            hasStoredKey={!!hasStoredKey.gemini}
            onKeyChange={setApiKey}
            onSaveKey={async () => {
              await handleSaveKey("gemini", apiKey, setApiKey);
            }}
            onRemoveKey={() => handleRemoveKey("gemini", setApiKey)}
            onTestConnection={() => handleTestConnection("gemini", apiKey)}
            testStatus={testStatus.gemini || "idle"}
            testError={testError.gemini}
            savingStatus={!!savingStatus.gemini}
            savedStatus={!!savedStatus.gemini}
            keyPlaceholder="AIzaSy..."
            keyUrl="https://aistudio.google.com/app/apikey"
            onPreferredModelChange={(model) =>
              setPreferredModels((prev) => ({ ...prev, gemini: model }))
            }
            onRemoveFromList={() => unpinIntegration("gemini")}
            backupKeysMasked={backupKeysMasked.gemini ?? []}
            onSaveBackupKeys={(keys) => saveBackupKeys("gemini", keys)}
          />
          )}

          {isVisible("groq") && (
          <ProviderCard
            providerId="groq"
            providerName="Groq"
            apiKey={groqApiKey}
            preferredModel={preferredModels.groq}
            hasStoredKey={!!hasStoredKey.groq}
            onKeyChange={setGroqApiKey}
            onSaveKey={async () => {
              await handleSaveKey("groq", groqApiKey, setGroqApiKey);
            }}
            onRemoveKey={() => handleRemoveKey("groq", setGroqApiKey)}
            onTestConnection={() => handleTestConnection("groq", groqApiKey)}
            testStatus={testStatus.groq || "idle"}
            testError={testError.groq}
            savingStatus={!!savingStatus.groq}
            savedStatus={!!savedStatus.groq}
            keyPlaceholder="gsk_..."
            keyUrl="https://console.groq.com/keys"
            onPreferredModelChange={(model) =>
              setPreferredModels((prev) => ({ ...prev, groq: model }))
            }
            onRemoveFromList={() => unpinIntegration("groq")}
            backupKeysMasked={backupKeysMasked.groq ?? []}
            onSaveBackupKeys={(keys) => saveBackupKeys("groq", keys)}
          />
          )}

          {isVisible("openai") && (
          <ProviderCard
            providerId="openai"
            providerName="OpenAI"
            apiKey={openaiApiKey}
            preferredModel={preferredModels.openai}
            hasStoredKey={!!hasStoredKey.openai}
            onKeyChange={setOpenaiApiKey}
            onSaveKey={async () => {
              await handleSaveKey("openai", openaiApiKey, setOpenaiApiKey);
            }}
            onRemoveKey={() => handleRemoveKey("openai", setOpenaiApiKey)}
            onTestConnection={() =>
              handleTestConnection("openai", openaiApiKey)
            }
            testStatus={testStatus.openai || "idle"}
            testError={testError.openai}
            savingStatus={!!savingStatus.openai}
            savedStatus={!!savedStatus.openai}
            keyPlaceholder="sk-..."
            keyUrl="https://platform.openai.com/api-keys"
            onPreferredModelChange={(model) =>
              setPreferredModels((prev) => ({ ...prev, openai: model }))
            }
            onRemoveFromList={() => unpinIntegration("openai")}
            backupKeysMasked={backupKeysMasked.openai ?? []}
            onSaveBackupKeys={(keys) => saveBackupKeys("openai", keys)}
          />
          )}

          {isVisible("claude") && (
          <ProviderCard
            providerId="claude"
            providerName="Claude"
            apiKey={claudeApiKey}
            preferredModel={preferredModels.claude}
            hasStoredKey={!!hasStoredKey.claude}
            onKeyChange={setClaudeApiKey}
            onSaveKey={async () => {
              await handleSaveKey("claude", claudeApiKey, setClaudeApiKey);
            }}
            onRemoveKey={() => handleRemoveKey("claude", setClaudeApiKey)}
            onTestConnection={() =>
              handleTestConnection("claude", claudeApiKey)
            }
            testStatus={testStatus.claude || "idle"}
            testError={testError.claude}
            savingStatus={!!savingStatus.claude}
            savedStatus={!!savedStatus.claude}
            keyPlaceholder="sk-ant-..."
            keyUrl="https://console.anthropic.com/settings/keys"
            oauthAlternativeNote={t("providers.claudeApiOptional")}
            onPreferredModelChange={(model) =>
              setPreferredModels((prev) => ({ ...prev, claude: model }))
            }
            onRemoveFromList={() => unpinIntegration("claude")}
            backupKeysMasked={backupKeysMasked.claude ?? []}
            onSaveBackupKeys={(keys) => saveBackupKeys("claude", keys)}
          />
          )}

          {isVisible("deepseek") && (
          <DeepSeekProviderCard
            apiKey={deepseekApiKey}
            model={deepseekModel}
            hasStoredKey={deepseekHasKey}
            saving={deepseekSaving}
            saved={deepseekSaved}
            onKeyChange={(k) => {
              setDeepseekApiKey(k);
              setDeepseekSaved(false);
            }}
            onModelChange={setDeepseekModel}
            onSave={async () => {
              setDeepseekSaving(true);
              try {
                if (deepseekApiKey.trim()) {
                  await window.electronAPI?.setDeepseekApiKey?.(
                    deepseekApiKey.trim(),
                  );
                }
                await window.electronAPI?.setDeepseekModel?.(deepseekModel);
                setDeepseekHasKey(deepseekHasKey || !!deepseekApiKey.trim());
                setDeepseekSaved(true);
                setTimeout(() => setDeepseekSaved(false), 2000);
              } catch (e) {
                console.error("Failed to save DeepSeek settings:", e);
              } finally {
                setDeepseekSaving(false);
              }
            }}
            onRemove={async () => {
              await window.electronAPI?.setDeepseekApiKey?.("");
              setDeepseekApiKey("");
              setDeepseekHasKey(false);
              setDeepseekSaved(false);
            }}
            onRemoveFromList={() => unpinIntegration("deepseek")}
            backupKeysMasked={backupKeysMasked.deepseek ?? []}
            onSaveBackupKeys={(keys) => saveBackupKeys("deepseek", keys)}
          />
          )}

          {isVisible("openclaude") && (
          <CliProviderCard
            title={t("providers.openClaude")}
            description={t("providers.openClaudeDesc")}
            iconId="openclaude"
            enabled={openClaudeConfig.enabled}
            onEnabledChange={(enabled) => {
              void persistOpenClaudeConfig({ enabled });
            }}
            executablePath={openClaudeConfig.path}
            onPathChange={(path) => {
              void persistOpenClaudeConfig({ path });
            }}
            pathPlaceholder="C:\\Projects\\Teste\\openclaude\\dist\\cli.mjs"
            buildHint={
              openClaudeConfig.path?.endsWith(".mjs")
                ? "Build: cd C:\\Projects\\Teste\\openclaude && bun run build"
                : undefined
            }
            modelFields={[
              {
                id: "model",
                label: t("providers.modelLabel"),
                value: openClaudeConfig.model,
                options:
                  openClaudeModelOptions.length > 0
                    ? openClaudeModelOptions
                    : [
                        {
                          value: "claude-sonnet-4-6",
                          label: "claude-sonnet-4-6",
                        },
                        { value: "claude-opus-4-7", label: "claude-opus-4-7" },
                        { value: "gpt-5.4", label: "gpt-5.4" },
                      ],
                onChange: (model) => {
                  void persistOpenClaudeConfig({ model });
                },
              },
            ]}
            saving={openClaudeSaving}
            saved={openClaudeSaved}
            onSave={async () => {
              setOpenClaudeSaving(true);
              try {
                await window.electronAPI?.setOpenClaudeConfig?.(
                  openClaudeConfig,
                );
                setOpenClaudeSaved(true);
                setTimeout(() => setOpenClaudeSaved(false), 2000);
              } catch (e) {
                console.error("Failed to save OpenClaude settings:", e);
              } finally {
                setOpenClaudeSaving(false);
              }
            }}
            onTest={async () => {
              setOpenClaudeTestStatus("testing");
              setOpenClaudeTestError("");
              try {
                await window.electronAPI?.setOpenClaudeConfig?.(
                  openClaudeConfig,
                );
                const res =
                  await window.electronAPI?.testOpenClaudeConnection?.();
                if (res?.success) {
                  setOpenClaudeTestStatus("success");
                } else {
                  setOpenClaudeTestStatus("error");
                  setOpenClaudeTestError(res?.error ?? "Unknown error");
                }
              } catch (e: unknown) {
                setOpenClaudeTestStatus("error");
                setOpenClaudeTestError(
                  e instanceof Error ? e.message : "Unknown error",
                );
              }
              setTimeout(() => setOpenClaudeTestStatus("idle"), 5000);
            }}
            onLogin={() => void handleCliOAuthLogin("openclaude")}
            onLogout={() => void handleOpenClaudeLogout()}
            onRefreshAuth={() => {
              setOpenClaudeAuthBusy(true);
              void refreshOpenClaudeAuth(openClaudeConfig.path).finally(() =>
                setOpenClaudeAuthBusy(false),
              );
              void refreshOpenClaudeModels();
            }}
            authLoggedIn={openClaudeAuth.loggedIn}
            authEmail={openClaudeAuth.email}
            authMethod={openClaudeAuth.authMethod}
            authBusy={openClaudeAuthBusy}
            authMessage={openClaudeAuthMessage}
            testStatus={openClaudeTestStatus}
            testError={openClaudeTestError}
            onRemove={() => unpinIntegration("openclaude")}
          />
          )}

          {isVisible("codex-cli") && (
          <CliProviderCard
            title={t("providers.codexCli")}
            description={t("providers.codexCliOAuthDesc")}
            iconId="codex-cli"
            enabled={codexCliConfig.enabled}
            onEnabledChange={async (enabled) => {
              await saveCodexCliConfig({ ...codexCliConfig, enabled });
            }}
            executablePath={codexCliConfig.path}
            onPathChange={(path) => {
              void saveCodexCliConfig({ ...codexCliConfigRef.current, path });
            }}
            pathPlaceholder="codex"
            timeoutMs={codexCliConfig.timeoutMs}
            onTimeoutChange={(timeoutMs) => {
              void saveCodexCliConfig({
                ...codexCliConfigRef.current,
                timeoutMs,
              });
            }}
            modelFields={[
              {
                id: "normal",
                label: t("providers.normalModel"),
                value: codexCliConfig.model,
                options: CODEX_CLI_MODEL_PRESETS.map((m) => ({
                  value: m.id,
                  label: m.name,
                })),
                onChange: (model) => {
                  void saveCodexCliConfig({
                    ...codexCliConfigRef.current,
                    model,
                  });
                },
              },
              {
                id: "fast",
                label: t("providers.fastModel"),
                value: codexCliConfig.fastModel,
                options: CODEX_CLI_MODEL_PRESETS.map((m) => ({
                  value: m.id,
                  label: m.name,
                })),
                onChange: (fastModel) => {
                  void saveCodexCliConfig({
                    ...codexCliConfigRef.current,
                    fastModel,
                  });
                },
              },
            ]}
            onSave={async () => {
              await saveCodexCliConfig();
            }}
            onTest={handleTestCodexCli}
            onLogin={() => void handleCliOAuthLogin("codex")}
            testStatus={codexCliStatus}
            testError={codexCliError}
            onRemove={() => unpinIntegration("codex-cli")}
          />
          )}
          </div>
        )}
      </SettingsSection>

      {isVisible("ollama") && (
      <SettingsSection
        title={t("providers.ollama")}
        description={t("providers.ollamaDesc")}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-bold text-text-primary mb-1">
              {t('providers.ollama')}
            </h3>
            <p className="text-xs text-text-secondary">
              {t('providers.ollamaDesc')}
            </p>
          </div>
          <button
            onClick={async () => {
              setIsRefreshingOllama(true);
              await checkOllama(false);
              // Add a small delay for visual feedback if the check is too fast
              setTimeout(() => setIsRefreshingOllama(false), 500);
            }}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-input transition-colors"
            title="Refresh Ollama"
            disabled={isRefreshingOllama}
          >
            <RefreshCw
              size={18}
              className={isRefreshingOllama ? "animate-spin" : ""}
            />
          </button>
        </div>

        <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle">
          {ollamaStatus === "checking" && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="animate-spin">⏳</span> {t('providers.checkingOllama')}
            </div>
          )}

          {ollamaStatus === "fixing" && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="animate-spin">🔧</span> {t('providers.fixingOllama')}
            </div>
          )}

          {ollamaStatus === "not-found" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-red-400">
                <AlertCircle size={14} />
                <span>{t('providers.ollamaNotDetected')}</span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs text-text-secondary">
                  {t('providers.ollamaEnsureRunning')}
                </p>
                <button
                  onClick={handleFixOllama}
                  className="text-[10px] bg-bg-elevated hover:bg-bg-input px-2 py-1 rounded border border-border-subtle"
                >
                  {t('providers.ollamaAutoFix')}
                </button>
              </div>
            </div>
          )}

          {ollamaStatus === "detected" && ollamaModels.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-green-400 mb-3">
                <CheckCircle size={14} />
                <span>{t('providers.ollamaConnected')}</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {ollamaModels.map((model) => (
                  <div
                    key={model}
                    className="flex items-center justify-between p-2 bg-bg-input rounded-lg border border-border-subtle"
                  >
                    <span className="text-xs text-text-primary font-mono">
                      {model}
                    </span>
                    <span className="text-[10px] text-bg-elevated bg-text-secondary px-1.5 py-0.5 rounded-full font-bold">
                      LOCAL
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ollamaStatus === "detected" && ollamaModels.length === 0 && (
            <div className="text-xs text-text-secondary">
              {t('providers.ollamaNoModels')}
            </div>
          )}
        </div>
      </SettingsSection>
      )}

      {isVisible("custom") && (
      <SettingsSection
        title={t("providers.customProviders")}
        description={t("providers.customProvidersDesc")}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-600">
            {t("common.experimental")}
          </span>
          {!isEditingCustom && (
            <button
              onClick={handleNewProvider}
              className="flex items-center gap-2 px-3 py-1.5 bg-bg-input hover:bg-bg-elevated border border-border-subtle rounded-lg text-xs font-medium text-text-primary transition-colors"
            >
              <Plus size={14} /> {t('providers.addProvider')}
            </button>
          )}
        </div>

        {isEditingCustom ? (
          <div className="bg-bg-item-surface rounded-xl p-5 border border-border-subtle animated fadeIn">
            <h4 className="text-sm font-bold text-text-primary mb-4">
              {editingProvider ? t('providers.editProvider') : t('providers.newProvider')}
            </h4>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-1">
                  {t('providers.providerName')}
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="My Custom LLM"
                  className="w-full bg-bg-input border border-border-subtle rounded-lg px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-1">
                  {t('providers.curlCommand')}
                </label>
                <div className="relative">
                  <textarea
                    value={customCurl}
                    onChange={(e) => setCustomCurl(e.target.value)}
                    placeholder={`curl https://api.openai.com/v1/chat/completions ... "content": "{{TEXT}}"`}
                    className="w-full h-32 bg-bg-input border border-border-subtle rounded-lg p-4 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary transition-colors resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-primary uppercase tracking-wide mb-1">
                  {t('providers.responseJsonPath')}{" "}
                  <span className="text-text-tertiary normal-case font-normal">
                    ({t('providers.optional')})
                  </span>
                </label>
                <input
                  type="text"
                  value={customResponsePath}
                  onChange={(e) => setCustomResponsePath(e.target.value)}
                  placeholder="e.g. choices[0].message.content"
                  className="w-full bg-bg-input border border-border-subtle rounded-lg px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary transition-colors font-mono"
                />
                <p className="text-[10px] text-text-secondary mt-1">
                  {t('providers.responsePathDesc')}
                </p>
              </div>

              <div className="bg-bg-elevated/30 rounded-lg overflow-hidden border border-border-subtle mt-4">
                <div className="px-4 py-3 bg-bg-elevated/50 border-b border-border-subtle flex items-center justify-between">
                  <h5 className="block text-xs font-medium text-text-primary uppercase tracking-wide">
                    {t('providers.configGuide')}
                  </h5>
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs text-text-secondary mb-2 font-medium">
                      {t('providers.availableVariables')}
                    </p>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <code className="bg-bg-input px-1.5 py-0.5 rounded text-text-primary font-mono border border-border-subtle">
                          {"{{TEXT}}"}
                        </code>
                        <span className="text-text-tertiary">
                          {t('providers.textVarDesc')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <code className="bg-bg-input px-1.5 py-0.5 rounded text-text-primary font-mono border border-border-subtle">
                          {"{{IMAGE_BASE64}}"}
                        </code>
                        <span className="text-text-tertiary">
                          {t('providers.imageVarDesc')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-text-secondary mb-2 font-medium">
                      {t('providers.examples')}
                    </p>
                    <div className="space-y-3">
                      {/* Ollama Example */}
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">
                          {t('providers.localOllama')}
                        </div>
                        <div className="bg-bg-input p-2.5 rounded-lg border border-border-subtle overflow-x-auto group relative">
                          <code className="font-mono text-[10px] text-text-primary whitespace-pre block">
                            curl http://localhost:11434/api/generate -d '{"{"}
                            "model": "llama3", "prompt": "{`{{TEXT}}`}"{"}"}'
                          </code>
                        </div>
                      </div>

                      {/* OpenAI Example */}
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-1.5">
                          {t('providers.openAiCompatible')}
                        </div>
                        <div className="bg-bg-input p-2.5 rounded-lg border border-border-subtle overflow-x-auto">
                          <code className="font-mono text-[10px] text-text-primary whitespace-pre block">
                            {`curl https://api.openai.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "{{TEXT}}"}
    ],
    "temperature": 0.7
  }'`}
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {curlError && (
                <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{curlError}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsEditingCustom(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-input transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSaveCustom}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-accent-primary text-white hover:bg-accent-secondary transition-colors flex items-center gap-2"
                >
                  <Save size={14} /> {t('providers.saveProvider')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {customProviders.length === 0 ? (
              <div className="text-center py-8 bg-bg-item-surface rounded-xl border border-border-subtle border-dashed">
                <p className="text-xs text-text-tertiary">
                  {t('providers.noCustomProviders')}
                </p>
              </div>
            ) : (
              customProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="bg-bg-item-surface rounded-xl p-4 border border-border-subtle flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-bg-input flex items-center justify-center text-text-secondary font-mono text-xs font-bold">
                      {provider.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-text-primary">
                        {provider.name}
                      </h4>
                      <p className="text-[10px] text-text-tertiary font-mono truncate max-w-[200px] opacity-60">
                        {provider.curlCommand.substring(0, 30)}...
                      </p>
                      {provider.responsePath && (
                        <p className="text-[9px] text-text-tertiary font-mono opacity-40 mt-0.5">
                          path: {provider.responsePath}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditProvider(provider)}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteCustom(provider.id)}
                      className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SettingsSection>
      )}
    </div>
  );
};
