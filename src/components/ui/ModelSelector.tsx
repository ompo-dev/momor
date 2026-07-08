import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Check,
  Cloud,
  Terminal,
  Monitor,
  Server,
  Plus,
} from "lucide-react";
import {
  getCodexCliModelDisplayName,
  STANDARD_CLOUD_MODELS,
  prettifyModelId,
} from "../../utils/modelUtils";

interface ModelSelectorProps {
  currentModel: string;
  onSelectModel: (model: string) => void;
}

interface CustomProvider {
  id: string;
  name: string;
  curlCommand: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModel,
  onSelectModel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"cloud" | "custom" | "local">(
    "cloud",
  );
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);
  const [cloudModels, setCloudModels] = useState<
    { id: string; name: string; desc: string; provider: string }[]
  >([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load Data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      try {
        // Load Custom
        const custom =
          (await window.electronAPI?.getCustomProviders()) as CustomProvider[];
        if (custom) setCustomProviders(custom);

        // Load Ollama
        const local =
          (await window.electronAPI?.getAvailableOllamaModels()) as string[];
        if (local) setOllamaModels(local);

        // Build dynamic cloud models from credentials
        // @ts-ignore
        const creds = await window.electronAPI?.getStoredCredentials?.();
        const cModels: {
          id: string;
          name: string;
          desc: string;
          provider: string;
        }[] = [];

        if (creds?.hasmomorKey) {
          cModels.push({
            id: "momor",
            name: "Momor API",
            desc: "Managed AI • Fast execution",
            provider: "momor",
          });
        }
        for (const [prov, cfg] of Object.entries(STANDARD_CLOUD_MODELS)) {
          if (!cfg.hasKeyCheck(creds)) continue;
          cfg.ids.forEach((id, i) =>
            cModels.push({
              id,
              name: cfg.names[i],
              desc: cfg.descs[i],
              provider: prov,
            }),
          );
          const pm = creds?.[cfg.pmKey];
          if (pm && !cfg.ids.includes(pm)) {
            cModels.push({
              id: pm,
              name: prettifyModelId(pm),
              desc: `${prov.charAt(0).toUpperCase() + prov.slice(1)} • Preferred`,
              provider: prov,
            });
          }
        }
        setCloudModels(cModels);
      } catch (e) {
        console.error("Failed to load models:", e);
      }
    };
    loadData();
  }, [isOpen]);

  const handleSelect = (model: string) => {
    // For custom/local, we might need to pass an ID or specific format
    // The backend logic (LLMHelper) needs to know how to handle this string or we need a richer object
    // For now, consistent with existing app, we pass a string.
    // We'll rely on a prefix convention or just the name if unique enough,
    // OR the app state handling this selection needs to store provider type.
    // Assuming onSelectModel handles the switching logic.

    onSelectModel(model);
    setIsOpen(false);
  };

  const getModelDisplayName = (model: string) => {
    const codexCliName = getCodexCliModelDisplayName(model);
    if (codexCliName) return codexCliName;
    if (model.startsWith("ollama-")) return model.replace("ollama-", "");
    if (model === "gemini-3.1-flash-lite-preview") return "Gemini 3.1 Flash";
    if (model === "gemini-3.1-pro-preview") return "Gemini 3.1 Pro";
    if (model === "llama-3.3-70b-versatile") return "Groq Llama 3.3";
    if (model === "gpt-5.4") return "GPT 5.4";
    if (model === "claude-sonnet-4-6") return "Sonnet 4.6";

    // Check dynamic cloud models
    const cloud = cloudModels.find((m) => m.id === model);
    if (cloud) return cloud.name;

    // Check custom providers
    const custom = customProviders.find(
      (p) => p.id === model || p.name === model,
    );
    if (custom) return custom.name;

    return model;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex max-w-[150px] items-center gap-2 rounded-sm border border-border-subtle/80 bg-background/22 px-3 py-1.5 text-[11px] font-medium text-text-primary transition-colors hover:bg-background/34"
      >
        <span className="truncate">{getModelDisplayName(currentModel)}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-text-secondary transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-sm border border-border-subtle/80 bg-card/96 shadow-[0_24px_64px_-42px_rgba(0,0,0,0.85)] animated fadeIn">
          {/* Tabs */}
          <div className="flex border-b border-border-subtle/80 bg-background/18">
            <button
              onClick={() => setActiveTab("cloud")}
              className={`flex-1 border-b px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${activeTab === "cloud" ? "border-b-accent-primary text-text-primary" : "border-b-transparent text-text-secondary hover:text-text-primary"}`}
            >
              Cloud
            </button>
            <button
              onClick={() => setActiveTab("custom")}
              className={`flex-1 border-b px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${activeTab === "custom" ? "border-b-accent-primary text-text-primary" : "border-b-transparent text-text-secondary hover:text-text-primary"}`}
            >
              Custom
            </button>
            <button
              onClick={() => setActiveTab("local")}
              className={`flex-1 border-b px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${activeTab === "local" ? "border-b-accent-primary text-text-primary" : "border-b-transparent text-text-secondary hover:text-text-primary"}`}
            >
              Local
            </button>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto p-1.5">
            {/* Cloud Models */}
            {activeTab === "cloud" && (
              <div className="space-y-1">
                {cloudModels.length === 0 ? (
                  <div className="border-l border-border-subtle/80 py-4 pl-3 text-text-tertiary">
                    <p className="text-[11px] mb-1">
                      No cloud providers configured.
                    </p>
                    <p className="text-[10px] opacity-70">
                      Add API keys in Settings.
                    </p>
                  </div>
                ) : (
                  cloudModels.map((m, idx) => {
                    const prevProvider =
                      idx > 0 ? cloudModels[idx - 1].provider : null;
                    const showDivider =
                      prevProvider && prevProvider !== m.provider;
                    const icon =
                      m.provider === "gemini" ? (
                        <Monitor size={14} />
                      ) : (
                        <Cloud size={14} />
                      );
                    return (
                      <React.Fragment key={m.id}>
                        {showDivider && (
                          <div className="h-px bg-border-subtle my-1" />
                        )}
                        <ModelOption
                          id={m.id}
                          name={m.name}
                          desc={m.desc}
                          icon={icon}
                          selected={currentModel === m.id}
                          onSelect={() => handleSelect(m.id)}
                        />
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            )}

            {/* Custom Models */}
            {activeTab === "custom" && (
              <div className="space-y-1">
                {customProviders.length === 0 ? (
                  <div className="border-l border-border-subtle/80 py-4 pl-3 text-text-tertiary">
                    <p className="text-[11px] mb-1">No custom providers.</p>
                    <button className="text-[10px] text-accent-primary hover:underline">
                      Manage in Settings
                    </button>
                  </div>
                ) : (
                  customProviders.map((provider) => (
                    <ModelOption
                      key={provider.id}
                      id={provider.id}
                      name={provider.name}
                      desc="Custom cURL"
                      icon={<Terminal size={14} />}
                      selected={currentModel === provider.id}
                      onSelect={() => handleSelect(provider.id)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Local Models (Ollama) */}
            {activeTab === "local" && (
              <div className="space-y-1">
                {ollamaModels.length === 0 ? (
                  <div className="border-l border-border-subtle/80 py-4 pl-3 text-text-tertiary">
                    <p className="text-[11px]">No Ollama models found.</p>
                    <p className="text-[10px] mt-1 opacity-70">
                      Ensure Ollama is running.
                    </p>
                  </div>
                ) : (
                  ollamaModels.map((model) => (
                    <ModelOption
                      key={model}
                      id={`ollama-${model}`}
                      name={model}
                      desc="Local"
                      icon={<Server size={14} />}
                      selected={currentModel === `ollama-${model}`}
                      onSelect={() => handleSelect(`ollama-${model}`)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface ModelOptionProps {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}

const ModelOption: React.FC<ModelOptionProps> = ({
  name,
  desc,
  icon,
  selected,
  onSelect,
}) => (
  <button
    onClick={onSelect}
    className={`group flex w-full items-center justify-between rounded-sm border px-2.5 py-2 transition-colors ${selected ? "border-accent-primary/30 bg-accent-primary/[0.07]" : "border-transparent hover:border-border-subtle/80 hover:bg-background/24"}`}
  >
    <div className="flex items-center gap-3">
      <div
        className={`flex h-7 w-7 items-center justify-center rounded-sm border ${selected ? "border-accent-primary/25 bg-accent-primary/15 text-accent-primary" : "border-border-subtle/80 bg-background/22 text-text-secondary group-hover:text-text-primary"}`}
      >
        {icon}
      </div>
      <div className="text-left">
        <div
          className={`max-w-[140px] truncate text-[11px] font-medium ${selected ? "text-accent-primary" : "text-text-primary"}`}
        >
          {name}
        </div>
        <div className="text-[10px] text-text-tertiary">{desc}</div>
      </div>
    </div>
    {selected && <Check size={14} className="text-accent-primary" />}
  </button>
);
