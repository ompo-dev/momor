/* eslint-disable @typescript-eslint/no-explicit-any */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

type Unlisten = () => void;
type Listener<T = any> = (payload: T) => void;

const NOOP_UNLISTEN: Unlisten = () => {};

const isTauriRuntime = (): boolean => {
  if (typeof window === "undefined") return false;
  if ((window as any).__TAURI_INTERNALS__) return true;
  return navigator.userAgent.includes("Tauri");
};

const detectPlatform = (): string => {
  const p = navigator.platform.toLowerCase();
  if (p.includes("mac")) return "darwin";
  if (p.includes("win")) return "win32";
  if (p.includes("linux")) return "linux";
  return p;
};

const toKebab = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase();

const normalizeMethod = (name: string): string =>
  name.replace(/[_-]/g, "").toLowerCase();

type AudioDeviceEntry = { id: string; name: string };
type AudioTestResult = { success: boolean; error?: string };

const RECOGNITION_LANGUAGES_FALLBACK: Record<string, any> = {
  auto: {
    label: "Auto Detect",
    code: "auto",
    bcp47: "auto",
    iso639: "auto",
    group: "Auto",
  },
  "english-us": {
    label: "United States",
    code: "english-us",
    bcp47: "en-US",
    iso639: "en",
    group: "English",
    primary: "en-US",
    alternates: ["en-GB", "en-IN", "en-AU", "en-CA"],
  },
  "english-uk": {
    label: "United Kingdom",
    code: "english-uk",
    bcp47: "en-GB",
    iso639: "en",
    group: "English",
    primary: "en-GB",
    alternates: ["en-US", "en-IN", "en-AU", "en-CA"],
  },
  "english-in": {
    label: "India",
    code: "english-in",
    bcp47: "en-IN",
    iso639: "en",
    group: "English",
    primary: "en-IN",
    alternates: ["en-US", "en-GB", "en-AU", "en-CA"],
  },
  "english-au": {
    label: "Australia",
    code: "english-au",
    bcp47: "en-AU",
    iso639: "en",
    group: "English",
    primary: "en-AU",
    alternates: ["en-US", "en-GB", "en-IN", "en-CA"],
  },
  "english-ca": {
    label: "Canada",
    code: "english-ca",
    bcp47: "en-CA",
    iso639: "en",
    group: "English",
    primary: "en-CA",
    alternates: ["en-US", "en-GB", "en-IN", "en-AU"],
  },
  indonesian: {
    label: "Indonesian",
    code: "indonesian",
    bcp47: "id-ID",
    iso639: "id",
    group: "Indonesian",
  },
  russian: {
    label: "Russian",
    code: "russian",
    bcp47: "ru-RU",
    iso639: "ru",
    group: "Russian",
  },
  spanish: {
    label: "Spanish",
    code: "spanish",
    bcp47: "es-ES",
    iso639: "es",
    group: "Spanish",
  },
  french: {
    label: "French",
    code: "french",
    bcp47: "fr-FR",
    iso639: "fr",
    group: "French",
  },
  german: {
    label: "German",
    code: "german",
    bcp47: "de-DE",
    iso639: "de",
    group: "German",
  },
  italian: {
    label: "Italian",
    code: "italian",
    bcp47: "it-IT",
    iso639: "it",
    group: "Italian",
  },
  portuguese: {
    label: "Portuguese",
    code: "portuguese",
    bcp47: "pt-PT",
    iso639: "pt",
    group: "Portuguese",
  },
  japanese: {
    label: "Japanese",
    code: "japanese",
    bcp47: "ja-JP",
    iso639: "ja",
    group: "Japanese",
  },
  korean: {
    label: "Korean",
    code: "korean",
    bcp47: "ko-KR",
    iso639: "ko",
    group: "Korean",
  },
  chinese: {
    label: "Chinese (Simplified)",
    code: "chinese",
    bcp47: "zh-CN",
    iso639: "zh",
    group: "Chinese",
  },
  turkish: {
    label: "Turkish",
    code: "turkish",
    bcp47: "tr-TR",
    iso639: "tr",
    group: "Turkish",
  },
  ukrainian: {
    label: "Ukrainian",
    code: "ukrainian",
    bcp47: "uk-UA",
    iso639: "uk",
    group: "Ukrainian",
  },
};

const AI_RESPONSE_LANGUAGES_FALLBACK = [
  { label: "Auto (Detect)", code: "auto" },
  { label: "English", code: "English" },
  { label: "Indonesian", code: "Indonesian" },
  { label: "Russian", code: "Russian" },
  { label: "Spanish", code: "Spanish" },
  { label: "French", code: "French" },
  { label: "German", code: "German" },
  { label: "Italian", code: "Italian" },
  { label: "Portuguese", code: "Portuguese" },
  { label: "Japanese", code: "Japanese" },
  { label: "Korean", code: "Korean" },
  { label: "Chinese", code: "Chinese" },
  { label: "Turkish", code: "Turkish" },
  { label: "Ukrainian", code: "Ukrainian" },
];

const ARRAY_RESULT_METHODS = new Set<string>([
  "getscreenshots",
  "getrecentmeetings",
  "getupcomingevents",
  "getcustomproviders",
  "getavailableollamamodels",
  "getinputdevices",
  "getoutputdevices",
  "getairesponselanguages",
  "getkeybinds",
  "modesgetall",
  "modesgetreferencefiles",
  "modesgetnotesections",
]);

const LS_KEYS = {
  sttLanguage: "tauri.sttLanguage",
  aiResponseLanguage: "tauri.aiResponseLanguage",
  undetectable: "tauri.undetectable",
  openAtLogin: "tauri.openAtLogin",
  overlayMousePassthrough: "tauri.overlayMousePassthrough",
  disguiseMode: "tauri.disguiseMode",
  verboseLogging: "tauri.verboseLogging",
  providerDataScopes: "tauri.providerDataScopes",
  screenUnderstandingMode: "tauri.screenUnderstandingMode",
  technicalInterviewVisionFirst: "tauri.technicalInterviewVisionFirst",
} as const;

const readLsBoolean = (key: string, fallback: boolean): boolean => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "true";
  } catch {
    return fallback;
  }
};

const writeLsBoolean = (key: string, value: boolean): void => {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {
    // ignore
  }
};

const readLsString = (key: string, fallback: string): string => {
  try {
    const raw = localStorage.getItem(key);
    return raw && raw.trim() ? raw : fallback;
  } catch {
    return fallback;
  }
};

const writeLsString = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
};

const readLsJson = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeLsJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};

const localEventListeners = new Map<string, Set<Listener<any>>>();

