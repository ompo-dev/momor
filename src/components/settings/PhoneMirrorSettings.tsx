import React, { useCallback, useEffect, useState } from 'react';
import { Smartphone, Wifi, Lock, RefreshCw, Copy, Check, ShieldAlert } from 'lucide-react';
import type { PhoneMirrorInfo } from '../../types/electron';

const EMPTY_INFO: PhoneMirrorInfo = {
    running: false,
    enabled: false,
    exposeOnLan: false,
    port: 0,
    loopbackUrl: null,
    primaryUrl: null,
    lanUrls: [],
    token: null,
    qrDataUrl: null,
    clients: 0,
};

export const PhoneMirrorSettings: React.FC = () => {
    const [info, setInfo] = useState<PhoneMirrorInfo>(EMPTY_INFO);
    const [busy, setBusy] = useState<null | 'enable' | 'disable' | 'lan' | 'rotate'>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const next = await window.electronAPI.phoneMirrorGetInfo();
            if (next && typeof next === 'object') setInfo(next as PhoneMirrorInfo);
        } catch (e: any) {
            setError(e?.message || 'Failed to load phone mirror status');
        }
    }, []);

    useEffect(() => {
        refresh();
        const off = window.electronAPI.onPhoneMirrorStatus((next) => {
            if (next && typeof next === 'object') setInfo(next as PhoneMirrorInfo);
        });
        return () => { off?.(); };
    }, [refresh]);

    const apply = useCallback(async (key: 'enable' | 'disable' | 'lan' | 'rotate', fn: () => Promise<any>) => {
        setBusy(key);
        setError(null);
        try {
            const result = await fn();
            if (result && typeof result === 'object' && 'error' in result && result.error) {
                setError(String(result.error));
            } else if (result && typeof result === 'object' && 'running' in result) {
                setInfo(result as PhoneMirrorInfo);
            } else {
                await refresh();
            }
        } catch (e: any) {
            setError(e?.message || 'Action failed');
        } finally {
            setBusy(null);
        }
    }, [refresh]);

    const onToggleEnable = useCallback(async () => {
        if (info.running) {
            await apply('disable', () => window.electronAPI.phoneMirrorDisable());
        } else {
            await apply('enable', () => window.electronAPI.phoneMirrorEnable(info.exposeOnLan));
        }
    }, [apply, info.running, info.exposeOnLan]);

    const onToggleLan = useCallback(async () => {
        await apply('lan', () => window.electronAPI.phoneMirrorSetLan(!info.exposeOnLan));
    }, [apply, info.exposeOnLan]);

    const onRotate = useCallback(async () => {
        await apply('rotate', () => window.electronAPI.phoneMirrorRotateToken());
    }, [apply]);

    const onCopy = useCallback(async () => {
        if (!info.primaryUrl) return;
        try {
            await navigator.clipboard.writeText(info.primaryUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch (_) { /* noop */ }
    }, [info.primaryUrl]);

    const lanWarning = info.running && info.exposeOnLan;
    const showQr = info.running && info.qrDataUrl;
    const lanRequestedButMissing = info.running && info.exposeOnLan && info.lanUrls.length === 0;

    return (
        <div className="space-y-5 animated fadeIn">
            <header className="flex items-start gap-3 border-l border-border-subtle/80 pl-4">
                <div className="rounded-sm bg-background/20 p-2 border border-border-subtle/80">
                    <Smartphone size={20} className="text-text-primary" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="text-text-primary text-[15px] font-medium tracking-[-0.01em]">Phone Mirror</h3>
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[9px] font-semibold uppercase tracking-[0.14em] bg-amber-500/12 text-amber-400 border border-amber-500/30">
                            Beta
                        </span>
                    </div>
                    <p className="text-text-secondary text-[12px] mt-1 leading-5">
                        Stream live AI responses from your desktop to a phone browser on the same network.
                        Useful when you're sharing your screen and want the AI output kept off the shared display.
                    </p>
                </div>
            </header>

            {/* Master toggle */}
            <div className="rounded-sm border border-border-subtle/80 bg-background/14 px-4 py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <div className="text-text-primary font-medium text-[12.5px]">Enable Phone Mirror</div>
                    <div className="text-text-secondary text-[11px] mt-1 leading-5">
                        {info.running
                            ? `Running on port ${info.port} · ${info.clients} ${info.clients === 1 ? 'phone' : 'phones'} connected`
                            : 'Off — no listener, no exposure.'}
                    </div>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={info.running}
                    disabled={busy !== null}
                    onClick={onToggleEnable}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${info.running ? 'bg-blue-500' : 'bg-bg-item-active'} ${busy !== null ? 'opacity-60 cursor-wait' : ''}`}
                >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${info.running ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
            </div>

            {/* LAN switch */}
            <div className={`rounded-sm border ${lanWarning ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-border-subtle/80 bg-background/14'} px-4 py-3.5 transition-colors`}>
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <div className="text-text-primary font-medium text-[12.5px] flex items-center gap-2">
                            <Wifi size={14} className="text-text-secondary" /> Allow LAN access
                        </div>
                        <div className="text-text-secondary text-[11px] mt-1 leading-5">
                            {info.exposeOnLan
                                ? 'Phones on the same WiFi can connect with the pairing token.'
                                : 'Loopback only — only this computer can connect (use SSH tunnel for remote access).'}
                        </div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={info.exposeOnLan}
                        disabled={busy !== null}
                        onClick={onToggleLan}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${info.exposeOnLan ? 'bg-amber-500' : 'bg-bg-item-active'} ${busy !== null ? 'opacity-60 cursor-wait' : ''}`}
                    >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${info.exposeOnLan ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                </div>
                {lanWarning && (
                    <div className="mt-3 flex items-start gap-2 text-amber-400/90 text-[11px] leading-5">
                        <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
                        <span>
                            Anyone on this network with the pairing URL can read your AI responses. Use only on trusted networks.
                            Rotate the token below if you suspect the URL was shared.
                        </span>
                    </div>
                )}
            </div>

            {/* No-LAN-IP warning */}
            {lanRequestedButMissing && (
                <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300 text-[11px] leading-5 flex items-start gap-2">
                    <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
                    <span>
                        LAN access is on, but no reachable Wi‑Fi/Ethernet IP was detected. Make sure this computer and your phone are on the same Wi‑Fi (VPN tunnels and virtual interfaces don't count). If you're on Windows, confirm the firewall is allowing incoming connections for this app on your Private network.
                    </span>
                </div>
            )}

            {/* Pairing card */}
            {info.running ? (
                <div className="rounded-sm border border-border-subtle/80 bg-background/14 px-4 py-4 space-y-4">
                    <div className="flex items-start gap-5">
                        {showQr ? (
                            <div className="flex-shrink-0 rounded-sm border border-border-subtle/80 bg-white p-2">
                                <img
                                    src={info.qrDataUrl!}
                                    alt="Pairing QR code"
                                    className="block w-36 h-36"
                                    draggable={false}
                                />
                            </div>
                        ) : (
                            <div className="flex-shrink-0 w-36 h-36 rounded-sm border border-dashed border-border-subtle/80 grid place-items-center text-text-secondary text-[11px]">
                                generating QR…
                            </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-3">
                            <div>
                                <div className="text-text-secondary font-mono text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5">Scan with your phone</div>
                                <div className="text-text-primary text-[12.5px] font-medium leading-5">
                                    {info.exposeOnLan
                                        ? 'Open the camera app and point at the code.'
                                        : 'LAN access is off. Turn it on, or open the URL on this computer.'}
                                </div>
                            </div>
                            <div>
                                <div className="text-text-secondary font-mono text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5">Pairing URL</div>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 min-w-0 truncate font-mono text-[11px] px-2.5 py-2 rounded-sm bg-background/20 border border-border-subtle/80 text-text-primary">
                                        {info.primaryUrl || '—'}
                                    </code>
                                    <button
                                        type="button"
                                        onClick={onCopy}
                                        disabled={!info.primaryUrl}
                                        className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-sm text-[11px] font-medium border border-border-subtle/80 bg-background/22 text-text-primary hover:bg-background/32 disabled:opacity-50 transition-colors"
                                    >
                                        {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
                                    </button>
                                </div>
                            </div>
                            {info.exposeOnLan && info.lanUrls.length > 1 && (
                                <details className="text-[11px]">
                                    <summary className="text-text-secondary cursor-pointer hover:text-text-primary">
                                        Other LAN addresses ({info.lanUrls.length - 1})
                                    </summary>
                                    <ul className="mt-2 space-y-1 font-mono text-text-secondary">
                                        {info.lanUrls.slice(1).map((u) => (
                                            <li key={u} className="truncate">{u}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border-subtle/80">
                        <div className="flex items-center gap-2 text-text-secondary text-[11px]">
                            <Lock size={12} /> Pairing token gates every connection.
                        </div>
                        <button
                            type="button"
                            onClick={onRotate}
                            disabled={busy !== null}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-border-subtle/80 bg-background/20 text-[11px] font-medium text-text-secondary hover:text-text-primary hover:bg-background/30 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={busy === 'rotate' ? 'animate-spin' : ''} />
                            Rotate token
                        </button>
                    </div>
                </div>
            ) : (
                <div className="border-l border-border-subtle/80 pl-4 text-text-secondary text-[12px] leading-5">
                    Turn on Phone Mirror to generate a pairing URL and QR code.
                </div>
            )}

            {error && (
                <div className="rounded-sm border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] text-red-300">
                    {error}
                </div>
            )}

            <div className="border-l border-border-subtle/80 pl-4 text-text-secondary text-[11px] leading-5">
                Phone Mirror runs entirely on your local network. No traffic leaves your machine — the bridge serves
                an HTML page and a WebSocket directly to your phone, gated by a per-session pairing token.
            </div>
        </div>
    );
};
