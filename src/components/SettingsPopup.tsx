import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MessageSquare, Camera } from "lucide-react";
import { useShortcuts } from "../hooks/useShortcuts";
import { useResolvedTheme } from "../hooks/useResolvedTheme";

const SettingsPopup = () => {
  const { shortcuts } = useShortcuts();
  const isLightTheme = useResolvedTheme() === "light";
  const [isUndetectable, setIsUndetectable] = useState(false);
  const [showTranscript, setShowTranscript] = useState(() => {
    const stored = localStorage.getItem("momor_interviewer_transcript");
    return stored !== "false";
  });
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.electronAPI?.getUndetectable) {
      window.electronAPI.getUndetectable().then((state: boolean) => {
        setIsUndetectable(state);
      });
    }
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.onUndetectableChanged) return;
    const unsubscribe = window.electronAPI.onUndetectableChanged(
      (newState: boolean) => {
        setIsUndetectable(newState);
        localStorage.setItem("momor_undetectable", String(newState));
      },
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem("momor_interviewer_transcript");
      setShowTranscript(stored !== "false");
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useLayoutEffect(() => {
    if (!contentRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        try {
          window.electronAPI?.updateContentDimensions({
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height),
          });
        } catch (e) {
          console.warn("Failed to update dimensions", e);
        }
      }
    });

    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  const itemHoverClass = isLightTheme
    ? "hover:bg-black/[0.04]"
    : "hover:bg-white/5";
  const labelInactiveClass = isLightTheme
    ? "text-slate-700 group-hover:text-slate-900"
    : "text-slate-400 group-hover:text-slate-200";
  const iconInactiveClass = isLightTheme
    ? "text-slate-500 group-hover:text-slate-700"
    : "text-slate-500 group-hover:text-slate-300";
  const shortcutKeyClass = isLightTheme
    ? "border-black/10 bg-black/[0.04] text-slate-600"
    : "border-white/10 bg-white/5 text-slate-500";
  const defaultToggleTrackClass = isLightTheme
    ? "bg-black/[0.22]"
    : "bg-white/10";
  const toggleKnobClass = isLightTheme
    ? "bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)]"
    : "bg-black shadow-sm";

  return (
    <div className="flex h-fit w-fit flex-col bg-transparent">
      <div
        ref={contentRef}
        className="flex w-[200px] max-h-[280px] flex-col overflow-hidden rounded-[16px] border border-border bg-card/95 p-2 shadow-2xl backdrop-blur-md animate-scale-in origin-top-left"
      >
        <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div
            className={`group flex cursor-default items-center justify-between rounded-lg px-3 py-2 transition-colors duration-200 ${itemHoverClass}`}
          >
            <div className="flex items-center gap-3">
              <CustomGhost
                className={`h-4 w-4 transition-colors ${isUndetectable ? (isLightTheme ? "text-slate-900" : "text-white") : iconInactiveClass}`}
                fill={isUndetectable ? "currentColor" : "none"}
                stroke={isUndetectable ? "none" : "currentColor"}
                eyeColor={
                  isUndetectable
                    ? isLightTheme
                      ? "white"
                      : "black"
                    : isLightTheme
                      ? "#334155"
                      : "white"
                }
              />
              <span
                className={`text-[12px] font-medium transition-colors ${isUndetectable ? (isLightTheme ? "text-slate-950" : "text-white") : labelInactiveClass}`}
              >
                {isUndetectable ? "Undetectable" : "Detectable"}
              </span>
            </div>
            <button
              onClick={() => {
                const newState = !isUndetectable;
                setIsUndetectable(newState);
                localStorage.setItem("momor_undetectable", String(newState));
                window.electronAPI?.setUndetectable(newState);
              }}
              className={`h-[18px] w-[30px] rounded-full p-[1.5px] transition-all duration-300 ease-spring active:scale-[0.92] ${
                isUndetectable
                  ? isLightTheme
                    ? "bg-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.18)]"
                    : "bg-white shadow-[0_2px_8px_rgba(255,255,255,0.2)]"
                  : defaultToggleTrackClass
              }`}
            >
              <div
                className={`h-[15px] w-[15px] rounded-full transition-transform duration-300 ease-spring ${toggleKnobClass} ${isUndetectable ? "translate-x-[12px]" : "translate-x-0"}`}
              />
            </button>
          </div>

          <div
            className={`group flex cursor-default items-center justify-between rounded-lg px-3 py-2 transition-colors duration-200 ${itemHoverClass}`}
          >
            <div className="flex items-center gap-3">
              <MessageSquare
                className={`h-3.5 w-3.5 transition-colors ${showTranscript ? "text-emerald-400" : iconInactiveClass}`}
                fill={showTranscript ? "currentColor" : "none"}
              />
              <span
                className={`text-[12px] font-medium transition-colors ${showTranscript ? (isLightTheme ? "text-slate-950" : "text-white") : labelInactiveClass}`}
              >
                Transcript
              </span>
            </div>
            <button
              onClick={() => {
                const newState = !showTranscript;
                setShowTranscript(newState);
                localStorage.setItem(
                  "momor_interviewer_transcript",
                  String(newState),
                );
                window.dispatchEvent(new Event("storage"));
              }}
              className={`h-[18px] w-[30px] rounded-full p-[1.5px] transition-all duration-300 ease-spring active:scale-[0.92] ${showTranscript ? "bg-emerald-500 shadow-[0_2px_10px_rgba(16,185,129,0.3)]" : defaultToggleTrackClass}`}
            >
              <div
                className={`h-[15px] w-[15px] rounded-full transition-transform duration-300 ease-spring ${toggleKnobClass} ${showTranscript ? "translate-x-[12px]" : "translate-x-0"}`}
              />
            </button>
          </div>

          <div
            className={`group interaction-base interaction-press flex items-center justify-between rounded-lg px-3 py-2 transition-colors duration-200 ${itemHoverClass}`}
          >
            <div className="flex items-center gap-3">
              <MessageSquare
                className={`h-3.5 w-3.5 transition-colors ${iconInactiveClass}`}
              />
              <span
                className={`text-[12px] transition-colors ${labelInactiveClass}`}
              >
                Show/Hide
              </span>
            </div>
            <div className="flex gap-1 opacity-60 transition-opacity group-hover:opacity-100">
              {(shortcuts.toggleVisibility || ["⌘", "B"]).map((key, index) => (
                <div
                  key={index}
                  className={`min-w-[20px] rounded border px-1.5 py-0.5 text-center text-[10px] font-medium ${shortcutKeyClass}`}
                >
                  {key}
                </div>
              ))}
            </div>
          </div>

          <div
            className={`group interaction-base interaction-press flex items-center justify-between rounded-lg px-3 py-2 transition-colors duration-200 ${itemHoverClass}`}
          >
            <div className="flex items-center gap-3">
              <Camera
                className={`h-3.5 w-3.5 transition-colors ${iconInactiveClass}`}
              />
              <span
                className={`text-[12px] transition-colors ${labelInactiveClass}`}
              >
                Screenshot
              </span>
            </div>
            <div className="flex gap-1 opacity-60 transition-opacity group-hover:opacity-100">
              {(shortcuts.takeScreenshot || ["⌘", "H"]).map((key, index) => (
                <div
                  key={index}
                  className={`min-w-[20px] rounded border px-1.5 py-0.5 text-center text-[10px] font-medium ${shortcutKeyClass}`}
                >
                  {key}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CustomGhostProps {
  className?: string;
  fill?: string;
  stroke?: string;
  eyeColor?: string;
}

const CustomGhost = ({
  className,
  fill,
  stroke,
  eyeColor,
}: CustomGhostProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill={fill || "none"}
    stroke={stroke || "currentColor"}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    <path
      d="M9 10h.01 M15 10h.01"
      stroke={eyeColor || "currentColor"}
      strokeWidth="2.5"
      fill="none"
    />
  </svg>
);

export default SettingsPopup;