const onLocalEvent = <T = any>(
  eventName: string,
  callback: Listener<T>,
): Unlisten => {
  const bucket = localEventListeners.get(eventName) ?? new Set<Listener<any>>();
  bucket.add(callback as Listener<any>);
  localEventListeners.set(eventName, bucket);
  return () => {
    const current = localEventListeners.get(eventName);
    if (!current) return;
    current.delete(callback as Listener<any>);
    if (current.size === 0) {
      localEventListeners.delete(eventName);
    }
  };
};

const emitLocalEvent = (eventName: string, payload: any): void => {
  const bucket = localEventListeners.get(eventName);
  if (!bucket || bucket.size === 0) return;
  for (const listener of bucket) {
    try {
      listener(payload);
    } catch {
      // ignore listener errors
    }
  }
};

type RealtimeSttSpeaker = "user" | "interviewer";

type RealtimeSttConnection = {
  speaker: RealtimeSttSpeaker;
  streamLabel: "mic" | "system";
  live: any;
  opened: boolean;
};

type RealtimeSttGraphNode = {
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  silentGain: GainNode;
};

const realtimeSttState: {
  active: boolean;
  starting: boolean;
  connected: boolean;
  provider: string;
  lastError: string | null;
  language: string;
  audioContext: AudioContext | null;
  micStream: MediaStream | null;
  systemStream: MediaStream | null;
  graphNodes: RealtimeSttGraphNode[];
  connections: RealtimeSttConnection[];
} = {
  active: false,
  starting: false,
  connected: false,
  provider: "none",
  lastError: null,
  language: "multi",
  audioContext: null,
  micStream: null,
  systemStream: null,
  graphNodes: [],
  connections: [],
};

const resolveLanguageForDeepgram = (key: string): string => {
  const normalized = (key || "auto").trim();
  if (!normalized || normalized === "auto") {
    return "multi";
  }
  const fallback = RECOGNITION_LANGUAGES_FALLBACK[normalized];
  if (fallback?.iso639) {
    return String(fallback.iso639).toLowerCase();
  }
  if (normalized.includes("-")) {
    return normalized.split("-")[0].toLowerCase();
  }
  return normalized.toLowerCase();
};

const downsampleTo16kLinear16 = (
  input: Float32Array,
  inputRate: number,
): Int16Array => {
  const outputRate = 16_000;
  if (!input.length) return new Int16Array();
  if (inputRate === outputRate) {
    const direct = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      direct[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return direct;
  }

  const ratio = inputRate / outputRate;
  const outLen = Math.max(1, Math.round(input.length / ratio));
  const out = new Int16Array(outLen);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < outLen) {
    const nextOffsetBuffer = Math.min(
      input.length,
      Math.round((offsetResult + 1) * ratio),
    );
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i++) {
      accum += input[i];
      count++;
    }
    const sample = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return out;
};

const enumerateBrowserAudioDevices = async (
  kind: "audioinput" | "audiooutput",
): Promise<AudioDeviceEntry[]> => {
  const labelBase = kind === "audioinput" ? "Microphone" : "Speaker";
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return [{ id: "default", name: `Default ${labelBase}` }];
  }
  const mapDevices = (devices: MediaDeviceInfo[]): AudioDeviceEntry[] => {
    const filtered = devices.filter((d) => d.kind === kind && !!d.deviceId);
    const unique = new Map<string, AudioDeviceEntry>();
    filtered.forEach((d, index) => {
      const id = d.deviceId || `${kind}-${index}`;
      const name = d.label?.trim() || `${labelBase} ${index + 1}`;
      if (!unique.has(id)) {
        unique.set(id, { id, name });
      }
    });
    return Array.from(unique.values());
  };

  let devices = await navigator.mediaDevices.enumerateDevices();
  let results = mapDevices(devices);

  const labelsMissing =
    results.length > 0 && results.every((d) => d.name.startsWith(labelBase));
  if (results.length === 0 || labelsMissing) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      devices = await navigator.mediaDevices.enumerateDevices();
      results = mapDevices(devices);
    } catch {
      // permission denied or unavailable: keep best-effort list
    }
  }

  if (results.length === 0) {
    return [{ id: "default", name: `Default ${labelBase}` }];
  }

  return results;
};

const defaultValueForGetter = (method: string): any => {
  const normalized = normalizeMethod(method);

  if (ARRAY_RESULT_METHODS.has(normalized)) {
    return [];
  }

  if (method === "getStoredCredentials") {
    return {
      hasGeminiKey: false,
      hasGroqKey: false,
      hasOpenaiKey: false,
      hasClaudeKey: false,
      hasmomorKey: false,
      sttProvider: "none",
      hasSttGroqKey: false,
      hasSttOpenaiKey: false,
      hasDeepgramKey: false,
      hasElevenLabsKey: false,
      hasAzureKey: false,
      azureRegion: "eastus",
      hasIbmWatsonKey: false,
      ibmWatsonRegion: "us-south",
      hasSonioxKey: false,
      hasTavilyKey: false,
      sttGroqKey: "",
      sttOpenaiKey: "",
      sttDeepgramKey: "",
      sttElevenLabsKey: "",
      sttAzureKey: "",
      sttIbmKey: "",
      sttSonioxKey: "",
      googleServiceAccountPath: null,
    };
  }

  if (method === "getDefaultModel")
    return { model: "gemini-3.1-flash-lite-preview" };
  if (method === "getVisionDefaultModel")
    return { model: "gemini-3.1-flash-lite-preview" };
  if (method === "getThemeMode") return { mode: "system", resolved: "dark" };
  if (normalized === "getcalendarstatus") return { connected: false };
  if (normalized === "getnativeaudiostatus") return { connected: false };
  if (normalized === "getgroqfasttextmode") return { enabled: false };
  if (normalized === "getcodexcliconfig") {
    return {
      enabled: false,
      path: "",
      model: "",
      fastModel: "",
      timeoutMs: 30000,
    };
  }
  if (normalized === "localwhispergetmodels") {
    return { models: [], activeModelId: "" };
  }
  if (normalized === "localwhispergetchannelconfig") {
    return {
      enabled: false,
      micModelId: "",
      systemModelId: "",
      globalModelId: "",
    };
  }
  if (normalized === "getactionbuttonmode") return "recap";
  if (normalized === "getmeetingretention") return "forever";
  if (normalized === "getsttprovider") return "none";
  if (normalized === "getsttlanguage") return "auto";
  if (normalized === "getairesponselanguage") return "auto";
  if (normalized === "startanswernowmic") {
    return { success: false, error: "stt_backend_not_available_in_tauri" };
  }
  if (normalized === "stopanswernowmic") return { success: true };
  if (normalized === "finalizemicstt") return { success: true };
  if (normalized === "startaudiotest") {
    return { success: false, error: "audio_test_not_available_in_tauri" };
  }
  if (normalized === "stopaudiotest") return { success: true };
  if (normalized === "deepgramtranscribeanswernow") {
    return {
      success: false,
      error: "deepgram_transcription_unavailable_in_tauri",
    };
  }
  if (normalized === "getundetectable")
    return readLsBoolean(LS_KEYS.undetectable, false);
  if (normalized === "getopenatlogin")
    return readLsBoolean(LS_KEYS.openAtLogin, false);
  if (normalized === "getoverlaymousepassthrough")
    return readLsBoolean(LS_KEYS.overlayMousePassthrough, false);
  if (normalized === "getrecognitionlanguages")
    return RECOGNITION_LANGUAGES_FALLBACK;
  if (normalized === "getairesponselanguages")
    return AI_RESPONSE_LANGUAGES_FALLBACK;
  if (normalized === "getdisguise")
    return readLsString(LS_KEYS.disguiseMode, "none");
  if (normalized === "getverboselogging")
    return readLsBoolean(LS_KEYS.verboseLogging, false);
  if (normalized === "getproviderdatascopes")
    return readLsJson(LS_KEYS.providerDataScopes, {});
  if (normalized === "getscreenunderstandingmode")
    return readLsString(LS_KEYS.screenUnderstandingMode, "vision_first");
  if (normalized === "gettechnicalinterviewvisionfirst")
    return readLsBoolean(LS_KEYS.technicalInterviewVisionFirst, true);
  if (normalized === "gettechnicalinterviewdirectvision")
    return readLsBoolean(LS_KEYS.technicalInterviewVisionFirst, true);
  if (method === "getCurrentLlmConfig") {
    return {
      provider: "gemini",
      model: "gemini-3.1-flash-lite-preview",
      isOllama: false,
    };
  }
  if (method === "windowIsMaximized") return false;
  if (method === "getMeetingActive") return false;

  if (
    method.startsWith("get") ||
    method.startsWith("is") ||
    method.startsWith("has")
  ) {
    return {};
  }

  return { success: true };
};

