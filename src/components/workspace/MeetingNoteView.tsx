import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import MeetingDetails from "../MeetingDetails";

interface MeetingNoteViewProps {
  meetingId: string;
  onOpenSettings: (tab?: string) => void;
}

/**
 * Thin wrapper that loads a meeting's full details and renders the existing
 * MeetingDetails view inside the workspace's content pane.
 */
const MeetingNoteView: React.FC<MeetingNoteViewProps> = ({
  meetingId,
  onOpenSettings,
}) => {
  const { t } = useTranslation();
  const { data: meeting, isLoading } = useQuery({
    queryKey: ["meeting-details", meetingId],
    queryFn: () => window.electronAPI.getMeetingDetails(meetingId),
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
        {t("workspace.loading")}
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
        {t("workspace.meetingNotFound")}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <MeetingDetails
        meeting={meeting}
        onBack={() => {}}
        onOpenSettings={() => onOpenSettings()}
      />
    </div>
  );
};

export default MeetingNoteView;
