import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Trash2, HardDrive, Check, Loader2, Zap, AlertCircle, ChevronDown, Server, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ModelInfo {
    id: string;
    name: string;
    sizeMb: number;
    speed: 'very-fast' | 'fast' | 'medium' | 'slow';
    accuracy: 'decent' | 'good' | 'high' | 'very-high';
    multilingual: boolean;
    status: 'available' | 'missing' | 'downloading' | 'error';
    errorMessage?: string;
    requiresAppleSilicon?: boolean;
    staticKV?: boolean;
}

interface HardwareInfo {
    arch: string;
    platform: string;
    isAppleSilicon: boolean;
    totalRamGb: number;
    tier: 'excellent' | 'good' | 'limited';
    recommendation: string;
    recommendedModel: string;
}

type ModelStatusFilter = 'all' | 'installed' | 'notInstalled' | 'downloading';
type ModelLangFilter = 'all' | 'multilingual' | 'english';

interface ChannelConfig {
    enabled: boolean;
    micModelId: string;
    systemModelId: string;
    globalModelId: string;
}

const electronAPI = (window as any).electronAPI;

function PremiumSelect({ label, value, options, onChange, placeholder }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find((o: any) => o.id === value)?.name || placeholder;

    return (
        <div ref={containerRef} className="relative z-20">
            {label && <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">{label}</label>}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full group bg-bg-input border border-border-subtle hover:border-border-muted shadow-sm rounded-xl px-3.5 py-2.5 flex items-center justify-between transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none focus:ring-2 focus:ring-accent-primary/20 ${isOpen ? 'ring-2 ring-accent-primary/20 border-accent-primary/50' : ''}`}
            >
                <span className="text-sm text-text-primary font-medium truncate pr-4">{selectedLabel}</span>
                <ChevronDown size={14} className={`text-text-tertiary transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:text-text-secondary ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        key="dropdown"
                        initial={{ opacity: 0, y: 4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute top-full left-0 w-full mt-2 bg-bg-elevated border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden ring-1 ring-black/5"
                    >
                        <div className="max-h-[240px] overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                            {options.map((option: any) => {
                                const isSelected = value === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => { onChange(option.id); setIsOpen(false); }}
                                        className={`w-full rounded-[10px] px-3 py-2.5 flex items-center justify-between transition-all duration-200 group relative ${isSelected ? 'bg-bg-item-active text-text-primary shadow-inner' : 'hover:bg-bg-item-surface text-text-secondary hover:text-text-primary'}`}
                                    >
                                        <span className="text-sm font-medium">{option.name}</span>
                                        {isSelected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}><Check size={16} className="text-accent-primary" strokeWidth={3} /></motion.div>}
                                    </button>
                                );
                            })}
                            {options.length === 0 && (
                                <div className="px-3 py-2.5 text-sm text-text-tertiary italic text-center">No models available</div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export interface LocalWhisperModelPanelProps {
    /** Hide WhisperX server block; use inside STT profile cards */
    embedded?: boolean;
    /** Persist model id on the STT profile when user picks a model */
    onModelChange?: (modelId: string) => void;
}

export function LocalWhisperModelPanel({
    embedded = false,
    onModelChange,
}: LocalWhisperModelPanelProps = {}) {
    const { t } = useTranslation();
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [hardware, setHardware] = useState<HardwareInfo | null>(null);
    const [config, setConfig] = useState<ChannelConfig>({
        enabled: false,
        micModelId: '',
        systemModelId: '',
        globalModelId: ''
    });
    
    const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
    const [downloadingSet, setDownloadingSet] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [managerExpanded, setManagerExpanded] = useState(!embedded);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<ModelStatusFilter>('all');
    const [langFilter, setLangFilter] = useState<ModelLangFilter>('all');
    const [hideIncompatible, setHideIncompatible] = useState(false);
    const [recommendedOnly, setRecommendedOnly] = useState(false);

    // WhisperX Local Server state
    const [whisperxEnabled, setWhisperxEnabled] = useState(false);
    const [whisperxUrl, setWhisperxUrl] = useState('http://localhost:8000');
    const [whisperxSaving, setWhisperxSaving] = useState(false);
    const [whisperxSaved, setWhisperxSaved] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [modelsRes, hwRes, cfgRes] = await Promise.all([
                electronAPI?.localWhisperGetModels?.(),
                electronAPI?.localWhisperGetHardware?.(),
                electronAPI?.localWhisperGetChannelConfig?.()
            ]);
            
            if (modelsRes) setModels(modelsRes.models ?? []);
            if (hwRes) setHardware(hwRes);
            if (cfgRes) setConfig(cfgRes);
            
            // Auto-select initial models if none are set
            if (cfgRes && modelsRes && modelsRes.models) {
                const list = modelsRes.models;
                const avail = list.filter((m: any) => m.status === 'available');
                if (avail.length > 0) {
                    let needsUpdate = false;
                    const newCfg = { ...cfgRes };
                    
                    if (!cfgRes.globalModelId) {
                        newCfg.globalModelId = avail[0].id;
                        electronAPI?.localWhisperSetModel?.(avail[0].id);
                        needsUpdate = true;
                    }
                    if (!cfgRes.micModelId) {
                        newCfg.micModelId = avail[0].id;
                        needsUpdate = true;
                    }
                    if (!cfgRes.systemModelId) {
                        newCfg.systemModelId = avail[0].id;
                        needsUpdate = true;
                    }
                    
                    if (needsUpdate) {
                        setConfig(newCfg);
                        electronAPI?.localWhisperSetChannelConfig?.(newCfg);
                    }
                }
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        // Load WhisperX config
        electronAPI?.getWhisperXConfig?.().then((cfg: { url: string; enabled: boolean }) => {
            if (cfg) {
                setWhisperxEnabled(cfg.enabled);
                setWhisperxUrl(cfg.url || 'http://localhost:8000');
            }
        }).catch(() => {});
    }, [loadData]);

    const saveWhisperXConfig = async () => {
        setWhisperxSaving(true);
        try {
            await electronAPI?.setWhisperXConfig?.({ url: whisperxUrl, enabled: whisperxEnabled });
            setWhisperxSaved(true);
            setTimeout(() => setWhisperxSaved(false), 2000);
        } finally {
            setWhisperxSaving(false);
        }
    };

    // Handle downloads
    useEffect(() => {
        const unsubProgress = electronAPI?.onLocalWhisperDownloadProgress?.((data: { modelId: string; progress: number }) => {
            setDownloadProgress(prev => ({ ...prev, [data.modelId]: data.progress }));
        });
        const unsubComplete = electronAPI?.onLocalWhisperDownloadComplete?.((data: { modelId: string }) => {
            setDownloadingSet(prev => { const s = new Set(prev); s.delete(data.modelId); return s; });
            setDownloadProgress(prev => { const d = { ...prev }; delete d[data.modelId]; return d; });
            loadData();
        });
        const unsubError = electronAPI?.onLocalWhisperDownloadError?.((data: { modelId: string; error: string }) => {
            setDownloadingSet(prev => { const s = new Set(prev); s.delete(data.modelId); return s; });
            setDownloadProgress(prev => { const d = { ...prev }; delete d[data.modelId]; return d; });
            setModels(prev => prev.map(m => m.id === data.modelId ? { ...m, status: 'error', errorMessage: data.error } : m));
        });
        
        return () => { unsubProgress?.(); unsubComplete?.(); unsubError?.(); };
    }, [loadData]);

    const handleDownload = async (modelId: string) => {
        if (downloadingSet.has(modelId)) return;
        setDownloadingSet(prev => new Set([...prev, modelId]));
        setModels(prev => prev.map(m => m.id === modelId ? { ...m, status: 'downloading' } : m));
        setDownloadProgress(prev => ({ ...prev, [modelId]: 0 }));
        
        const result = await electronAPI?.localWhisperStartDownload?.(modelId);
        if (!result?.success && result?.error !== 'already-downloading') {
            setDownloadingSet(prev => { const s = new Set(prev); s.delete(modelId); return s; });
            setDownloadProgress(prev => { const d = { ...prev }; delete d[modelId]; return d; });
            setModels(prev => prev.map(m => m.id === modelId
                ? { ...m, status: 'error', errorMessage: result?.error ?? 'Download failed' }
                : m
            ));
        }
    };

    const handleDelete = async (modelId: string) => {
        await electronAPI?.localWhisperDeleteModel?.(modelId);
        await loadData();
    };

    const toggleDualChannel = async (enabled: boolean) => {
        const newCfg = { ...config, enabled };
        setConfig(newCfg);
        await electronAPI?.localWhisperSetChannelConfig?.({ enabled });
    };

    const notifyModelChange = (modelId: string) => {
        if (modelId) onModelChange?.(modelId);
    };

    const setGlobalModel = async (modelId: string) => {
        setConfig(prev => ({ ...prev, globalModelId: modelId }));
        await electronAPI?.localWhisperSetModel?.(modelId);
        notifyModelChange(modelId);
    };

    const setMicModel = async (modelId: string) => {
        setConfig(prev => ({ ...prev, micModelId: modelId }));
        await electronAPI?.localWhisperSetChannelConfig?.({ micModelId: modelId });
        notifyModelChange(modelId);
    };

    const setSystemModel = async (modelId: string) => {
        setConfig(prev => ({ ...prev, systemModelId: modelId }));
        await electronAPI?.localWhisperSetChannelConfig?.({ systemModelId: modelId });
        notifyModelChange(modelId);
    };

    const availableModels = models.filter(m => m.status === 'available');

    const filteredModels = useMemo(() => {
        let list = models;
        const q = searchQuery.trim().toLowerCase();

        if (q) {
            list = list.filter(
                (m) =>
                    m.name.toLowerCase().includes(q) ||
                    m.id.toLowerCase().includes(q),
            );
        }

        if (statusFilter === 'installed') {
            list = list.filter((m) => m.status === 'available');
        } else if (statusFilter === 'notInstalled') {
            list = list.filter((m) => m.status === 'missing');
        } else if (statusFilter === 'downloading') {
            list = list.filter(
                (m) => m.status === 'downloading' || downloadingSet.has(m.id),
            );
        }

        if (langFilter === 'multilingual') {
            list = list.filter((m) => m.multilingual);
        } else if (langFilter === 'english') {
            list = list.filter((m) => !m.multilingual);
        }

        if (hideIncompatible) {
            list = list.filter((m) => !m.staticKV && !m.requiresAppleSilicon);
        }

        if (recommendedOnly && hardware?.recommendedModel) {
            list = list.filter((m) => m.id === hardware.recommendedModel);
        }

        return list;
    }, [
        models,
        searchQuery,
        statusFilter,
        langFilter,
        hideIncompatible,
        recommendedOnly,
        hardware?.recommendedModel,
        downloadingSet,
    ]);

    const hasActiveFilters =
        searchQuery.trim().length > 0 ||
        statusFilter !== 'all' ||
        langFilter !== 'all' ||
        hideIncompatible ||
        recommendedOnly;

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setLangFilter('all');
        setHideIncompatible(false);
        setRecommendedOnly(false);
    };

    if (loading) {
        return <div className="p-4 flex justify-center text-text-tertiary"><Loader2 className="animate-spin w-5 h-5" /></div>;
    }

        const sectionClass = embedded
        ? "space-y-4"
        : "bg-bg-card rounded-xl border border-border-subtle p-5 shadow-sm";

    const titleClass = embedded ? "text-foreground" : "text-text-primary";
    const mutedClass = embedded ? "text-muted-foreground" : "text-text-secondary";

    return (
        <div className="space-y-4">
            <div className={sectionClass}>
                <div className={embedded ? "space-y-1" : "mb-5"}>
                    <h3 className={`text-sm font-semibold ${titleClass}`}>{t('whisper.localEngine')}</h3>
                    <p className={`text-xs mt-1 leading-relaxed ${mutedClass}`}>{t('whisper.localEngineDesc')}</p>
                </div>

                <label className={`flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 cursor-pointer group ${embedded ? "mb-4" : "mb-5 rounded-xl border-border-subtle bg-bg-elevated/30 p-3.5"}`}>
                    <input 
                        type="checkbox" 
                        className="hidden" 
                        checked={config.enabled} 
                        onChange={(e) => toggleDualChannel(e.target.checked)} 
                    />
                    <div>
                        <span className="text-sm font-medium text-text-primary block transition-colors group-hover:text-accent-primary">{t('whisper.splitChannels')}</span>
                        <span className="text-xs text-text-tertiary mt-0.5 block">{t('whisper.splitChannelsDesc')}</span>
                    </div>
                    <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-opacity-75 ${config.enabled ? 'bg-accent-primary' : 'bg-border-muted'}`}>
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${config.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                </label>

                <div className="space-y-4 relative z-10">
                    <AnimatePresence mode="wait">
                        {config.enabled ? (
                            <motion.div 
                                key="split"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className={embedded ? "flex flex-col gap-3" : "grid grid-cols-2 gap-4"}
                            >
                                <PremiumSelect
                                    label={t('whisper.micModel')}
                                    value={config.micModelId}
                                    onChange={setMicModel}
                                    options={availableModels}
                                    placeholder={t('whisper.selectMicModel')}
                                />
                                <PremiumSelect
                                    label={t('whisper.systemModel')}
                                    value={config.systemModelId}
                                    onChange={setSystemModel}
                                    options={availableModels}
                                    placeholder={t('whisper.selectSystemModel')}
                                />
                            </motion.div>
                        ) : (
                            <motion.div 
                                key="global"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                                <PremiumSelect
                                    label={t('whisper.globalModel')}
                                    value={config.globalModelId}
                                    onChange={setGlobalModel}
                                    options={availableModels}
                                    placeholder={t('whisper.selectGlobalModel')}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className={`${embedded ? "rounded-lg border border-border overflow-hidden" : "bg-bg-card rounded-xl border border-border-subtle overflow-hidden shadow-sm"} relative z-0`}>
                <button
                    type="button"
                    className="w-full px-5 py-4 bg-bg-elevated/50 border-b border-border-subtle flex justify-between items-center gap-3 text-left hover:bg-bg-elevated/70 transition-colors"
                    onClick={() => setManagerExpanded((v) => !v)}
                    aria-expanded={managerExpanded}
                >
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-text-primary">{t('whisper.modelManager')}</h3>
                            <span className="rounded-full bg-bg-input px-2 py-0.5 text-[10px] font-medium text-text-tertiary border border-border-subtle">
                                {t('whisper.modelsCount', {
                                    shown: filteredModels.length,
                                    total: models.length,
                                })}
                            </span>
                        </div>
                        {hardware?.recommendedModel && !managerExpanded && (
                            <p className="mt-1 text-[11px] text-text-tertiary truncate">
                                {t('whisper.recommendedFor', { device: hardware.isAppleSilicon ? 'Mac' : 'PC' })}:{' '}
                                <span className="text-text-primary">{models.find(m => m.id === hardware.recommendedModel)?.name}</span>
                            </p>
                        )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {hardware?.recommendedModel && managerExpanded && (
                            <span className="hidden sm:inline text-[11px] text-text-tertiary font-medium bg-bg-input px-2 py-1 rounded-md border border-border-subtle">
                                {t('whisper.recommendedFor', { device: hardware.isAppleSilicon ? 'Mac' : 'PC' })}: <span className="text-text-primary">{models.find(m => m.id === hardware.recommendedModel)?.name}</span>
                            </span>
                        )}
                        <ChevronDown
                            size={16}
                            className={cn(
                                'text-text-tertiary transition-transform duration-200',
                                managerExpanded && 'rotate-180',
                            )}
                        />
                    </div>
                </button>

                <AnimatePresence initial={false}>
                    {managerExpanded && (
                        <motion.div
                            key="manager-body"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="overflow-hidden"
                        >
                            <div className="border-b border-border-subtle bg-bg-elevated/30 px-4 py-3 space-y-3">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                                    <Input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={t('whisper.searchModels')}
                                        className="h-9 pl-9 pr-9 text-xs bg-bg-input border-border-subtle"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-tertiary hover:text-text-primary"
                                            onClick={() => setSearchQuery('')}
                                            aria-label={t('whisper.clearFilters')}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {([
                                        ['all', t('whisper.filterAll')],
                                        ['installed', t('whisper.filterInstalled')],
                                        ['notInstalled', t('whisper.filterNotInstalled')],
                                        ['downloading', t('whisper.filterDownloading')],
                                    ] as const).map(([value, label]) => (
                                        <Button
                                            key={value}
                                            type="button"
                                            size="sm"
                                            variant={statusFilter === value ? 'default' : 'outline'}
                                            className="h-7 px-2.5 text-[11px]"
                                            onClick={() => setStatusFilter(value)}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {([
                                        ['all', t('whisper.filterLangAll')],
                                        ['english', t('whisper.filterEnglish')],
                                        ['multilingual', t('whisper.filterMultilingual')],
                                    ] as const).map(([value, label]) => (
                                        <Button
                                            key={value}
                                            type="button"
                                            size="sm"
                                            variant={langFilter === value ? 'secondary' : 'ghost'}
                                            className="h-7 px-2.5 text-[11px]"
                                            onClick={() => setLangFilter(value)}
                                        >
                                            {label}
                                        </Button>
                                    ))}
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={hideIncompatible ? 'secondary' : 'ghost'}
                                        className="h-7 px-2.5 text-[11px]"
                                        onClick={() => setHideIncompatible((v) => !v)}
                                    >
                                        {t('whisper.hideIncompatible')}
                                    </Button>
                                    {hardware?.recommendedModel && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={recommendedOnly ? 'secondary' : 'ghost'}
                                            className="h-7 px-2.5 text-[11px]"
                                            onClick={() => setRecommendedOnly((v) => !v)}
                                        >
                                            {t('common.recommended')}
                                        </Button>
                                    )}
                                    {hasActiveFilters && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 px-2.5 text-[11px] text-muted-foreground"
                                            onClick={clearFilters}
                                        >
                                            {t('whisper.clearFilters')}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="max-h-[min(420px,50vh)] overflow-y-auto p-4 space-y-3 bg-bg-elevated/20 custom-scrollbar">
                                {filteredModels.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border-subtle px-4 py-8 text-center">
                                        <p className="text-xs text-text-tertiary">{t('whisper.noModelsMatch')}</p>
                                        {hasActiveFilters && (
                                            <Button
                                                type="button"
                                                variant="link"
                                                size="sm"
                                                className="mt-2 h-auto p-0 text-xs"
                                                onClick={clearFilters}
                                            >
                                                {t('whisper.clearFilters')}
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    filteredModels.map(model => {
                        const isDownloading = model.status === 'downloading' || downloadingSet.has(model.id);
                        const progress = downloadProgress[model.id] || 0;
                        const isAvailable = model.status === 'available';
                        const isRecommended = hardware?.recommendedModel === model.id;
                        const isStaticKV = !!model.staticKV;

                        return (
                            <div key={model.id} className={`p-4 flex items-center justify-between bg-bg-card border border-border-subtle rounded-[14px] hover:shadow-sm hover:border-border-muted transition-all duration-200 ${isStaticKV ? 'opacity-60' : ''}`}>
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-sm font-medium text-text-primary truncate tracking-tight">{model.name}</span>
                                        {isRecommended && (
                                            <span className="px-1.5 py-0.5 rounded-[4px] bg-accent-primary/10 text-accent-primary text-[9px] font-bold uppercase tracking-wider">{t('common.recommended')}</span>
                                        )}
                                        {isStaticKV && (
                                            <span className="px-1.5 py-0.5 rounded-[4px] bg-yellow-500/15 text-yellow-500 text-[9px] font-bold uppercase tracking-wider">{t('whisper.notCompatible')}</span>
                                        )}
                                        {model.requiresAppleSilicon && (
                                            <span className="px-1.5 py-0.5 rounded-[4px] bg-purple-500/10 text-purple-500 text-[9px] font-bold uppercase tracking-wider">{t('whisper.appleSilicon')}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3.5 text-xs text-text-tertiary">
                                        <span className="flex items-center gap-1.5"><HardDrive size={13} className="opacity-70" /> {model.sizeMb} MB</span>
                                        <span className="flex items-center gap-1.5"><Zap size={13} className="opacity-70" /> {model.speed}</span>
                                        <span className="flex items-center gap-1.5"><Check size={13} className="opacity-70" /> {model.accuracy} acc</span>
                                        <span>{model.multilingual ? t('whisper.filterMultilingual') : t('whisper.filterEnglish')}</span>
                                        {isStaticKV && <span className="text-yellow-500/70 italic">{t('whisper.requiresRuntimeUpdate')}</span>}
                                    </div>

                                    {isDownloading && (
                                        <div className="mt-3.5 pr-8">
                                            <div className="flex justify-between items-center text-[10px] text-text-secondary mb-1.5 uppercase tracking-wider font-semibold">
                                                <span>{t('whisper.downloading')}</span>
                                                <span className="text-accent-primary tabular-nums">{Math.round(progress)}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-bg-input rounded-full overflow-hidden shadow-inner ring-1 ring-inset ring-black/5 dark:ring-white/5">
                                                <div 
                                                    className="h-full bg-accent-primary transition-all duration-300 ease-out relative"
                                                    style={{ width: `${progress}%` }}
                                                >
                                                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {model.status === 'error' && (
                                        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-500">
                                            <AlertCircle size={14} />
                                            {model.errorMessage || t('whisper.failedDownload')}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    {!isAvailable && !isDownloading && !isStaticKV && (
                                        <button
                                            onClick={() => handleDownload(model.id)}
                                            className="group/btn relative h-[34px] px-4 flex items-center gap-1.5 rounded-[10px] bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-[13px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] shadow-sm"
                                        >
                                            <Download size={14} className="transition-transform duration-300 group-hover/btn:-translate-y-[2px]" />
                                            <span>{t('whisper.install')}</span>
                                        </button>
                                    )}
                                    
                                    {isAvailable && (
                                        <button
                                            onClick={() => handleDelete(model.id)}
                                            className="p-2 rounded-[10px] text-text-tertiary hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96]"
                                            title={t('common.delete')}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            
            {/* ── WhisperX Local Server ── */}
            {!embedded && (
            <div className="bg-bg-card rounded-xl border border-border-subtle p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Server size={16} className="text-accent-primary" />
                    <h3 className="text-sm font-semibold text-text-primary">{t('whisper.whisperxServer')}</h3>
                </div>
                <p className="text-xs text-text-secondary mb-4 leading-relaxed">
                    {t('whisper.whisperxServerDesc')}
                    Install with: <code className="bg-bg-input px-1.5 py-0.5 rounded text-[11px] font-mono text-accent-primary">pip install faster-whisper[server]</code>
                </p>

                <label className="flex items-center justify-between p-3.5 rounded-xl border border-border-subtle bg-bg-elevated/30 hover:bg-bg-elevated transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer group mb-4 active:scale-[0.99]">
                    <input
                        type="checkbox"
                        className="hidden"
                        checked={whisperxEnabled}
                        onChange={(e) => setWhisperxEnabled(e.target.checked)}
                    />
                    <div>
                        <span className="text-sm font-medium text-text-primary block transition-colors group-hover:text-accent-primary">{t('whisper.enableWhisperxServer')}</span>
                        <span className="text-xs text-text-tertiary mt-0.5 block">{t('whisper.enableWhisperxServerDesc')}</span>
                    </div>
                    <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${whisperxEnabled ? 'bg-accent-primary' : 'bg-border-muted'}`}>
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${whisperxEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                </label>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wide">{t('whisper.serverUrl')}</label>
                        <input
                            type="text"
                            value={whisperxUrl}
                            onChange={(e) => setWhisperxUrl(e.target.value)}
                            placeholder="http://localhost:8000"
                            className="w-full bg-bg-input border border-border-subtle hover:border-border-muted rounded-xl px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-accent-primary/20 focus:border-accent-primary/50 transition-all duration-200"
                        />
                    </div>
                    <button
                        onClick={saveWhisperXConfig}
                        disabled={whisperxSaving}
                        className="h-[34px] px-4 flex items-center gap-1.5 rounded-[10px] bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-[13px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.96] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {whisperxSaving ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : whisperxSaved ? (
                            <Check size={14} />
                        ) : null}
                        <span>{whisperxSaved ? t('common.save') + '!' : t('common.save')}</span>
                    </button>
                </div>
            </div>
            )}
            
            {/* ── Footer note ── */}
            {hardware?.tier === 'limited' && (
                <div className="pt-1 text-center">
                    <p className="text-[10px] font-medium text-amber-500 dark:text-amber-400/80 uppercase tracking-widest">
                        {t('whisper.limitedHardware')}
                    </p>
                </div>
            )}
        </div>
    );
}