const audioTestListeners = new Set<Listener<number>>();
const browserAudioTestState: {
  stream: MediaStream | null;
  audioContext: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
  rafId: number | null;
} = {
  stream: null,
  audioContext: null,
  source: null,
  analyser: null,
  rafId: null,
};

const emitAudioTestLevel = (level: number): void => {
  for (const listener of audioTestListeners) {
    try {
      listener(level);
    } catch {
      // ignore listener errors
    }
  }
};

const stopBrowserAudioTest = async (): Promise<AudioTestResult> => {
  if (browserAudioTestState.rafId !== null) {
    cancelAnimationFrame(browserAudioTestState.rafId);
    browserAudioTestState.rafId = null;
  }

  if (browserAudioTestState.stream) {
    browserAudioTestState.stream.getTracks().forEach((track) => track.stop());
    browserAudioTestState.stream = null;
  }

  browserAudioTestState.source = null;
  browserAudioTestState.analyser = null;

  if (browserAudioTestState.audioContext) {
    try {
      await browserAudioTestState.audioContext.close();
    } catch {
      // ignore close errors
    }
    browserAudioTestState.audioContext = null;
  }

  emitAudioTestLevel(0);
  return { success: true };
};

const startBrowserAudioTest = async (
  deviceId?: string,
): Promise<AudioTestResult> => {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    return { success: false, error: "media_devices_unavailable" };
  }

  const AudioContextCtor =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) {
    return { success: false, error: "web_audio_api_unavailable" };
  }

  await stopBrowserAudioTest();

  try {
    const audioConstraint: MediaTrackConstraints | boolean =
      deviceId && deviceId !== "default"
        ? { deviceId: { exact: deviceId } }
        : true;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraint,
    });
    const audioContext: AudioContext = new AudioContextCtor();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);

    browserAudioTestState.stream = stream;
    browserAudioTestState.audioContext = audioContext;
    browserAudioTestState.source = source;
    browserAudioTestState.analyser = analyser;

    const buffer = new Uint8Array(analyser.fftSize);
    const tick = () => {
      if (!browserAudioTestState.analyser) return;
      browserAudioTestState.analyser.getByteTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i++) {
        const normalized = (buffer[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      const scaled = Math.min(1, Math.max(0, rms * 4));
      emitAudioTestLevel(scaled);
      browserAudioTestState.rafId = requestAnimationFrame(tick);
    };
    tick();

    return { success: true };
  } catch (error) {
    await stopBrowserAudioTest();
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "failed_to_start_browser_audio_test",
    };
  }
};

