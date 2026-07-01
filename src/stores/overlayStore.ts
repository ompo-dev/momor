import { create } from "zustand";
import { Message } from "../components/momorShared";

type SttStatus = "connected" | "reconnecting" | "failed";
type ScreenContextStatus = "not_available" | "available" | "failed";
type ActionButtonMode = "recap" | "brainstorm";
type AgentTool = { toolId: string; name: string; done: boolean; isError: boolean };
type Attachment = { path: string; preview: string };

/**
 * Overlay UI store (Zustand). Replaces the prop-drilled `useOverlayState`
 * bag: components subscribe to the slices they need via selectors instead of
 * receiving 80+ props. Imperative handles (refs) stay out of the store.
 */
export interface OverlayStore {
  isExpanded: boolean;
  isCollapsed: boolean;
  inputValue: string;
  messages: Message[];
  isConnected: boolean;
  sttUserStatus: SttStatus;
  sttUserError: string;
  sttUserProvider: string;
  sttInterviewerStatus: SttStatus;
  sttInterviewerError: string;
  isProcessing: boolean;
  agentTools: AgentTool[];
  isSettingsOpen: boolean;
  conversationContext: string;
  isManualRecording: boolean;
  manualTranscript: string;
  answerCallSessionActive: boolean;
  showTranscript: boolean;
  autoScroll: boolean;
  rollingCommitted: string;
  rollingLive: string;
  isInterviewerSpeaking: boolean;
  userRollingCommitted: string;
  userRollingLive: string;
  isUserSpeaking: boolean;
  voiceInput: string;
  stealthTapActive: boolean;
  stealthHotkeyConflict: string | null;
  attachedContext: Attachment[];
  isUndetectable: boolean;
  hideChatHidesWidget: boolean;
  activeModeLabel: string | null;
  llmProviderLabel: string;
  llmPrivacyLabel: string;
  screenContextStatus: ScreenContextStatus;
  latestUsedImageInput: boolean;
  latestVisionProviderUsed: string | undefined;
  latestVisionModelUsed: string | undefined;
  latestVisionFailureReason: string | undefined;
  currentModel: string;
  currentSttProfileId: string | null;
  currentSttLabel: string;
  actionButtonMode: ActionButtonMode;
  isMousePassthrough: boolean;
  systemAudioWarning: string | null;
  sttNotConfigured: boolean;

  setIsExpanded: (v: React.SetStateAction<boolean>) => void;
  setIsCollapsed: (v: React.SetStateAction<boolean>) => void;
  setInputValue: (v: React.SetStateAction<string>) => void;
  setMessages: (v: React.SetStateAction<Message[]>) => void;
  setIsConnected: (v: React.SetStateAction<boolean>) => void;
  setSttUserStatus: (v: React.SetStateAction<SttStatus>) => void;
  setSttUserError: (v: React.SetStateAction<string>) => void;
  setSttUserProvider: (v: React.SetStateAction<string>) => void;
  setSttInterviewerStatus: (v: React.SetStateAction<SttStatus>) => void;
  setSttInterviewerError: (v: React.SetStateAction<string>) => void;
  setIsProcessing: (v: React.SetStateAction<boolean>) => void;
  setAgentTools: (v: React.SetStateAction<AgentTool[]>) => void;
  setIsSettingsOpen: (v: React.SetStateAction<boolean>) => void;
  setConversationContext: (v: React.SetStateAction<string>) => void;
  setIsManualRecording: (v: React.SetStateAction<boolean>) => void;
  setManualTranscript: (v: React.SetStateAction<string>) => void;
  setAnswerCallSessionActive: (v: React.SetStateAction<boolean>) => void;
  setShowTranscript: (v: React.SetStateAction<boolean>) => void;
  setAutoScroll: (v: React.SetStateAction<boolean>) => void;
  setRollingCommitted: (v: React.SetStateAction<string>) => void;
  setRollingLive: (v: React.SetStateAction<string>) => void;
  setIsInterviewerSpeaking: (v: React.SetStateAction<boolean>) => void;
  setUserRollingCommitted: (v: React.SetStateAction<string>) => void;
  setUserRollingLive: (v: React.SetStateAction<string>) => void;
  setIsUserSpeaking: (v: React.SetStateAction<boolean>) => void;
  setVoiceInput: (v: React.SetStateAction<string>) => void;
  setStealthTapActive: (v: React.SetStateAction<boolean>) => void;
  setStealthHotkeyConflict: (v: React.SetStateAction<string | null>) => void;
  setAttachedContext: (v: React.SetStateAction<Attachment[]>) => void;
  setIsUndetectable: (v: React.SetStateAction<boolean>) => void;
  setHideChatHidesWidget: (v: React.SetStateAction<boolean>) => void;
  setActiveModeLabel: (v: React.SetStateAction<string | null>) => void;
  setLlmProviderLabel: (v: React.SetStateAction<string>) => void;
  setLlmPrivacyLabel: (v: React.SetStateAction<string>) => void;
  setScreenContextStatus: (v: React.SetStateAction<ScreenContextStatus>) => void;
  setLatestUsedImageInput: (v: React.SetStateAction<boolean>) => void;
  setLatestVisionProviderUsed: (v: React.SetStateAction<string | undefined>) => void;
  setLatestVisionModelUsed: (v: React.SetStateAction<string | undefined>) => void;
  setLatestVisionFailureReason: (v: React.SetStateAction<string | undefined>) => void;
  setCurrentModel: (v: React.SetStateAction<string>) => void;
  setCurrentSttProfileId: (v: React.SetStateAction<string | null>) => void;
  setCurrentSttLabel: (v: React.SetStateAction<string>) => void;
  setActionButtonMode: (v: React.SetStateAction<ActionButtonMode>) => void;
  setIsMousePassthrough: (v: React.SetStateAction<boolean>) => void;
  setSystemAudioWarning: (v: React.SetStateAction<string | null>) => void;
  setSttNotConfigured: (v: React.SetStateAction<boolean>) => void;
}

