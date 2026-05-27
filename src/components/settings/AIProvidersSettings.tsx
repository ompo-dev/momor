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
import { OllamaProviderCard } from "./OllamaProviderCard";
import { CustomProviderCard } from "./CustomProviderCard";
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
  const [apiKeysStored, setApiKeysStored] = useState<
    Record<string, string[]>
  >({});
  const [deepseekModel, setDeepseekModel] = useState("deepseek-chat");
  const [deepseekSaved, setDeepseekSaved] = useState(false);
  const [deepseekSaving, setDeepseekSaving] = useState(false);
  const [deepseekHasKey, setDeepseekHasKey] = useState(false);

  // Status
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
  const [hasStoredKey, setHasStoredKey] = useState<Record<string, boolean>>({});
  const [keyTestResults, setKeyTestResults] = useState<
    Record<string, import("./ApiKeysListEditor").ApiKeyTestRowStatus[]>
  >({});
  const [keyTestErrors, setKeyTestErrors] = useState<
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
  const [codexInferenceStatus, setCodexInferenceStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [codexInferenceError, setCodexInferenceError] = useState("");

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

      let deepseekConfigured = false;
      let storedKeysForVisible: Record<string, string[]> = {};
      if (creds) {
        const pm: Record<string, string> = {};
        if (creds.geminiPreferredModel) pm.gemini = creds.geminiPreferredModel;
        if (creds.groqPreferredModel) pm.groq = creds.groqPreferredModel;
        if (creds.openaiPreferredModel) pm.openai = creds.openaiPreferredModel;
        if (creds.claudePreferredModel) pm.claude = creds.claudePreferredModel;
        setPreferredModels(pm);

        const stored: Record<string, string[]> = {
          gemini: creds.geminiApiKeys ?? [],
          groq: creds.groqApiKeys ?? [],
          openai: creds.openaiApiKeys ?? [],
          claude: creds.claudeApiKeys ?? [],
          deepseek: creds.deepseekApiKeys ?? [],
        };
        storedKeysForVisible = stored;
        setApiKeysStored(stored);
        deepseekConfigured = (stored.deepseek?.length ?? 0) > 0;
        setDeepseekHasKey(deepseekConfigured);
        setHasStoredKey({
          gemini: (stored.gemini?.length ?? 0) > 0,
          groq: (stored.groq?.length ?? 0) > 0,
          openai: (stored.openai?.length ?? 0) > 0,
          claude: (stored.claude?.length ?? 0) > 0,
        });
      } else {
        setDeepseekHasKey(false);
      }

      const autoVisible: IntegrationId[] = [];
      if ((storedKeysForVisible.gemini?.length ?? 0) > 0) autoVisible.push("gemini");
      if ((storedKeysForVisible.groq?.length ?? 0) > 0) autoVisible.push("groq");
      if ((storedKeysForVisible.openai?.length ?? 0) > 0) autoVisible.push("openai");
      if ((storedKeysForVisible.claude?.length ?? 0) > 0) autoVisible.push("claude");
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
        if (result.config) setCodexCliConfig(result.config);
        setCodexCliStatus("success");
        setTimeout(() => setCodexCliStatus("idle"), 3000);
      } else {
        setCodexCliStatus("error");
        setCodexCliError(result?.error || "Codex CLI validation failed");
      }
    } catch (e: unknown) {
      setCodexCliStatus("error");
      setCodexCliError(
        e instanceof Error ? e.message : "Codex CLI validation failed",
      );
    }
  };

  const handleTestCodexInference = async () => {
    setCodexInferenceStatus("testing");
    setCodexInferenceError("");
    try {
      const saveResult = await saveCodexCliConfig();
      const configToTest = saveResult?.config || codexCliConfig;
      const result = await window.electronAPI?.testCodexInference?.(
        configToTest,
      );
      if (result?.success) {
        setCodexInferenceStatus("success");
        setTimeout(() => setCodexInferenceStatus("idle"), 3000);
      } else {
        setCodexInferenceStatus("error");
        setCodexInferenceError(result?.error || "Codex inference test failed");
      }
    } catch (e: unknown) {
      setCodexInferenceStatus("error");
      setCodexInferenceError(
        e instanceof Error ? e.message : "Codex inference test failed",
      );
    }
  };

  const saveProviderKeys = async (
    provider: "gemini" | "groq" | "openai" | "claude" | "deepseek",
    keys: string[],
  ) => {
    setSavingStatus((prev) => ({ ...prev, [provider]: true }));
    try {
      await window.electronAPI?.setLlmApiKeys?.(provider, keys);
      setApiKeysStored((prev) => ({ ...prev, [provider]: keys }));
      setHasStoredKey((prev) => ({ ...prev, [provider]: keys.length > 0 }));
      if (provider === "deepseek") setDeepseekHasKey(keys.length > 0);
      setSavedStatus((prev) => ({ ...prev, [provider]: true }));
      setTimeout(
        () => setSavedStatus((prev) => ({ ...prev, [provider]: false })),
        2000,
      );
    } catch (e) {
      console.error(`Failed to save ${provider} keys:`, e);
    } finally {
      setSavingStatus((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const clearProviderKeys = async (
    provider: "gemini" | "groq" | "openai" | "claude" | "deepseek",
  ) => {
    if (!confirm(t("providers.removeKeyConfirm", { provider }))) return;
    await saveProviderKeys(provider, []);
  };

  const handleTestConnection = async (
    provider: string,
    keys: string[],
    customProviderId?: string,
  ) => {
    const statusKey = customProviderId ? `custom:${customProviderId}` : provider;
    if (provider === "custom" && !customProviderId) return;
    if (
      !keys.length &&
      !hasStoredKey[provider] &&
      provider !== "ollama" &&
      provider !== "custom" &&
      !(provider === "deepseek" && deepseekHasKey)
    ) {
      return;
    }

    const keysToTest =
      keys.length > 0
        ? keys
        : apiKeysStored[provider] ?? [];

    setTestStatus((prev) => ({ ...prev, [statusKey]: "testing" }));
    setTestError((prev) => ({ ...prev, [statusKey]: "" }));
    if (keysToTest.length) {
      setKeyTestResults((prev) => ({
        ...prev,
        [provider]: keysToTest.map(() => "testing" as const),
      }));
      setKeyTestErrors((prev) => ({ ...prev, [provider]: keysToTest.map(() => "") }));
    }

    try {
      const result = await window.electronAPI?.testLlmConnection?.(
        provider as
          | "gemini"
          | "groq"
          | "openai"
          | "claude"
          | "deepseek"
          | "ollama"
          | "custom",
        keysToTest.length ? keysToTest : undefined,
        customProviderId,
      );

      if (result?.keyResults?.length) {
        setKeyTestResults((prev) => ({
          ...prev,
          [provider]: result.keyResults!.map((r) =>
            r.success ? "success" : "error",
          ),
        }));
        setKeyTestErrors((prev) => ({
          ...prev,
          [provider]: result.keyResults!.map((r) => r.error ?? ""),
        }));
      } else if (result?.success && keysToTest.length) {
        setKeyTestResults((prev) => ({
          ...prev,
          [provider]: keysToTest.map(() => "success" as const),
        }));
      }

      if (result?.success) {
        setTestStatus((prev) => ({ ...prev, [statusKey]: "success" }));
        setTimeout(() => {
          setTestStatus((prev) => ({ ...prev, [statusKey]: "idle" }));
          setKeyTestResults((prev) => ({ ...prev, [provider]: [] }));
          setKeyTestErrors((prev) => ({ ...prev, [provider]: [] }));
        }, 3000);
      } else {
        setTestStatus((prev) => ({ ...prev, [statusKey]: "error" }));
        setTestError((prev) => ({
          ...prev,
          [statusKey]: result?.error || "Connection failed",
        }));
      }
    } catch (e: unknown) {
      setTestStatus((prev) => ({ ...prev, [statusKey]: "error" }));
      setTestError((prev) => ({
        ...prev,
        [statusKey]:
          e instanceof Error ? e.message : "Connection failed",
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
          <div className="flex flex-col gap-4">
          {isVisible("gemini") && (
          <ProviderCard
            providerId="gemini"
            providerName="Gemini"
            storedKeys={apiKeysStored.gemini ?? []}
            preferredModel={preferredModels.gemini}
            onSaveKeys={(keys) => saveProviderKeys("gemini", keys)}
            onRemoveAllKeys={() => void clearProviderKeys("gemini")}
            onTestConnection={(keys) => handleTestConnection("gemini", keys)}
            testStatus={testStatus.gemini || "idle"}
            testError={testError.gemini}
            keyTestResults={keyTestResults.gemini}
            keyTestErrors={keyTestErrors.gemini}
            savingStatus={!!savingStatus.gemini}
            savedStatus={!!savedStatus.gemini}
            keyUrl="https://aistudio.google.com/app/apikey"
            onPreferredModelChange={(model) =>
              setPreferredModels((prev) => ({ ...prev, gemini: model }))
            }
            onRemoveFromList={() => unpinIntegration("gemini")}
          />
          )}

          {isVisible("groq") && (
          <ProviderCard
            providerId="groq"
            providerName="Groq"
            storedKeys={apiKeysStored.groq ?? []}
            preferredModel={preferredModels.groq}
            onSaveKeys={(keys) => saveProviderKeys("groq", keys)}
            onRemoveAllKeys={() => void clearProviderKeys("groq")}
            onTestConnection={(keys) => handleTestConnection("groq", keys)}
            testStatus={testStatus.groq || "idle"}
            testError={testError.groq}
            keyTestResults={keyTestResults.groq}
            keyTestErrors={keyTestErrors.groq}
            savingStatus={!!savingStatus.groq}
            savedStatus={!!savedStatus.groq}
            keyUrl="https://console.groq.com/keys"
            onPreferredModelChange={(model) =>
              setPreferredModels((prev) => ({ ...prev, groq: model }))
            }
            onRemoveFromList={() => unpinIntegration("groq")}
          />
          )}

          {isVisible("openai") && (
          <ProviderCard
            providerId="openai"
            providerName="OpenAI"
            storedKeys={apiKeysStored.openai ?? []}
            preferredModel={preferredModels.openai}
            onSaveKeys={(keys) => saveProviderKeys("openai", keys)}
            onRemoveAllKeys={() => void clearProviderKeys("openai")}
            onTestConnection={(keys) => handleTestConnection("openai", keys)}
            testStatus={testStatus.openai || "idle"}
            testError={testError.openai}
            keyTestResults={keyTestResults.openai}
            keyTestErrors={keyTestErrors.openai}
            savingStatus={!!savingStatus.openai}
            savedStatus={!!savedStatus.openai}
            keyUrl="https://platform.openai.com/api-keys"
            onPreferredModelChange={(model) =>
              setPreferredModels((prev) => ({ ...prev, openai: model }))
            }
            onRemoveFromList={() => unpinIntegration("openai")}
          />
          )}

          {isVisible("claude") && (
          <ProviderCard
            providerId="claude"
            providerName="Claude"
            storedKeys={apiKeysStored.claude ?? []}
            preferredModel={preferredModels.claude}
            onSaveKeys={(keys) => saveProviderKeys("claude", keys)}
            onRemoveAllKeys={() => void clearProviderKeys("claude")}
            onTestConnection={(keys) => handleTestConnection("claude", keys)}
            testStatus={testStatus.claude || "idle"}
            testError={testError.claude}
            keyTestResults={keyTestResults.claude}
            keyTestErrors={keyTestErrors.claude}
            savingStatus={!!savingStatus.claude}
            savedStatus={!!savedStatus.claude}
            keyUrl="https://console.anthropic.com/settings/keys"
            oauthAlternativeNote={t("providers.claudeApiOptional")}
            onPreferredModelChange={(model) =>
              setPreferredModels((prev) => ({ ...prev, claude: model }))
            }
            onRemoveFromList={() => unpinIntegration("claude")}
          />
          )}

          {isVisible("deepseek") && (
          <DeepSeekProviderCard
            storedKeys={apiKeysStored.deepseek ?? []}
            model={deepseekModel}
            saving={deepseekSaving}
            saved={deepseekSaved}
            onModelChange={setDeepseekModel}
            onSaveKeys={async (keys) => {
              setDeepseekSaving(true);
              try {
                await saveProviderKeys("deepseek", keys);
                await window.electronAPI?.setDeepseekModel?.(deepseekModel);
                setDeepseekSaved(true);
                setTimeout(() => setDeepseekSaved(false), 2000);
              } catch (e) {
                console.error("Failed to save DeepSeek settings:", e);
              } finally {
                setDeepseekSaving(false);
              }
            }}
            onRemoveAllKeys={async () => {
              await clearProviderKeys("deepseek");
              setDeepseekSaved(false);
            }}
            onTestConnection={(keys) =>
              void handleTestConnection("deepseek", keys)
            }
            testStatus={testStatus.deepseek || "idle"}
            testError={testError.deepseek}
            keyTestResults={keyTestResults.deepseek}
            keyTestErrors={keyTestErrors.deepseek}
            onRemoveFromList={() => unpinIntegration("deepseek")}
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
            testLabel={t("providers.validateExecutable")}
            onSecondaryTest={handleTestCodexInference}
            secondaryTestLabel={t("providers.testConnection")}
            secondaryTestStatus={codexInferenceStatus}
            secondaryTestError={codexInferenceError}
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
        <OllamaProviderCard
          status={ollamaStatus}
          models={ollamaModels}
          isRefreshing={isRefreshingOllama}
          onRefresh={async () => {
            setIsRefreshingOllama(true);
            await checkOllama(false);
            setTimeout(() => setIsRefreshingOllama(false), 500);
          }}
          onAutoFix={handleFixOllama}
          onTestConnection={() => void handleTestConnection("ollama", [])}
          testStatus={testStatus.ollama || "idle"}
          testError={testError.ollama}
          onRemoveFromList={() => unpinIntegration("ollama")}
        />
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
                <CustomProviderCard
                  key={provider.id}
                  provider={provider}
                  onEdit={() => handleEditProvider(provider)}
                  onDelete={() => handleDeleteCustom(provider.id)}
                  onTest={() =>
                    void handleTestConnection("custom", [], provider.id)
                  }
                  testStatus={testStatus[`custom:${provider.id}`] || "idle"}
                  testError={testError[`custom:${provider.id}`]}
                />
              ))
            )}
          </div>
        )}
      </SettingsSection>
      )}
    </div>
  );
};