const methodToEventMap: Record<string, string | string[]> = {
  onThemeChanged: ["theme-changed", "theme:changed"],
  onModelChanged: "model-changed",
  onMeetingStateChanged: "meeting-state-changed",
  onMeetingsUpdated: "meetings-updated",
  onScreenshotTaken: "screenshot-taken",
  onScreenshotAttached: "screenshot-attached",
  onCaptureAndProcess: "capture-and-process",
  onSolutionsReady: "solutions-ready",
  onResetView: "reset-view",
  onSolutionStart: "solution-start",
  onDebugStart: "debug-start",
  onDebugSuccess: "debug-success",
  onSolutionError: "solution-error",
  onProcessingNoScreenshots: "processing-no-screenshots",
  onProblemExtracted: "problem-extracted",
  onSolutionSuccess: "solution-success",
  onUnauthorized: "unauthorized",
  onDebugError: "debug-error",
  onWindowMaximizedChanged: "window-maximized-changed",
  onEnsureExpanded: "ensure-expanded",
  onToggleExpand: "toggle-expand",
  onOverlayMousePassthroughChanged: "overlay-mouse-passthrough-changed",
  onOpenSettingsTab: "open-settings-tab",
  onIntelligenceModeChanged: "intelligence-mode-changed",
  onIntelligenceError: "intelligence-error",
  onIntelligenceNegotiationCoaching: "intelligence-negotiation-coaching",
  onIntelligenceTokenBatch: "intelligence-token-batch",
  onIntelligenceSuggestedAnswer: "intelligence-suggested-answer",
  onIntelligenceSuggestedAnswerToken: "intelligence-suggested-answer-token",
  onIntelligenceRefinedAnswer: "intelligence-refined-answer",
  onIntelligenceRefinedAnswerToken: "intelligence-refined-answer-token",
  onIntelligenceRecap: "intelligence-recap",
  onIntelligenceRecapToken: "intelligence-recap-token",
  onIntelligenceClarify: "intelligence-clarify",
  onIntelligenceClarifyToken: "intelligence-clarify-token",
  onIntelligenceFollowUpQuestionsUpdate:
    "intelligence-follow-up-questions-update",
  onIntelligenceFollowUpQuestionsToken:
    "intelligence-follow-up-questions-token",
  onIntelligenceManualStarted: "intelligence-manual-started",
  onIntelligenceManualResult: "intelligence-manual-result",
  onSessionReset: "session-reset",
  onOllamaPullProgress: ["ollama-pull-progress", "ollama:pull-progress"],
  onOllamaPullComplete: ["ollama-pull-complete", "ollama:pull-complete"],
  onLicenseStatusChanged: "license-status-changed",
  onIncompatibleProviderWarning: [
    "embedding-incompatible-provider-warning",
    "embedding:incompatible-provider-warning",
  ],
  onKeybindsUpdate: ["keybinds-update", "keybinds:update"],
  onKeybindRegistrationFailed: [
    "keybinds-registration-failed",
    "keybinds:registration-failed",
  ],
  onGlobalShortcut: "global-shortcut",
  onGeminiStreamToken: ["gemini-stream-token", "gemini:stream-token"],
  onGeminiStreamDone: ["gemini-stream-done", "gemini:stream-done"],
  onGeminiStreamError: ["gemini-stream-error", "gemini:stream-error"],
  onRAGStreamChunk: ["rag-stream-chunk", "rag:stream-chunk"],
  onRAGStreamComplete: ["rag-stream-complete", "rag:stream-complete"],
  onRAGStreamError: ["rag-stream-error", "rag:stream-error"],
  onNativeAudioTranscript: "native-audio-transcript",
  onNativeAudioConnected: "native-audio-connected",
  onNativeAudioDisconnected: "native-audio-disconnected",
  onSuggestionGenerated: "suggestion-generated",
  onSuggestionProcessingStart: "suggestion-processing-start",
  onSuggestionError: "suggestion-error",
  onSttConfigChanged: "stt-config-changed",
  onCredentialsChanged: "credentials-changed",
  onSttStatusChanged: "stt-status-changed",
  onSttLanguageAutoDetected: "stt-language-auto-detected",
  onSystemAudioPermissionDenied: "system-audio-permission-denied",
  onDeviceSelectionApplied: "device-selection-applied",
  onAudioCaptureFailed: "audio-capture-failed",
  onAudioTestLevel: "audio-test-level",
  onUndetectableChanged: "undetectable-changed",
  onGroqFastTextChanged: "groq-fast-text-changed",
  onActionButtonModeChanged: "action-button-mode-changed",
  onModeChanged: "mode-changed",
  onUpdateAvailable: "update-available",
  onUpdateDownloaded: "update-downloaded",
  onUpdateChecking: "update-checking",
  onUpdateNotAvailable: "update-not-available",
  onUpdateError: "update-error",
  onDownloadProgress: "download-progress",
  onTrialEnded: "trial-ended",
  onPhoneMirrorStatus: "phone-mirror-status",
  onStealthTapState: "stealth-tap-state",
  onStealthKeyCaptured: "stealth-key-captured",
  onOverlayOpacityChanged: "overlay-opacity-changed",
  onMeetingRetentionChanged: "meeting-retention-changed",
  onProviderDataScopesChanged: "provider-data-scopes-changed",
  onScreenUnderstandingModeChanged: "screen-understanding-mode-changed",
  onTechnicalInterviewVisionFirstChanged:
    "technical-interview-vision-first-changed",
  onTechnicalInterviewDirectVisionChanged:
    "technical-interview-vision-first-changed",
  onIntelligenceDynamicAction: "intelligence-dynamic-action",
};

const onEvent =
  <T = any>(eventNames: string | string[]) =>
  (callback: Listener<T>): Unlisten => {
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];
    const unlistenFns: Unlisten[] = [];
    let active = true;

    void Promise.all(
      names.map((name) =>
        listen<T>(name, (event) => {
          if (!active) return;
          callback(event.payload);
        }).then((fn) => {
          unlistenFns.push(fn);
        }),
      ),
    );

    return () => {
      active = false;
      for (const unlisten of unlistenFns) {
        try {
          unlisten();
        } catch {
          // ignore
        }
      }
    };
  };

const onHybridEvent =
  <T = any>(eventNames: string | string[]) =>
  (callback: Listener<T>): Unlisten => {
    const names = Array.isArray(eventNames) ? eventNames : [eventNames];
    const unlistenRemote = onEvent<T>(eventNames)(callback);
    const unlistenLocal = names.map((name) => onLocalEvent<T>(name, callback));
    return () => {
      try {
        unlistenRemote();
      } catch {
        // ignore
      }
      for (const fn of unlistenLocal) {
        try {
          fn();
        } catch {
          // ignore
        }
      }
    };
  };

const invokeDesktopApi = async <T = any>(
  method: string,
  args: any[] = [],
): Promise<T> => {
  try {
    return await invoke<T>("desktop_api", { method, args });
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`[tauri-shim] desktop_api failed for ${method}`, error);
    }
    return defaultValueForGetter(method) as T;
  }
};

const invokeTyped = async <T = any>(
  commandName: string,
  args?: Record<string, unknown>,
): Promise<T> => {
  try {
    return await invoke<T>(commandName, args);
  } catch {
    return defaultValueForGetter(commandName) as T;
  }
};

const resolveDeepgramKey = async (): Promise<string> => {
  const credentials = await invokeTyped<any>("get_stored_credentials");
  const key =
    credentials?.sttDeepgramKey ||
    credentials?.stt_deepgram_key ||
    credentials?.deepgramKey ||
    "";
  return typeof key === "string" ? key.trim() : "";
};

const emitRealtimeSttStatus = (
  state: "connected" | "reconnecting" | "failed",
  provider: string,
  channel: RealtimeSttSpeaker,
  error?: string,
): void => {
  emitLocalEvent("stt-status-changed", {
    state,
    provider,
    channel,
    reconnectAttempts: state === "reconnecting" ? 1 : 0,
    error,
  });
};

const cleanupRealtimeSttGraph = async (): Promise<void> => {
  for (const node of realtimeSttState.graphNodes) {
    try {
      node.processor.disconnect();
    } catch {
      // ignore
    }
    try {
      node.source.disconnect();
    } catch {
      // ignore
    }
    try {
      node.silentGain.disconnect();
    } catch {
      // ignore
    }
  }
  realtimeSttState.graphNodes = [];

  if (realtimeSttState.micStream) {
    realtimeSttState.micStream.getTracks().forEach((track) => track.stop());
  }
  realtimeSttState.micStream = null;

  if (realtimeSttState.systemStream) {
    realtimeSttState.systemStream.getTracks().forEach((track) => track.stop());
  }
  realtimeSttState.systemStream = null;

  if (realtimeSttState.audioContext) {
    try {
      await realtimeSttState.audioContext.close();
    } catch {
      // ignore
    }
  }
  realtimeSttState.audioContext = null;
};

