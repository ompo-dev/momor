import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Square } from "lucide-react";
import icon from "../icon.png";
import type { OverlayAppearance } from "../../lib/overlayAppearance";

interface CollapsedWidgetProps {
  /** True while either party is actively speaking — drives the red pulse. */
  active: boolean;
  appearance: OverlayAppearance;
  onExpand: () => void;
  onStop: () => void;
  /** Epoch ms the session started (for the timer). Falls back to mount time. */
  sessionStartMs?: number | null;
}

const formatElapsed = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

/**
 * Compact capsule shown when the overlay is collapsed (Hide). Notion/Dynamic-
 * Island feel: logo + a live listening/recording indicator + session timer,
 * with expand/stop revealed on hover. Draggable; the rest stays click-through.
 */
const CollapsedWidget: React.FC<CollapsedWidgetProps> = ({
  active,
  appearance,
  onExpand,
  onStop,
  sessionStartMs,
}) => {
  const startRef = useRef<number>(sessionStartMs || Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startRef.current = sessionStartMs || startRef.current;
    const id = setInterval(() => {
      setElapsed(Date.now() - startRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStartMs]);

  // Equalizer bars — animate amplitude when active, idle breathing otherwise.
  const bars = [0, 1, 2, 3];

  return (
    <div className="flex justify-center mt-2 select-none z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="group draggable-area flex items-center gap-2.5 rounded-full overlay-pill-surface backdrop-blur-md pl-2 pr-3 py-1.5"
        style={appearance.pillStyle}
      >
        {/* Logo — click expands */}
        <button
          onClick={onExpand}
          className="w-8 h-8 rounded-full overlay-icon-surface overlay-icon-surface-hover flex items-center justify-center relative overflow-hidden interaction-base interaction-press shrink-0"
          style={appearance.iconStyle}
          title="Expandir"
        >
          <img
            src={icon}
            alt="Momor"
            className="w-[22px] h-[22px] object-contain opacity-95 force-black-icon"
            draggable="false"
            onDragStart={(e) => e.preventDefault()}
          />
        </button>

        {/* Live equalizer + timer */}
        <button
          onClick={onExpand}
          className="flex items-center gap-2 no-drag interaction-base"
          title="Expandir"
        >
          <span className="flex items-end gap-[2px] h-4">
            {bars.map((b) => (
              <motion.span
                key={b}
                className={`w-[3px] rounded-full ${active ? "bg-red-500" : "bg-current opacity-60"}`}
                animate={
                  active
                    ? { height: ["35%", "100%", "55%", "90%", "40%"] }
                    : { height: ["40%", "60%", "40%"] }
                }
                transition={{
                  duration: active ? 0.7 : 1.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: b * 0.12,
                }}
                style={{ height: "50%" }}
              />
            ))}
          </span>
          <span className="text-[12px] font-medium tabular-nums tracking-wide overlay-text-primary opacity-90">
            {formatElapsed(elapsed)}
          </span>
        </button>

        {/* Hover actions: expand + stop */}
        <div className="flex items-center gap-1 no-drag opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onExpand}
            className="w-7 h-7 rounded-full overlay-icon-surface overlay-text-primary flex items-center justify-center interaction-base interaction-press"
            style={appearance.iconStyle}
            title="Expandir"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onStop}
            className="w-7 h-7 rounded-full overlay-icon-surface overlay-text-primary flex items-center justify-center interaction-base interaction-press hover:bg-red-500/10 hover:text-red-400"
            style={appearance.iconStyle}
            title="Encerrar"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CollapsedWidget;
