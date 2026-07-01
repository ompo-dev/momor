import React from "react";
import { useTranslation } from "react-i18next";
import {
  Pencil,
  MessageSquare,
  Lightbulb,
  RefreshCw,
  HelpCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOverlayStore } from "../../../stores/overlayStore";

type Props = {
  onWhatToSay: () => void;
  onClarify: () => void;
  onRecap: () => void;
  onBrainstorm: () => void;
  onFollowUpQuestions: () => void;
  onAnswerNow: () => void;
  isCallMode: boolean;
  quickActionClass: string;
  chipStyle?: React.CSSProperties;
  tightTop: boolean;

};

const BTN = "h-7 shrink-0 rounded-md px-2.5 text-[11px] font-medium";

/** Horizontal quick-action bar: what-to-answer / clarify / recap|brainstorm / follow-up / answer. */
export default function OverlayActionBar({
  onWhatToSay,
  onClarify,
  onRecap,
  onBrainstorm,
  onFollowUpQuestions,
  onAnswerNow,
  isCallMode,
  quickActionClass,
  chipStyle,
  tightTop,
}: Props) {
  const {
    actionButtonMode,
    isManualRecording,
    answerCallSessionActive,
  } = useOverlayStore();
  const { t } = useTranslation();
  return (
    <div className={cn("max-w-full px-3 pb-2", tightTop ? "pt-1" : "pt-2")}>
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onWhatToSay}
          className={cn(BTN, quickActionClass)}
          style={chipStyle}
        >
          <Pencil className="h-3 w-3 opacity-70" /> {t("overlay.whatToAnswer")}
        </Button>

        {!isCallMode && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClarify}
            className={cn(BTN, quickActionClass)}
            style={chipStyle}
          >
            <MessageSquare className="h-3 w-3 opacity-70" /> {t("overlay.clarify")}
          </Button>
        )}

        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={actionButtonMode === "brainstorm" ? onBrainstorm : onRecap}
          className={cn(BTN, quickActionClass)}
          style={chipStyle}
        >
          {actionButtonMode === "brainstorm" ? (
            <>
              <Lightbulb className="h-3 w-3 opacity-70" /> {t("overlay.brainstorm")}
            </>
          ) : (
            <>
              <RefreshCw className="h-3 w-3 opacity-70" /> {t("overlay.recap")}
            </>
          )}
        </Button>

        {!isCallMode && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onFollowUpQuestions}
            className={cn(BTN, quickActionClass)}
            style={chipStyle}
          >
            <HelpCircle className="h-3 w-3 opacity-70" />{" "}
            {t("overlay.followUpQuestion")}
          </Button>
        )}

        <Button
          type="button"
          variant={isManualRecording && !isCallMode ? "destructive" : "secondary"}
          size="sm"
          onClick={onAnswerNow}
          title={
            isCallMode && answerCallSessionActive
              ? t("overlay.stopAnswerCall")
              : undefined
          }
          className={cn(
            "h-7 min-w-[72px] shrink-0 rounded-md px-2.5 text-[11px] font-medium",
            (!isManualRecording || isCallMode) && quickActionClass,
            isCallMode &&
              answerCallSessionActive &&
              "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          )}
          style={isManualRecording && !isCallMode ? undefined : chipStyle}
        >
          {isCallMode && answerCallSessionActive ? (
            <>
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              {t("overlay.listening")}
            </>
          ) : isManualRecording ? (
            <>
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              {t("overlay.stop")}
            </>
          ) : (
            <>
              <Zap className="h-3 w-3 opacity-70" /> {t("overlay.answer")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