const stopRealtimeStt = async (): Promise<void> => {
  const wasConnected = realtimeSttState.connected;
  realtimeSttState.starting = false;
  realtimeSttState.active = false;
  realtimeSttState.connected = false;

  const connections = [...realtimeSttState.connections];
  realtimeSttState.connections = [];
  for (const connection of connections) {
    try {
      connection.live?.requestClose?.();
    } catch {
      // ignore
    }
  }

  await cleanupRealtimeSttGraph();

  if (wasConnected) {
    emitLocalEvent("native-audio-disconnected", { reason: "stopped" });
  }
};

const attachStreamToConnection = (
  stream: MediaStream,
  connection: RealtimeSttConnection,
): void => {
  if (!realtimeSttState.audioContext) return;

  const context = realtimeSttState.audioContext;
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const silentGain = context.createGain();
  silentGain.gain.value = 0;

  processor.onaudioprocess = (event: AudioProcessingEvent) => {
    if (!realtimeSttState.active || !connection.opened) return;
    const inputData = event.inputBuffer.getChannelData(0);
    const pcm16 = downsampleTo16kLinear16(inputData, context.sampleRate);
    if (!pcm16.length) return;
    try {
      connection.live?.send?.(pcm16.buffer);
    } catch {
      // ignore send jitter; Deepgram reconnects if needed.
    }
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(context.destination);

  realtimeSttState.graphNodes.push({
    source,
    processor,
    silentGain,
  });
};

const createRealtimeSttConnection = async (
  apiKey: string,
  speaker: RealtimeSttSpeaker,
  streamLabel: "mic" | "system",
  language: string,
): Promise<RealtimeSttConnection> => {
  const deepgramSdk: any = await import("@deepgram/sdk");
  const createClient = deepgramSdk?.createClient;
  const events = deepgramSdk?.LiveTranscriptionEvents;
  if (!createClient || !events) {
    throw new Error("deepgram_sdk_unavailable");
  }

  const deepgram = createClient(apiKey);
  const live = deepgram.listen.live({
    model: "nova-3",
    language,
    smart_format: true,
    interim_results: true,
    encoding: "linear16",
    sample_rate: 16000,
    channels: 1,
    endpointing: language === "multi" ? 100 : 300,
    vad_events: true,
  });

  const connection: RealtimeSttConnection = {
    speaker,
    streamLabel,
    live,
    opened: false,
  };

  live.on(events.Open, () => {
    connection.opened = true;
    if (!realtimeSttState.connected) {
      realtimeSttState.connected = true;
      emitLocalEvent("native-audio-connected", {
        provider: realtimeSttState.provider,
      });
    }
    emitRealtimeSttStatus("connected", realtimeSttState.provider, speaker);
  });

  live.on(events.Transcript, (data: any) => {
    const alternative = data?.channel?.alternatives?.[0];
    const transcript =
      typeof alternative?.transcript === "string"
        ? alternative.transcript.trim()
        : "";
    if (!transcript) return;
    emitLocalEvent("native-audio-transcript", {
      speaker,
      text: transcript,
      final: Boolean(data?.is_final),
      confidence:
        typeof alternative?.confidence === "number"
          ? alternative.confidence
          : 1,
    });
  });

  live.on(events.Close, () => {
    connection.opened = false;
    if (!realtimeSttState.active) return;
    emitRealtimeSttStatus("reconnecting", realtimeSttState.provider, speaker);
  });

  live.on(events.Error, (error: any) => {
    const message =
      (error && (error.message || error.error || String(error))) ||
      "deepgram_stream_error";
    realtimeSttState.lastError = message;
    emitRealtimeSttStatus(
      "failed",
      realtimeSttState.provider,
      speaker,
      message,
    );
  });

  return connection;
};

const startRealtimeSttForMeeting = async (metadata?: any): Promise<void> => {
  if (realtimeSttState.active || realtimeSttState.starting) return;
  realtimeSttState.starting = true;
  realtimeSttState.lastError = null;

  try {
    const provider = await invokeTyped<string>("get_stt_provider");
    realtimeSttState.provider =
      typeof provider === "string" && provider.trim() ? provider : "none";
    if (realtimeSttState.provider !== "deepgram") {
      realtimeSttState.lastError = "stt_provider_not_deepgram";
      emitRealtimeSttStatus(
        "failed",
        realtimeSttState.provider,
        "user",
        realtimeSttState.lastError,
      );
      return;
    }

    const apiKey = await resolveDeepgramKey();
    if (!apiKey) {
      realtimeSttState.lastError = "missing_deepgram_api_key";
      emitRealtimeSttStatus(
        "failed",
        realtimeSttState.provider,
        "user",
        realtimeSttState.lastError,
      );
      return;
    }

    const languageKey = await invokeTyped<string>("get_stt_language");
    realtimeSttState.language = resolveLanguageForDeepgram(
      typeof languageKey === "string"
        ? languageKey
        : readLsString(LS_KEYS.sttLanguage, "auto"),
    );

    const AudioContextCtor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      realtimeSttState.lastError = "web_audio_api_unavailable";
      emitRealtimeSttStatus(
        "failed",
        realtimeSttState.provider,
        "user",
        realtimeSttState.lastError,
      );
      return;
    }

    const preferredInput =
      metadata?.audio?.inputDeviceId ||
      localStorage.getItem("preferredInputDeviceId") ||
      "default";
    const audioConstraint: MediaTrackConstraints | boolean =
      preferredInput && preferredInput !== "default"
        ? { deviceId: { exact: preferredInput } }
        : true;

    const audioContext: AudioContext = new AudioContextCtor();
    realtimeSttState.audioContext = audioContext;
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    realtimeSttState.micStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraint,
    });
    const micConnection = await createRealtimeSttConnection(
      apiKey,
      "user",
      "mic",
      realtimeSttState.language,
    );
    realtimeSttState.connections.push(micConnection);
    attachStreamToConnection(realtimeSttState.micStream, micConnection);

    if (navigator.mediaDevices?.getDisplayMedia) {
      try {
        realtimeSttState.systemStream =
          await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        const hasSystemAudioTrack =
          realtimeSttState.systemStream.getAudioTracks().length > 0;
        if (hasSystemAudioTrack) {
          const systemConnection = await createRealtimeSttConnection(
            apiKey,
            "interviewer",
            "system",
            realtimeSttState.language,
          );
          realtimeSttState.connections.push(systemConnection);
          attachStreamToConnection(
            realtimeSttState.systemStream,
            systemConnection,
          );
        } else {
          emitRealtimeSttStatus(
            "failed",
            realtimeSttState.provider,
            "interviewer",
            "system_audio_not_shared",
          );
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "system_audio_capture_failed";
        emitRealtimeSttStatus(
          "failed",
          realtimeSttState.provider,
          "interviewer",
          message,
        );
      }
    }

    realtimeSttState.active = true;
  } catch (error) {
    realtimeSttState.lastError =
      error instanceof Error ? error.message : "realtime_stt_start_failed";
    emitRealtimeSttStatus(
      "failed",
      realtimeSttState.provider || "deepgram",
      "user",
      realtimeSttState.lastError,
    );
    await stopRealtimeStt();
  } finally {
    realtimeSttState.starting = false;
  }
};

