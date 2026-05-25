import {
  CODEX_CLI_MODEL,
  CODEX_CLI_MODEL_PRESETS,
  codexCliSelectorId,
  getCodexCliModelDisplayName,
  STANDARD_CLOUD_MODELS,
  prettifyModelId,
} from "../utils/modelUtils";

export interface ModelOption {
  id: string;
  name: string;
  type: "cloud" | "local" | "custom" | "ollama" | "codex-cli";
  provider?: string;
}

export function readCachedModels(): ModelOption[] {
  try {
    const cached = localStorage.getItem("cached-models");
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

export async function loadAvailableModels(): Promise<ModelOption[]> {
  const creds = await window.electronAPI?.getStoredCredentials?.();
  const customProviders =
    (await window.electronAPI?.getCustomProviders?.()) || [];
  const codexCliConfig = await window.electronAPI?.getCodexCliConfig?.();

  let ollamaModels: string[] = [];
  try {
    let oModels = await window.electronAPI?.getAvailableOllamaModels?.();
    if (!oModels || oModels.length === 0) {
      try {
        if (window.electronAPI?.forceRestartOllama) {
          await window.electronAPI.forceRestartOllama();
          await new Promise((resolve) => setTimeout(resolve, 1500));
          oModels = await window.electronAPI?.getAvailableOllamaModels?.();
        }
      } catch {
        // ignore
      }
    }
    if (oModels) ollamaModels = oModels;
  } catch {
    // ignore
  }

  const models: ModelOption[] = [];

  if (creds?.hasmomorKey) {
    models.push({
      id: "momor",
      name: "Momor API",
      type: "cloud",
      provider: "momor",
    });
  }

  for (const [prov, cfg] of Object.entries(STANDARD_CLOUD_MODELS)) {
    if (!cfg.hasKeyCheck(creds)) continue;
    cfg.ids.forEach((id, i) => {
      models.push({
        id,
        name: cfg.names[i],
        type: "cloud",
        provider: prov,
      });
    });
    const pm = creds?.[cfg.pmKey];
    if (pm && !cfg.ids.includes(pm)) {
      models.push({
        id: pm,
        name: prettifyModelId(pm),
        type: "cloud",
        provider: prov,
      });
    }
  }

  customProviders.forEach((p: { id: string; name: string }) => {
    models.push({ id: p.id, name: p.name, type: "custom" });
  });

  if (codexCliConfig?.enabled) {
    models.push({
      id: CODEX_CLI_MODEL.id,
      name: `${CODEX_CLI_MODEL.name} (${prettifyModelId(codexCliConfig.model)})`,
      type: "codex-cli",
      provider: "codex-cli",
    });
    CODEX_CLI_MODEL_PRESETS.forEach((model) => {
      const id = codexCliSelectorId(model.id);
      models.push({
        id,
        name: getCodexCliModelDisplayName(id) || model.name,
        type: "codex-cli",
        provider: "codex-cli",
      });
    });
  }

  ollamaModels.forEach((m: string) => {
    models.push({
      id: `ollama-${m}`,
      name: `${m} (Local)`,
      type: "ollama",
    });
  });

  localStorage.setItem("cached-models", JSON.stringify(models));
  return models;
}