// React-compatible setter: supports both value and updater-function forms.
const setter =
  <K extends keyof OverlayStore>(
    set: (fn: (s: OverlayStore) => Partial<OverlayStore>) => void,
    key: K,
  ) =>
  (v: any) =>
    set((s) => ({ [key]: typeof v === "function" ? v(s[key]) : v }) as Partial<OverlayStore>);

const ls = (k: string, dflt: boolean, eq: string = "true") => {
  const stored = localStorage.getItem(k);
  return stored === null ? dflt : stored === eq;
};

export const useOverlayStore = create<OverlayStore>((set) => ({
  isExpanded: true,
  isCollapsed: false,
  inputValue: "",
  messages: [],
  isConnected: false,
  sttUserStatus: "connected",
  sttUserError: "",
  sttUserProvider: "",
  sttInterviewerStatus: "connected",
  sttInterviewerError: "",
  isProcessing: false,
  agentTools: [],
  isSettingsOpen: false,
  conversationContext: "",
  isManualRecording: false,
  manualTranscript: "",
  answerCallSessionActive: false,
  showTranscript: localStorage.getItem("momor_interviewer_transcript") !== "false",
  autoScroll: localStorage.getItem("momor_auto_scroll") === "true",
  rollingCommitted: "",
  rollingLive: "",
  isInterviewerSpeaking: false,
  userRollingCommitted: "",
  userRollingLive: "",
  isUserSpeaking: false,
  voiceInput: "",
  stealthTapActive: false,
  stealthHotkeyConflict: null,
  attachedContext: [],
  isUndetectable: false,
  hideChatHidesWidget: ls("momor_hideChatHidesWidget", true),
  activeModeLabel: null,
  llmProviderLabel: "unknown",
  llmPrivacyLabel: "Checking privacy route",
  screenContextStatus: "not_available",
  latestUsedImageInput: false,
  latestVisionProviderUsed: undefined,
  latestVisionModelUsed: undefined,
  latestVisionFailureReason: undefined,
  currentModel: "gemini-3-flash-preview",
  currentSttProfileId: null,
  currentSttLabel: "STT",
  actionButtonMode: "recap",
  isMousePassthrough: false,
  systemAudioWarning: null,
  sttNotConfigured: false,

  setIsExpanded: setter(set, "isExpanded"),
  setIsCollapsed: setter(set, "isCollapsed"),
  setInputValue: setter(set, "inputValue"),
  setMessages: setter(set, "messages"),
  setIsConnected: setter(set, "isConnected"),
  setSttUserStatus: setter(set, "sttUserStatus"),
  setSttUserError: setter(set, "sttUserError"),
  setSttUserProvider: setter(set, "sttUserProvider"),
  setSttInterviewerStatus: setter(set, "sttInterviewerStatus"),
  setSttInterviewerError: setter(set, "sttInterviewerError"),
  setIsProcessing: setter(set, "isProcessing"),
  setAgentTools: setter(set, "agentTools"),
  setIsSettingsOpen: setter(set, "isSettingsOpen"),
  setConversationContext: setter(set, "conversationContext"),
  setIsManualRecording: setter(set, "isManualRecording"),
  setManualTranscript: setter(set, "manualTranscript"),
  setAnswerCallSessionActive: setter(set, "answerCallSessionActive"),
  setShowTranscript: setter(set, "showTranscript"),
  setAutoScroll: setter(set, "autoScroll"),
  setRollingCommitted: setter(set, "rollingCommitted"),
  setRollingLive: setter(set, "rollingLive"),
  setIsInterviewerSpeaking: setter(set, "isInterviewerSpeaking"),
  setUserRollingCommitted: setter(set, "userRollingCommitted"),
  setUserRollingLive: setter(set, "userRollingLive"),
  setIsUserSpeaking: setter(set, "isUserSpeaking"),
  setVoiceInput: setter(set, "voiceInput"),
  setStealthTapActive: setter(set, "stealthTapActive"),
  setStealthHotkeyConflict: setter(set, "stealthHotkeyConflict"),
  setAttachedContext: setter(set, "attachedContext"),
  setIsUndetectable: setter(set, "isUndetectable"),
  setHideChatHidesWidget: setter(set, "hideChatHidesWidget"),
  setActiveModeLabel: setter(set, "activeModeLabel"),
  setLlmProviderLabel: setter(set, "llmProviderLabel"),
  setLlmPrivacyLabel: setter(set, "llmPrivacyLabel"),
  setScreenContextStatus: setter(set, "screenContextStatus"),
  setLatestUsedImageInput: setter(set, "latestUsedImageInput"),
  setLatestVisionProviderUsed: setter(set, "latestVisionProviderUsed"),
  setLatestVisionModelUsed: setter(set, "latestVisionModelUsed"),
  setLatestVisionFailureReason: setter(set, "latestVisionFailureReason"),
  setCurrentModel: setter(set, "currentModel"),
  setCurrentSttProfileId: setter(set, "currentSttProfileId"),
  setCurrentSttLabel: setter(set, "currentSttLabel"),
  setActionButtonMode: setter(set, "actionButtonMode"),
  setIsMousePassthrough: setter(set, "isMousePassthrough"),
  setSystemAudioWarning: setter(set, "systemAudioWarning"),
  setSttNotConfigured: setter(set, "sttNotConfigured"),
}));