const mappedCommands: Record<string, (...args: any[]) => any> = {
  getThemeMode: () => invokeTyped("get_theme_mode"),
  setThemeMode: (mode: string) => invokeTyped("set_theme_mode", { mode }),
  getStoredCredentials: () => invokeTyped("get_stored_credentials"),
  setGeminiApiKey: (apiKey: string) =>
    invokeTyped("set_gemini_api_key", { apiKey }),
  setGroqApiKey: (apiKey: string) =>
    invokeTyped("set_groq_api_key", { apiKey }),
  setOpenaiApiKey: (apiKey: string) =>
    invokeTyped("set_openai_api_key", { apiKey }),
  setClaudeApiKey: (apiKey: string) =>
    invokeTyped("set_claude_api_key", { apiKey }),
  setmomorApiKey: (apiKey: string) =>
    invokeTyped("set_momor_api_key", { apiKey }),
  setDeepseekApiKey: (key: string) =>
    invokeTyped("set_deepseek_api_key", { key }),
  setDeepseekModel: (model: string) =>
    invokeTyped("set_deepseek_model", { model }),
  getDeepseekApiKey: () => invokeTyped("get_deepseek_api_key"),
  setTavilyApiKey: (apiKey: string) =>
    invokeTyped("set_tavily_api_key", { apiKey }),
  getDefaultModel: () => invokeTyped("get_default_model"),
  getVisionDefaultModel: () => invokeTyped("get_vision_default_model"),
  setDefaultModel: (modelId: string) =>
    invokeTyped("set_default_model", { modelId }),
  setVisionDefaultModel: (modelId: string) =>
    invokeTyped("set_vision_default_model", { modelId }),
  setModel: async (modelId: string) => {
    const result = await invokeTyped<any>("set_model", { modelId });
    emitLocalEvent("model-changed", modelId);
    return result;
  },
  getCurrentLlmConfig: () => invokeTyped("get_current_llm_config"),
  getRecognitionLanguages: async () => {
    const fromBackend = await invokeTyped<any>("get_recognition_languages");
    if (
      fromBackend &&
      typeof fromBackend === "object" &&
      Object.keys(fromBackend).length > 0
    ) {
      return fromBackend;
    }
    return RECOGNITION_LANGUAGES_FALLBACK;
  },
  setRecognitionLanguage: async (key: string) => {
    const normalized = key?.trim() || "auto";
    writeLsString(LS_KEYS.sttLanguage, normalized);
    return invokeTyped("set_recognition_language", { key: normalized });
  },
  getSttLanguage: async () => {
    const fromBackend = await invokeTyped<any>("get_stt_language");
    if (typeof fromBackend === "string" && fromBackend.trim()) {
      writeLsString(LS_KEYS.sttLanguage, fromBackend);
      return fromBackend;
    }
    return readLsString(LS_KEYS.sttLanguage, "auto");
  },
  getAiResponseLanguages: async () => {
    const fromBackend = await invokeTyped<any>("get_ai_response_languages");
    if (Array.isArray(fromBackend) && fromBackend.length > 0) {
      return fromBackend;
    }
    return AI_RESPONSE_LANGUAGES_FALLBACK;
  },
  setAiResponseLanguage: async (language: string) => {
    const normalized = language?.trim() || "auto";
    writeLsString(LS_KEYS.aiResponseLanguage, normalized);
    return invokeTyped("set_ai_response_language", { language: normalized });
  },
  getAiResponseLanguage: async () => {
    const fromBackend = await invokeTyped<any>("get_ai_response_language");
    if (typeof fromBackend === "string" && fromBackend.trim()) {
      writeLsString(LS_KEYS.aiResponseLanguage, fromBackend);
      return fromBackend;
    }
    return readLsString(LS_KEYS.aiResponseLanguage, "auto");
  },
  setSttProvider: (provider: string) =>
    invokeTyped("set_stt_provider", { provider }),
  getSttProvider: () => invokeTyped("get_stt_provider"),
  setGroqSttApiKey: (apiKey: string) =>
    invokeTyped("set_groq_stt_api_key", { apiKey, api_key: apiKey }),
  setOpenAiSttApiKey: (apiKey: string) =>
    invokeTyped("set_open_ai_stt_api_key", { apiKey, api_key: apiKey }),
  setOpenAiSttBaseUrl: (url: string) =>
    invokeTyped("set_open_ai_stt_base_url", { url }),
  setDeepgramApiKey: (apiKey: string) =>
    invokeTyped("set_deepgram_api_key", { apiKey, api_key: apiKey }),
  setElevenLabsApiKey: (apiKey: string) =>
    invokeTyped("set_eleven_labs_api_key", { apiKey, api_key: apiKey }),
  setAzureApiKey: (apiKey: string) =>
    invokeTyped("set_azure_api_key", { apiKey, api_key: apiKey }),
  setAzureRegion: (region: string) =>
    invokeTyped("set_azure_region", { region }),
  setIbmWatsonApiKey: (apiKey: string) =>
    invokeTyped("set_ibm_watson_api_key", { apiKey, api_key: apiKey }),
  setIbmWatsonRegion: (region: string) =>
    invokeTyped("set_ibm_watson_region", { region }),
  setSonioxApiKey: (apiKey: string) =>
    invokeTyped("set_soniox_api_key", { apiKey, api_key: apiKey }),
  setGroqSttModel: (model: string) =>
    invokeTyped("set_groq_stt_model", { model }),
  testSttConnection: (provider: string, apiKey: string, region?: string) =>
    invokeTyped("test_stt_connection", {
      provider,
      apiKey,
      api_key: apiKey,
      region,
    }),
  getMeetingActive: () => invokeTyped("get_meeting_active"),
  startMeeting: async (metadata?: any) => {
    const result = await invokeTyped<any>("start_meeting", { metadata });
    if (result?.success) {
      void startRealtimeSttForMeeting(metadata);
    }
    return result;
  },
  endMeeting: async () => {
    await stopRealtimeStt();
    return invokeTyped("end_meeting");
  },
  appendMeetingTranscript: (entry: {
    speaker: string;
    text: string;
    timestamp?: number;
  }) => invokeTyped("append_meeting_transcript", { entry }),
  getNativeAudioStatus: async () => {
    if (realtimeSttState.connected) {
      return { connected: true };
    }
    const backend = await invokeTyped<any>("get_native_audio_status");
    if (backend && typeof backend === "object") {
      if (!backend.connected && realtimeSttState.lastError) {
        return { ...backend, error: realtimeSttState.lastError };
      }
      return backend;
    }
    return {
      connected: false,
      error: realtimeSttState.lastError || "stt_backend_not_available_in_tauri",
    };
  },
  startAnswerNowMic: () => invokeTyped("start_answer_now_mic"),
  stopAnswerNowMic: () => invokeTyped("stop_answer_now_mic"),
  finalizeMicSTT: () => invokeTyped("finalize_mic_stt"),
  deepgramTranscribeAnswerNow: (
    audioBase64: string,
    mimeType?: string,
    model?: string,
  ) =>
    invokeTyped("deepgram_transcribe_answer_now", {
      audioBase64,
      audio_base64: audioBase64,
      mimeType,
      mime_type: mimeType,
      model,
    }),
  onAudioTestLevel: (callback: Listener<number>) => {
    audioTestListeners.add(callback);
    return () => {
      audioTestListeners.delete(callback);
    };
  },
  startAudioTest: async (deviceId?: string) => {
    const backendResult = await invokeTyped<any>("start_audio_test", {
      deviceId,
      device_id: deviceId,
    });
    if (
      backendResult &&
      typeof backendResult === "object" &&
      backendResult.success === true
    ) {
      return backendResult;
    }
    return startBrowserAudioTest(deviceId);
  },
  stopAudioTest: async () => {
    await invokeTyped<any>("stop_audio_test");
    return stopBrowserAudioTest();
  },
  getUndetectable: async () => {
    const fromBackend = await invokeTyped<any>("get_undetectable");
    if (typeof fromBackend === "boolean") {
      writeLsBoolean(LS_KEYS.undetectable, fromBackend);
      return fromBackend;
    }
    return readLsBoolean(LS_KEYS.undetectable, false);
  },
  setUndetectable: async (state: boolean) => {
    writeLsBoolean(LS_KEYS.undetectable, state);
    return invokeTyped("set_undetectable", { state });
  },
  getOpenAtLogin: async () => {
    const fromBackend = await invokeTyped<any>("get_open_at_login");
    if (typeof fromBackend === "boolean") {
      writeLsBoolean(LS_KEYS.openAtLogin, fromBackend);
      return fromBackend;
    }
    return readLsBoolean(LS_KEYS.openAtLogin, false);
  },
  setOpenAtLogin: async (open: boolean) => {
    writeLsBoolean(LS_KEYS.openAtLogin, open);
    return invokeTyped("set_open_at_login", { open });
  },
  getOverlayMousePassthrough: async () => {
    const fromBackend = await invokeTyped<any>("get_overlay_mouse_passthrough");
    if (typeof fromBackend === "boolean") {
      writeLsBoolean(LS_KEYS.overlayMousePassthrough, fromBackend);
      return fromBackend;
    }
    return readLsBoolean(LS_KEYS.overlayMousePassthrough, false);
  },
  setOverlayMousePassthrough: async (enabled: boolean) => {
    writeLsBoolean(LS_KEYS.overlayMousePassthrough, enabled);
    return invokeTyped("set_overlay_mouse_passthrough", { enabled });
  },
  toggleOverlayMousePassthrough: async () => {
    const next = !readLsBoolean(LS_KEYS.overlayMousePassthrough, false);
    writeLsBoolean(LS_KEYS.overlayMousePassthrough, next);
    const backendResult = await invokeTyped<any>(
      "toggle_overlay_mouse_passthrough",
    );
    if (
      backendResult &&
      typeof backendResult === "object" &&
      typeof backendResult.enabled === "boolean"
    ) {
      writeLsBoolean(LS_KEYS.overlayMousePassthrough, backendResult.enabled);
      return backendResult;
    }
    return { success: true, enabled: next };
  },
  getDisguise: async () => {
    const fromBackend = await invokeTyped<any>("get_disguise");
    if (typeof fromBackend === "string" && fromBackend.trim()) {
      writeLsString(LS_KEYS.disguiseMode, fromBackend);
      return fromBackend;
    }
    return readLsString(LS_KEYS.disguiseMode, "none");
  },
  setDisguise: async (mode: string) => {
    const normalized = mode?.trim() || "none";
    writeLsString(LS_KEYS.disguiseMode, normalized);
    return invokeTyped("set_disguise", { mode: normalized });
  },
  getVerboseLogging: async () => {
    const fromBackend = await invokeTyped<any>("get_verbose_logging");
    if (typeof fromBackend === "boolean") {
      writeLsBoolean(LS_KEYS.verboseLogging, fromBackend);
      return fromBackend;
    }
    return readLsBoolean(LS_KEYS.verboseLogging, false);
  },
  setVerboseLogging: async (enabled: boolean) => {
    writeLsBoolean(LS_KEYS.verboseLogging, enabled);
    return invokeTyped("set_verbose_logging", { enabled });
  },
  getProviderDataScopes: async () => {
    const fromBackend = await invokeTyped<any>("get_provider_data_scopes");
    if (fromBackend && typeof fromBackend === "object") {
      writeLsJson(LS_KEYS.providerDataScopes, fromBackend);
      return fromBackend;
    }
    return readLsJson(LS_KEYS.providerDataScopes, {});
  },
  setProviderDataScopes: async (scopes: Record<string, unknown>) => {
    writeLsJson(LS_KEYS.providerDataScopes, scopes || {});
    return invokeTyped("set_provider_data_scopes", { scopes });
  },
  getScreenUnderstandingMode: async () => {
    const fromBackend = await invokeTyped<any>("get_screen_understanding_mode");
    if (typeof fromBackend === "string" && fromBackend.trim()) {
      writeLsString(LS_KEYS.screenUnderstandingMode, fromBackend);
      return fromBackend;
    }
    return readLsString(LS_KEYS.screenUnderstandingMode, "vision_first");
  },
  setScreenUnderstandingMode: async (mode: string) => {
    const normalized = mode?.trim() || "vision_first";
    writeLsString(LS_KEYS.screenUnderstandingMode, normalized);
    return invokeTyped("set_screen_understanding_mode", { mode: normalized });
  },
  getTechnicalInterviewVisionFirst: async () => {
    const fromBackend = await invokeTyped<any>(
      "get_technical_interview_vision_first",
    );
    if (typeof fromBackend === "boolean") {
      writeLsBoolean(LS_KEYS.technicalInterviewVisionFirst, fromBackend);
      return fromBackend;
    }
    return readLsBoolean(LS_KEYS.technicalInterviewVisionFirst, true);
  },
  setTechnicalInterviewVisionFirst: async (enabled: boolean) => {
    writeLsBoolean(LS_KEYS.technicalInterviewVisionFirst, enabled);
    return invokeTyped("set_technical_interview_vision_first", { enabled });
  },
  getTechnicalInterviewDirectVision: async () => {
    const fromBackend = await invokeTyped<any>(
      "get_technical_interview_direct_vision",
    );
    if (typeof fromBackend === "boolean") {
      writeLsBoolean(LS_KEYS.technicalInterviewVisionFirst, fromBackend);
      return fromBackend;
    }
    return readLsBoolean(LS_KEYS.technicalInterviewVisionFirst, true);
  },
  setTechnicalInterviewDirectVision: async (enabled: boolean) => {
    writeLsBoolean(LS_KEYS.technicalInterviewVisionFirst, enabled);
    return invokeTyped("set_technical_interview_direct_vision", { enabled });
  },
  setWindowMode: (mode: string, inactive?: boolean) =>
    invokeTyped("set_window_mode", { mode, inactive }),
  showWindow: () => invokeTyped("show_window"),
  hideWindow: () => invokeTyped("hide_window"),
  toggleWindow: () => invokeTyped("toggle_window"),
  showOverlay: () => invokeTyped("show_overlay"),
  hideOverlay: () => invokeTyped("hide_overlay"),
  updateContentDimensions: ({
    width,
    height,
  }: {
    width: number;
    height: number;
  }) => invokeTyped("update_content_dimensions", { width, height }),
  updateContentDimensionsCentered: ({
    width,
    height,
  }: {
    width: number;
    height: number;
  }) => invokeTyped("update_content_dimensions_centered", { width, height }),
  moveWindowLeft: () => invokeTyped("move_window_left"),
  moveWindowRight: () => invokeTyped("move_window_right"),
  moveWindowUp: () => invokeTyped("move_window_up"),
  moveWindowDown: () => invokeTyped("move_window_down"),
  windowMinimize: () => invokeTyped("window_minimize"),
  windowMaximize: () => invokeTyped("window_maximize"),
  windowClose: () => invokeTyped("window_close"),
  windowIsMaximized: () => invokeTyped("window_is_maximized"),
  takeScreenshot: () => invokeTyped("take_screenshot"),
  takeSelectiveScreenshot: () => invokeTyped("take_selective_screenshot"),
  getScreenshots: () => invokeTyped("get_screenshots"),
  getInputDevices: async () => {
    const fromBackend = await invokeTyped<any>("get_input_devices");
    if (Array.isArray(fromBackend) && fromBackend.length > 0) {
      return fromBackend;
    }
    return enumerateBrowserAudioDevices("audioinput");
  },
  getOutputDevices: async () => {
    const fromBackend = await invokeTyped<any>("get_output_devices");
    if (Array.isArray(fromBackend) && fromBackend.length > 0) {
      return fromBackend;
    }
    return enumerateBrowserAudioDevices("audiooutput");
  },
  deleteScreenshot: (path: string) =>
    invokeTyped("delete_screenshot", { path }),
  getRecentMeetings: () => invokeTyped("get_recent_meetings"),
  getMeetingDetails: (id: string) => invokeTyped("get_meeting_details", { id }),
  updateMeetingTitle: (id: string, title: string) =>
    invokeTyped("update_meeting_title", { id, title }),
  updateMeetingSummary: (id: string, updates: any) =>
    invokeTyped("update_meeting_summary", { id, updates }),
  getKeybinds: () => invokeTyped("get_keybinds"),
  setKeybind: (id: string, accelerator: string) =>
    invokeTyped("set_keybind", { id, accelerator }),
  resetKeybinds: () => invokeTyped("reset_keybinds"),
  openExternal: (url: string) => invokeTyped("open_external", { url }),
  checkForUpdates: () => invokeTyped("check_for_updates"),
  downloadUpdate: () => invokeTyped("download_update"),
  restartAndInstall: () => invokeTyped("restart_and_install"),
  testReleaseFetch: () => invokeTyped("test_release_fetch"),
  toggleSettingsWindow: () => invokeTyped("toggle_settings_window"),
  toggleModelSelector: () => invokeTyped("toggle_model_selector"),
  modelSelectorCloseIfOpen: () => invokeTyped("model_selector_close_if_open"),
  getArch: () => invokeTyped("get_arch"),
  quitApp: async () => {
    await stopRealtimeStt();
    return invokeTyped("quit_app");
  },
  getMeetingRetention: () => invokeTyped("get_meeting_retention"),
  setMeetingRetention: (retention: string) =>
    invokeTyped("set_meeting_retention", { retention }),
  invoke: (channel: string, args?: any) =>
    invokeTyped("legacy_invoke", { channel, args }),
};

const makeDynamicMethod = (method: string) => {
  if (method === "invoke") {
    return async (channel: string, args?: any) =>
      invokeTyped("legacy_invoke", { channel, args });
  }
  return async (...args: any[]) => invokeDesktopApi(method, args);
};

export const installTauriElectronShim = (): void => {
  if (!isTauriRuntime()) return;

  const g = window as any;
  if (g.electronAPI) return;

  const base: Record<string, any> = {
    platform: detectPlatform(),
  };

  for (const [method, eventName] of Object.entries(methodToEventMap)) {
    base[method] = onEvent(eventName);
  }

  // These channels can be emitted either by backend (Tauri) or by local shim
  // fallbacks (browser STT pipeline, optimistic model updates).
  base.onNativeAudioTranscript = onHybridEvent("native-audio-transcript");
  base.onNativeAudioConnected = onHybridEvent("native-audio-connected");
  base.onNativeAudioDisconnected = onHybridEvent("native-audio-disconnected");
  base.onSttStatusChanged = onHybridEvent("stt-status-changed");
  base.onModelChanged = onHybridEvent("model-changed");

  for (const [name, impl] of Object.entries(mappedCommands)) {
    base[name] = impl;
  }

  g.electronAPI = new Proxy(base, {
    get(target, prop: string | symbol, receiver) {
      if (typeof prop !== "string") {
        return Reflect.get(target, prop, receiver);
      }
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }

      if (prop.startsWith("on")) {
        const maybeMapped = methodToEventMap[prop];
        if (maybeMapped) {
          const handler = onEvent(maybeMapped);
          target[prop] = handler;
          return handler;
        }

        const inferred = toKebab(prop.slice(2));
        const listener = onEvent(inferred || prop);
        target[prop] = listener;
        return listener;
      }

      const dynamic = makeDynamicMethod(prop);
      target[prop] = dynamic;
      return dynamic;
    },
  });

  window.addEventListener(
    "beforeunload",
    () => {
      void stopRealtimeStt();
    },
    { once: true },
  );
};
